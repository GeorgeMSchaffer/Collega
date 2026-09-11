// Sprint use cases (SPEC/20-feature-issues-and-delivery.md "Application Layer"). Management -
// create, update, start, complete, delete - is admin-only; reading the sprint list and one sprint
// is available to every member of the organization, because the sprint board and the delivery
// backlog are read by everyone including Read Only.
//
// Named `SprintService`, not `ISprintService` + an implementation: the spec is written in the C#
// idiom and this repository does not put an interface in front of a single implementation
// (CLAUDE.md).

import { randomUUID } from 'node:crypto'
import { DeliveryStatus, Role, type SprintState, UserStatus } from '@collega/domain/enums'
import { assignIdeaToSprint } from '@collega/domain/ideas'
import {
  completeSprint,
  createSprint,
  type Sprint,
  SprintInvariantError,
  softDeleteSprint,
  startSprint,
  updateSprint,
} from '@collega/domain/sprints'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type { CreateSprintCommand, SprintItem, UpdateSprintCommand } from './models.js'
import type {
  SprintIssueCounts,
  SprintIssuesPort,
  SprintRepository,
  SprintUsersPort,
} from './ports.js'

const NO_ISSUES: SprintIssueCounts = { issueCount: 0, doneCount: 0 }

export class SprintService {
  constructor(
    private readonly sprints: SprintRepository,
    private readonly issues: SprintIssuesPort,
    private readonly users: SprintUsersPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string, state: SprintState | null): Promise<readonly SprintItem[]> {
    this.ensureReadScope(organizationId)

    const sprints = await this.sprints.listByOrganization(organizationId, state)
    return this.project(sprints)
  }

  async get(organizationId: string, sprintId: string): Promise<SprintItem> {
    const sprint = await this.requireSprint(sprintId, organizationId)
    this.ensureReadScope(sprint.organizationId)

    const [item] = await this.project([sprint])
    // Unreachable: `project` returns one item per sprint given to it.
    if (!item) {
      throw new NotFoundError('Sprint not found.')
    }
    return item
  }

  async create(organizationId: string, command: CreateSprintCommand): Promise<SprintItem> {
    this.ensureAdminScope(organizationId)

    const now = this.clock.now()
    const ownerUserId = await this.resolveOwner(organizationId, command.ownerUserId)

    const sprint = runDomain(createSprint, {
      id: randomUUID(),
      organizationId,
      name: command.name ?? '',
      goal: command.goal,
      startDate: command.startDate ?? '',
      endDate: command.endDate ?? '',
      ownerUserId,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })

    await this.sprints.add(sprint)
    await this.unitOfWork.saveChanges()

    await this.audit('SprintCreated', sprint, `Sprint '${sprint.name}' created.`, now, {
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    })

    return toItem(sprint, NO_ISSUES, await this.ownerName(sprint.ownerUserId))
  }

  async update(
    organizationId: string,
    sprintId: string,
    command: UpdateSprintCommand,
  ): Promise<SprintItem> {
    const existing = await this.requireSprint(sprintId, organizationId)
    this.ensureAdminScope(existing.organizationId)

    const now = this.clock.now()
    const ownerUserId = await this.resolveOwner(existing.organizationId, command.ownerUserId)

    const sprint = runDomain(
      updateSprint,
      existing,
      {
        name: command.name ?? '',
        goal: command.goal,
        startDate: command.startDate ?? '',
        endDate: command.endDate ?? '',
        ownerUserId,
      },
      now,
      this.currentUser.userId,
    )

    await this.sprints.save(sprint)
    await this.unitOfWork.saveChanges()

    await this.audit('SprintUpdated', sprint, `Sprint '${sprint.name}' updated.`, now, {
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    })

    const [item] = await this.project([sprint])
    if (!item) {
      throw new NotFoundError('Sprint not found.')
    }
    return item
  }

  async start(organizationId: string, sprintId: string): Promise<void> {
    const existing = await this.requireSprint(sprintId, organizationId)
    this.ensureAdminScope(existing.organizationId)

    const now = this.clock.now()
    const sprint = runDomain(startSprint, existing, now, this.currentUser.userId)

    await this.sprints.save(sprint)
    await this.unitOfWork.saveChanges()

    await this.audit('SprintStarted', sprint, `Sprint '${sprint.name}' started.`, now, null)
  }

