import { ImpersonationEndReason, Role, UserStatus } from '@collega/domain/enums'
import {
  endImpersonationSession,
  IMPERSONATION_IDLE_TIMEOUT_MS,
  type ImpersonationSession,
  isImpersonationSessionActiveAt,
  touchImpersonationSession,
} from '@collega/domain/impersonation'
import type { User } from '@collega/domain/users'
import type { AuthenticatedPrincipal, ImpersonationContext } from '../auth/models.js'
import type { ImpersonationResolver } from '../auth/ports.js'
import type { UnitOfWork } from '../common/index.js'
import type {
  ImpersonationOrganizationsPort,
  ImpersonationSessionRepository,
  ImpersonationUsersPort,
} from './ports.js'

/**
 * A quarter of the idle window (SPEC/typescript-conversion-map/findings/07-nest-ambient-identity.md
 * §5): small enough that expiry stays accurate to within a few minutes, large enough that a burst
 * of parallel requests in one session writes `lastSeenAtUtc` at most once. Mirrors .NET's
 * `TokenAuthenticationService.IdleRefreshInterval`.
 */
const IDLE_REFRESH_INTERVAL_MS = IMPERSONATION_IDLE_TIMEOUT_MS / 4

/**
 * Resolves the live View As session for a real user, if any, into the `AuthenticatedPrincipal`
 * every downstream check reads (SPEC/20-feature-view-as.md rule 4). This is the concrete
 * implementation of `ImpersonationResolver` (`../auth/ports.js`) - the extension point B1 carved
 * out specifically because `IImpersonationSessionRepository` and `ImpersonationSession` belong to
 * this isolated slice rather than to `TokenAuthenticationService`'s own package.
 *
 * A direct port of .NET's `TokenAuthenticationService.ResolveImpersonationAsync`: the same five
 * checks, in the same order (absolute expiry, idle expiry, target still Active, target's
 * organization not archived, and the real user still satisfying the rule 8 matrix), and the same
 * throttled idle-refresh write.
 */
export class ImpersonationSessionResolver implements ImpersonationResolver {
  constructor(
    private readonly sessions: ImpersonationSessionRepository,
    private readonly users: ImpersonationUsersPort,
    private readonly organizations: ImpersonationOrganizationsPort,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async resolveActingPrincipal(
    realUser: User,
    nowUtc: Date,
  ): Promise<AuthenticatedPrincipal | null> {
    const session = await this.sessions.getOpenForRealUser(realUser.id)
    if (!session) {
      return null
    }

    // Rule 18: expiry is decided here, server-side. An expired-but-open row is closed with the
    // reason recorded rather than merely ignored, so the audit trail shows why it ended.
    if (!isImpersonationSessionActiveAt(session, nowUtc)) {
      await this.close(
        session,
        nowUtc,
        nowUtc.getTime() >= session.absoluteExpiresAtUtc.getTime()
          ? ImpersonationEndReason.AbsoluteTimeout
          : ImpersonationEndReason.IdleTimeout,
      )
      return null
    }

    const target = await this.users.getById(session.targetUserId)

    // Rule 12 has two halves, and both have to be checked here. A deactivated target is the
    // obvious one; an archived organization is the one that is easy to miss, because the target
    // stays Active - archiving decommissions the organization without touching its users. Acting
    // inside an archived organization has to stop at the next request, not merely at expiry.
    const targetOrganization = target?.organizationId
      ? await this.organizations.getById(target.organizationId)
      : null

    if (
      !target ||
      target.status !== UserStatus.Active ||
      !targetOrganization ||
      targetOrganization.isArchived
    ) {
      await this.close(session, nowUtc, ImpersonationEndReason.TargetNoLongerValid)
      return null
    }

    // Rule 11 is a per-request guarantee, not a start-time one. Nothing rotates the security
    // stamp when an administrator is demoted, so their token stays valid - and without this check
    // a demoted admin would keep operating with the target's elevated identity until the 2-hour
    // cap. The matrix is re-applied against the real user's CURRENT role, deliberately mirroring
    // ViewAsService.ensureMayActAs: if the two ever disagree, a session could outlive the
    // authority that created it.
    // `targetOrganization.id` rather than `target.organizationId`: both name the same
    // organization here, but only the former is known non-null to the type checker at this
    // point - the guard above already proved it by returning whenever `targetOrganization` was
    // null.
    if (!mayStillActAs(realUser, targetOrganization.id)) {
      await this.close(session, nowUtc, ImpersonationEndReason.RealUserNoLongerAuthorized)
      return null
    }

    // Idle tracking does not need per-request precision - refreshing only once the recorded time
    // is more than a quarter of the idle window old keeps the same expiry behaviour while
    // collapsing what would otherwise be a write on every authenticated request during a session.
    if (nowUtc.getTime() - session.lastSeenAtUtc.getTime() > IDLE_REFRESH_INTERVAL_MS) {
      await this.sessions.update(touchImpersonationSession(session, nowUtc))
      await this.unitOfWork.saveChanges()
    }

    // Every identity field is the target's: this is what makes org-scoping and role checks
    // downstream apply to the impersonated user with no per-service special-casing (rule 4).
    // mustChangePassword is deliberately the REAL user's own - an admin acting as someone must
    // not inherit that user's rotation gate, and cannot have their own suppressed by it.
    const impersonation: ImpersonationContext = {
      realUserId: realUser.id,
      realUserFirstName: realUser.firstName,
      realUserLastName: realUser.lastName,
      startedAtUtc: session.startedAtUtc,
      expiresAtUtc: session.absoluteExpiresAtUtc,
    }

    return {
      userId: target.id,
      organizationId: target.organizationId,
      role: target.role,
      firstName: target.firstName,
      lastName: target.lastName,
      email: target.email,
      status: target.status,
      mustChangePassword: realUser.mustChangePassword,
      impersonation,
    }
  }

  private async close(
    session: ImpersonationSession,
    nowUtc: Date,
    reason: ImpersonationEndReason,
  ): Promise<void> {
    await this.sessions.update(endImpersonationSession(session, nowUtc, reason))
    await this.unitOfWork.saveChanges()
  }
}

function mayStillActAs(realUser: User, targetOrganizationId: string): boolean {
  if (realUser.status !== UserStatus.Active) {
    return false
  }

  switch (realUser.role) {
    case Role.SiteAdmin:
      return true
    case Role.OrgAdmin:
      return realUser.organizationId !== null && realUser.organizationId === targetOrganizationId
    default:
      // User and Read Only may never act as anyone.
      return false
  }
}
