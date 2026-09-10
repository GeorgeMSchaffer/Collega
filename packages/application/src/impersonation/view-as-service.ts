import { randomUUID } from 'node:crypto'
import { ImpersonationEndReason, Role, UserStatus } from '@collega/domain/enums'
import {
  endImpersonationSession,
  ImpersonationDomainError,
  type ImpersonationSession,
  isImpersonationSessionActiveAt,
  startImpersonationSession,
} from '@collega/domain/impersonation'
import type { CurrentUserSummary } from '../auth/models.js'
import type {
  Attribution,
  AuditEventWriter,
  Clock,
  CurrentUserContext,
  UnitOfWork,
} from '../common/index.js'
import {
  attributeAudit,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type { ViewAsCandidate, ViewAsSessionResult } from './models.js'
import type {
  ImpersonationOrganizationSummary,
  ImpersonationOrganizationsPort,
  ImpersonationSessionRepository,
  ImpersonationUserSummary,
  ImpersonationUsersPort,
} from './ports.js'

const NOT_ALLOWED = 'You are not allowed to view as that user.'
const ALREADY_VIEWING_AS = 'You are already viewing as another user. Exit that session first.'

/**
 * The database error text for the partial unique index that actually enforces rule 5
 * (non-nestable) - `ux_impersonation_sessions_real_user_id_open`, unique on `real_user_id` WHERE
 * `ended_at_utc IS NULL`. Matched by constraint name in the thrown error's message/cause chain,
 * mirroring .NET's `IsOpenSessionUniqueViolation`, which deliberately avoided a dependency on
 * Npgsql (a driver-specific exception type) from the Application layer. Whatever Wave C's Prisma
 * repository throws for a unique-constraint violation, its message is expected to include the
 * constraint name - which Postgres always reports and Prisma passes through, since this index is
 * raw SQL unknown to `schema.prisma`.
 */
const OPEN_SESSION_UNIQUE_CONSTRAINT = 'ux_impersonation_sessions_real_user_id_open'

/**
 * Starting, ending and listing targets for View As (SPEC/20-feature-view-as.md). Every rule here
 * is enforced server-side; the UI control is a convenience and carries no authority (rule 8).
 *
 * This service deliberately authorizes against the caller's REAL identity, not the acting one.
 * Everywhere else in the application `CurrentUserContext.userId` is the right answer - here it is
 * not, because while a session is live that property already reports the impersonated user, and
 * asking them whether they may impersonate is the wrong question. Using `realUserId` is what
 * makes rule 5 (non-nestable) enforceable at all.
 */
export class ViewAsService {
  constructor(
    private readonly sessions: ImpersonationSessionRepository,
    private readonly users: ImpersonationUsersPort,
    private readonly organizations: ImpersonationOrganizationsPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async start(targetUserId: string): Promise<ViewAsSessionResult> {
    const { realUser, realRole } = await this.requireRealActor()

    if (realRole !== Role.SiteAdmin && realRole !== Role.OrgAdmin) {
      throw new ForbiddenError(NOT_ALLOWED)
    }

    const now = this.clock.now()

    // Rule 5: never silently replaced. A caller already acting as someone must exit first.
    const existing = await this.sessions.getOpenForRealUser(realUser.id)
    let closedExisting: ImpersonationSession | null = null
    if (existing) {
      if (isImpersonationSessionActiveAt(existing, now)) {
        throw new ConflictError(ALREADY_VIEWING_AS)
      }

      // Open but expired. It must be closed here rather than left behind: two rows with a null
      // endedAtUtc for the same administrator violate
      // ux_impersonation_sessions_real_user_id_open, so the insert below would fail. The auth
      // resolver normally closes these first, but start must not depend on having been reached
      // through it.
      closedExisting = endImpersonationSession(
        existing,
        now,
        now.getTime() >= existing.absoluteExpiresAtUtc.getTime()
          ? ImpersonationEndReason.AbsoluteTimeout
          : ImpersonationEndReason.IdleTimeout,
      )
    }

    const target = await this.users.getById(targetUserId)
    if (!target) {
      throw new NotFoundError('User not found.')
    }

    // Loaded before the authorization check because the target's organization is part of it - an
    // archived organization is not a valid place to act (rule 12).
    const targetOrganization = target.organizationId
      ? await this.organizations.getById(target.organizationId)
      : null

    this.ensureMayActAs(realUser, realRole, target, targetOrganization)

    const session = runDomain(
      startImpersonationSession,
      { id: randomUUID(), realUserId: realUser.id, targetUserId: target.id },
      now,
    )

    if (closedExisting) {
      await this.sessions.update(closedExisting)
    }
    await this.sessions.add(session)

    try {
      await this.unitOfWork.saveChanges()
    } catch (error) {
      if (isOpenSessionUniqueViolation(error)) {
        // The check above is a read-then-write, so two concurrent starts can both pass it. The
        // filtered unique index is what actually enforces non-nestability; this turns the
        // loser's constraint violation into the same 409 the caller would have gotten had it
        // seen the other session, instead of an opaque 500.
        throw new ConflictError(ALREADY_VIEWING_AS)
      }
      throw error
    }

    // Rule 13/14: attributed to the real administrator, naming the target - never the reverse.
    // A deliberate cast, not `attributeAudit(this.currentUser, ...)`: this runs BEFORE the
    // session exists, so `currentUser.isImpersonating` is still false here and the helper's
    // rewrite cannot fire regardless of which id is passed - it would fall through to
    // `(intendedActorUserId, null)`, dropping the target. The pair itself matches .NET's
    // `ViewAsService.AuditAsync`, which also built it directly rather than through the general
    // helper.
    const startAttribution = {
      actorUserId: realUser.id,
      onBehalfOfUserId: target.id,
    } as Attribution
    await this.writeLifecycleAudit(
      'ViewAsStarted',
      `${describe(realUser)} started viewing as ${describe(target)}.`,
      now,
      target.organizationId,
      target.id,
      startAttribution,
    )

    return {
      impersonating: summarize(target, targetOrganization),
      realUser: summarize(realUser, await this.realUserOrganization(realUser, targetOrganization)),
      startedAtUtc: session.startedAtUtc,
      expiresAtUtc: session.absoluteExpiresAtUtc,
    }
  }

  /**
   * The real administrator's own organization, for the `realUser` summary this call returns.
   *
   * A Site Admin belongs to none. An Org Admin may only act as a member of their own, so the
   * target's organization is already the answer and is already loaded - only the Site Admin case
   * could reach the fetch below, and it returns before it.
   */
  private async realUserOrganization(
    realUser: ImpersonationUserSummary,
    targetOrganization: ImpersonationOrganizationSummary | null,
  ): Promise<ImpersonationOrganizationSummary | null> {
    if (realUser.organizationId === null) {
      return null
    }
    if (realUser.organizationId === targetOrganization?.id) {
      return targetOrganization
    }
    return this.organizations.getById(realUser.organizationId)
  }

  /** Idempotent (contract): ending with no active session is a success, not an error. */
  async end(): Promise<void> {
    const { realUser } = await this.requireRealActor()

    const session = await this.sessions.getOpenForRealUser(realUser.id)
    if (!session) {
      return
    }

    const now = this.clock.now()
    const wasActive = isImpersonationSessionActiveAt(session, now)

    // A session that already timed out must not be recorded as a deliberate exit - endReason is
    // an accountability field, not a label for whichever code path happened to close the row.
    const ended = endImpersonationSession(
      session,
      now,
      wasActive
        ? ImpersonationEndReason.ExitedByUser
        : now.getTime() >= session.absoluteExpiresAtUtc.getTime()
          ? ImpersonationEndReason.AbsoluteTimeout
          : ImpersonationEndReason.IdleTimeout,
    )
    await this.sessions.update(ended)
    await this.unitOfWork.saveChanges()

    // Only audited when a live session actually ended. Closing an already-expired row is
    // bookkeeping, and auditing it would imply the admin was still acting when they were not.
    if (wasActive) {
      const target = await this.users.getById(session.targetUserId)

      // Rule 13/14: attributed to the real administrator, naming the target. No cast needed -
      // unlike `start`, `end` runs WHILE impersonating (the admin is exiting a live session), so
      // `currentUser.userId` is already the target's id. `attributeAudit` takes its
      // `isImpersonating` branch on that and returns exactly
      // `(currentUser.realUserId, currentUser.userId)` = `(realUserId, targetUserId)`.
      const endAttribution = attributeAudit(this.currentUser, this.currentUser.userId)
      await this.writeLifecycleAudit(
        'ViewAsEnded',
        `${describe(realUser)} stopped viewing as ${target ? describe(target) : 'a removed user'}.`,
        now,
        target?.organizationId ?? null,
        session.targetUserId,
        endAttribution,
      )
    }
  }

  async listCandidates(search: string | null): Promise<readonly ViewAsCandidate[]> {
    const { realUser, realRole } = await this.requireRealActor()

    if (realRole !== Role.SiteAdmin && realRole !== Role.OrgAdmin) {
      throw new ForbiddenError(NOT_ALLOWED)
    }

    // Scoped at the source: an Org Admin's query never reaches beyond their own organization, so
    // the list cannot leak users they may not target even before selectability is applied.
    const organizationId = realRole === Role.SiteAdmin ? null : realUser.organizationId
    const users = await this.users.searchForImpersonation(organizationId, search)

    // One lookup per distinct organization rather than per user: a Site Admin's list spans every
    // organization, and the naive form re-fetches the same one once for each of its members.
    const organizations = new Map<string, ImpersonationOrganizationSummary | null>()
    const candidates: ViewAsCandidate[] = []

    for (const user of users) {
      // D-SCOPE: Site Admins are never targets. They own no org content, so acting as a peer
      // grants nothing - and it would be a lateral move between equally-privileged accounts.
      if (user.role === Role.SiteAdmin || user.id === realUser.id || user.organizationId === null) {
        continue
      }

      let organization = organizations.get(user.organizationId)
      if (organization === undefined) {
        organization = await this.organizations.getById(user.organizationId)
        organizations.set(user.organizationId, organization)
      }

      // Inactive users are returned so the picker can show them greyed out (rule 21), but
      // `selectable` is false and `start` refuses them regardless of what the list showed.
      candidates.push({
        userId: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
        organizationName: organization?.title ?? '',
        selectable:
          user.status === UserStatus.Active && organization !== null && !organization.isArchived,
      })
    }

    return candidates
  }

  /**
   * The authorization matrix (rule 8). Every refusal this method makes returns the same message,
   * so a caller cannot tell an out-of-organization target from a Site Admin, an inactive account,
   * or an archived organization.
   *
   * Note the narrower scope: an id that names no user at all returns 404 from the caller, not
   * 403, exactly as SPEC/30-Contracts.md specifies - `start` throws that before this is reached.
   */
  private ensureMayActAs(
    realUser: ImpersonationUserSummary,
    realRole: Role,
    target: ImpersonationUserSummary,
    targetOrganization: ImpersonationOrganizationSummary | null,
  ): void {
    // The SiteAdmin clause is currently redundant: the domain forbids a Site Admin from having an
    // organization at all, so the null-organization clause below already rejects every one of
    // them. Kept deliberately - it states D-SCOPE at the point of enforcement rather than resting
    // on an invariant declared elsewhere.
    if (
      target.id === realUser.id ||
      target.role === Role.SiteAdmin || // D-SCOPE (see note above)
      target.organizationId === null || // not organization-scoped
      target.status !== UserStatus.Active || // rule 10 - Inactive, never "suspended"
      // Rule 12. The picker already greys these out, but that is presentation: a caller can POST
      // a target id directly, so the check has to exist here to be a control at all.
      targetOrganization === null ||
      targetOrganization.isArchived
    ) {
      throw new ForbiddenError(NOT_ALLOWED)
    }

    // Rule 11: checked against the caller's REAL role and organization. An Org Admin can never
    // reach outside their own organization by any path, including via an earlier session.
    if (realRole === Role.OrgAdmin && realUser.organizationId !== target.organizationId) {
      throw new ForbiddenError(NOT_ALLOWED)
    }
  }

  private async requireRealActor(): Promise<{
    realUser: ImpersonationUserSummary
    realRole: Role
  }> {
    if (!this.currentUser.isAuthenticated || this.currentUser.realUserId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    // Read from live state rather than from the acting context: while a session is live,
    // currentUser.role is the target's role, which must never decide impersonation rights.
    const realUser = await this.users.getById(this.currentUser.realUserId)
    if (!realUser) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    return { realUser, realRole: realUser.role }
  }

  /**
   * Writes one View As lifecycle audit event (rule 13: start and exit are audited
   * unconditionally). The `Attribution` is built by each caller rather than here, since `start`
   * and `end` need to reach it two different ways - see the comment at each call site.
   */
  private async writeLifecycleAudit(
    eventType: string,
    message: string,
    nowUtc: Date,
    organizationId: string | null,
    targetUserId: string,
    attribution: Attribution,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'User',
      entityId: targetUserId,
      message,
      occurredAtUtc: nowUtc,
      organizationId,
      attribution,
    })
  }
}

/** Same shape `GET /auth/me` returns, so a client can bind both with one type. */
function summarize(
  user: ImpersonationUserSummary,
  organization: ImpersonationOrganizationSummary | null,
): CurrentUserSummary {
  return {
    userId: user.id,
    organizationId: user.organizationId,
    organizationTitle: organization?.title ?? null,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    portraitDataUrl: null,
    viewingAs: null,
  }
}

function describe(user: ImpersonationUserSummary): string {
  return `${user.firstName} ${user.lastName}`.trim()
}

/**
 * Recognises the open-session unique-index violation without taking a dependency on any
 * driver-specific error type from the Application layer - matched on the constraint name, which
 * is stable and named in the raw-SQL migration that re-adds it (introspection drops it silently;
 * see SPEC/typescript-conversion-map/findings/05-prisma-introspection.md). Walks `.cause` the way
 * .NET's original walked `InnerException`, since Wave C's Prisma repository may wrap the
 * underlying driver error.
 */
function isOpenSessionUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  while (current instanceof Error) {
    if (current.message.includes(OPEN_SESSION_UNIQUE_CONSTRAINT)) {
      return true
    }
    current = current.cause
  }
  return false
}

/**
 * Wraps a domain transition so an `ImpersonationDomainError` (a plain-Error invariant violation -
 * packages/domain imports nothing, so it cannot throw the kernel's `ValidationError` itself)
 * surfaces as a proper field-level 400 rather than an unhandled 500, mirroring
 * ideas/idea.service.ts's `runDomain`. Unreachable today - `ensureMayActAs` already refuses a
 * self-target with a 403 before this is called - but the domain's own checks are defence in
 * depth, and a defence with no translation degrades straight to a 500 if that ever stops holding.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof ImpersonationDomainError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