  /**
   * `Active -> Completed`, with carry-over: every Issue in the sprint whose delivery status is not
   * `Complete` goes back to the delivery backlog.
   *
   * Backlog rather than "the next sprint" is the chosen default (spec Open Questions); carry-over-
   * to-next is P1. The sprint transition and every unassignment are staged and committed together,
   * so a sprint can never end up `Completed` with unfinished Issues still pointing at it.
   */
  async complete(organizationId: string, sprintId: string): Promise<void> {
    const existing = await this.requireSprint(sprintId, organizationId)
    this.ensureAdminScope(existing.organizationId)

    const now = this.clock.now()
    const sprint = runDomain(completeSprint, existing, now, this.currentUser.userId)

    const assigned = await this.issues.listBySprint(sprint.id)
    const carriedOver = assigned.filter((idea) => idea.deliveryStatus !== DeliveryStatus.Complete)
    for (const idea of carriedOver) {
      await this.issues.update(assignIdeaToSprint(idea, null, now, this.currentUser.userId))
    }

    await this.sprints.save(sprint)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'SprintCompleted',
      sprint,
      `Sprint '${sprint.name}' completed with ${carriedOver.length} issue(s) returned to the backlog.`,
      now,
      { carriedOverIssueCount: carriedOver.length, carriedOverIssueIds: carriedOver.map(idOf) },
    )
  }

  /** Soft-delete. Every assigned Issue is unassigned to the backlog first - no Issue is ever
   * deleted with a sprint, and the `ideas.sprint_id` foreign key is `ON DELETE RESTRICT` precisely
   * so that unassignment cannot be skipped. */
  async delete(organizationId: string, sprintId: string): Promise<void> {
    const existing = await this.requireSprint(sprintId, organizationId)
    this.ensureAdminScope(existing.organizationId)

    if (existing.isDeleted) {
      return
    }

    const now = this.clock.now()
    const assigned = await this.issues.listBySprint(existing.id)
    for (const idea of assigned) {
      await this.issues.update(assignIdeaToSprint(idea, null, now, this.currentUser.userId))
    }

    const sprint = runDomain(softDeleteSprint, existing, now, this.currentUser.userId)
    await this.sprints.save(sprint)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'SprintDeleted',
      sprint,
      `Sprint '${sprint.name}' deleted; ${assigned.length} issue(s) returned to the backlog.`,
      now,
      { unassignedIssueCount: assigned.length },
    )
  }

  // Projection ---------------------------------------------------------------------------------

  private async project(sprints: readonly Sprint[]): Promise<readonly SprintItem[]> {
    if (sprints.length === 0) {
      return []
    }

    // Two batched reads for the whole page, not two per row.
    const counts = await this.issues.countsBySprintIds(sprints.map(idOf))
    const ownerIds = [...new Set(sprints.flatMap((s) => (s.ownerUserId ? [s.ownerUserId] : [])))]
    const owners = ownerIds.length > 0 ? await this.users.listByIds(ownerIds) : []
    const ownerNames = new Map(owners.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]))

    return sprints.map((sprint) =>
      toItem(
        sprint,
        counts.get(sprint.id) ?? NO_ISSUES,
        sprint.ownerUserId ? (ownerNames.get(sprint.ownerUserId) ?? null) : null,
      ),
    )
  }

  private async ownerName(ownerUserId: string | null): Promise<string | null> {
    if (!ownerUserId) {
      return null
    }
    const [owner] = await this.users.listByIds([ownerUserId])
    return owner ? `${owner.firstName} ${owner.lastName}`.trim() : null
  }

  // Resolution ---------------------------------------------------------------------------------

  /** An owner, when named, must be an active user in the sprint's organization - the same rule
   * assignee selection applies, and for the same reason: a sprint owned by somebody who has left
   * or belongs elsewhere is a dangling reference nothing else will catch. */
  private async resolveOwner(
    organizationId: string,
    ownerUserId: string | null,
  ): Promise<string | null> {
    const trimmed = ownerUserId?.trim()
    if (!trimmed) {
      return null
    }

    const [owner] = await this.users.listByIds([trimmed])
    if (!owner || owner.organizationId !== organizationId || owner.status !== UserStatus.Active) {
      throw new ValidationError('One or more fields are invalid.', {
        ownerUserId: ['Owner must be an active user in this organization.'],
      })
    }
    return owner.id
  }

  // Authorization / scoping ---------------------------------------------------------------------

  /**
   * Cross-tenant reads answer 404, never 403: a 403 would confirm the sprint exists in somebody
   * else's organization, which is exactly what the caller is fishing for.
   */
  private async requireSprint(sprintId: string, organizationId: string): Promise<Sprint> {
    const sprint = await this.sprints.getById(sprintId)
    if (!sprint || sprint.isDeleted || sprint.organizationId !== organizationId) {
      throw new NotFoundError('Sprint not found.')
    }
    return sprint
  }

  /** Any member of the organization may read sprints (spec Permissions: "View Sprint board,
   * backlog, and provenance" is ticked for every role, Read Only included). */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Sprint not found.')
  }

  /** Sprint management is admin-only. Mirrors `StatusService.ensureAdminScope`, including rule 25:
   * a Site Admin acting as themselves may not mutate organization content - View As is the path,
   * and while a View As session is live the role here is the target's, so the guard does not fire. */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    if (role === Role.OrgAdmin) {
      if (this.currentUser.organizationId === organizationId) {
        return
      }
      throw new NotFoundError('Sprint not found.')
    }

    throw new ForbiddenError('You are not allowed to manage sprints in this organization.')
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    sprint: Sprint,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'Sprint',
      message,
      occurredAtUtc,
      organizationId: sprint.organizationId,
      // Rule 14: while acting as someone, the real administrator is the actor.
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: sprint.id,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
    })
  }
}

function idOf(entity: { readonly id: string }): string {
  return entity.id
}

function toItem(
  sprint: Sprint,
  counts: SprintIssueCounts,
  ownerDisplayName: string | null,
): SprintItem {
  return {
    sprintId: sprint.id,
    organizationId: sprint.organizationId,
    name: sprint.name,
    goal: sprint.goal,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    ownerUserId: sprint.ownerUserId,
    ownerDisplayName,
    state: sprint.state,
    issueCount: counts.issueCount,
    doneCount: counts.doneCount,
  }
}

/** Surfaces a `SprintInvariantError` as the field-keyed 400 the contract answers, exactly as
 * `StatusService.runDomain` does for `StatusInvariantError`. */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof SprintInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
