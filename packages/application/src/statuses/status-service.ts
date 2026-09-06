// Status configuration use cases (SPEC/20-feature-boards-and-statuses.md "Status Rules",
// SPEC/30-Contracts.md "Status Contracts"). Site Admin may manage any organization; Org Admin
// only their own. Listing is available to any authenticated member of the organization because
// every board render needs the status catalog; create/update/delete/reorder are admin-only.

import { randomUUID } from 'node:crypto'
import type { BoardRepository } from '@collega/application/boards'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@collega/application/common'
import { Role } from '@collega/domain/enums'
import {
  createStatus,
  MIN_ACTIVE_STATUSES_PER_ORGANIZATION,
  type Status,
  setStatusSortOrder,
  softDeleteStatus,
  updateStatus,
} from '@collega/domain/statuses'
import type {
  CreateStatusCommand,
  CreateStatusResult,
  StatusItem,
  UpdateStatusCommand,
} from './models.js'
import type { OrganizationExistenceLookup, StatusRepository } from './ports.js'

const SORT_ORDER_STEP = 10

/** Fallback color for a status created without one (rules #4 and #9). */
const DEFAULT_STATUS_COLOR = '#64748B'

export class StatusService {
  constructor(
    private readonly statuses: StatusRepository,
    private readonly boards: BoardRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly auditWriter: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string, includeDeleted: boolean): Promise<readonly StatusItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const statuses = await this.statuses.listByOrganization(organizationId, includeDeleted)
    return [...statuses].sort(compareStatusesForListing).map(toItem)
  }

  async create(organizationId: string, command: CreateStatusCommand): Promise<CreateStatusResult> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const now = this.clock.now()
    const color = isBlank(command.color) ? DEFAULT_STATUS_COLOR : (command.color as string)
    const sortOrder = command.sortOrder ?? (await this.nextSortOrder(organizationId))

    const status = createStatus({
      id: randomUUID(),
      organizationId,
      name: command.name,
      color,
      sortOrder,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })
    await this.statuses.add(status)

    await this.audit(
      'StatusCreated',
      organizationId,
      status.id,
      `Status '${status.name}' created.`,
      now,
      { name: status.name, color: status.color, sortOrder: status.sortOrder },
    )

    return {
      statusId: status.id,
      name: status.name,
      color: status.color,
      sortOrder: status.sortOrder,
    }
  }

  async update(statusId: string, command: UpdateStatusCommand): Promise<StatusItem> {
    const existing = await this.statuses.getById(statusId)
    if (existing === null) {
      throw new NotFoundError('Status not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    // A soft-deleted status is not part of the active catalog; treat it as gone.
    if (existing.isDeleted) {
      throw new NotFoundError('Status not found.')
    }

    const now = this.clock.now()
    const color = isBlank(command.color) ? existing.color : (command.color as string)
    const sortOrder = command.sortOrder ?? existing.sortOrder

    const status = updateStatus(
      existing,
      { name: command.name, color, sortOrder },
      now,
      this.currentUser.userId,
    )
    await this.statuses.save(status)

    await this.audit(
      'StatusUpdated',
      status.organizationId,
      status.id,
      `Status '${status.name}' updated.`,
      now,
      { name: status.name, color: status.color, sortOrder: status.sortOrder },
    )

    return toItem(status)
  }

  /** Replaces the complete active-status order atomically; the list must name every active status exactly once. */
  async reorder(organizationId: string, orderedIds: readonly string[]): Promise<void> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const active = await this.statuses.listActiveByOrganization(organizationId)
    ensureReorderCoversActive(
      orderedIds,
      active.map((status) => status.id),
    )

    const now = this.clock.now()
    const byId = new Map(active.map((status) => [status.id, status] as const))
    for (const [index, id] of orderedIds.entries()) {
      const current = byId.get(id)
      if (current === undefined) {
        // Unreachable: ensureReorderCoversActive already proved orderedIds is a permutation of
        // byId's keys. Kept as a real error, not a silent skip, so a future change to that check
        // fails loudly instead of dropping a status's sort order.
        throw new ValidationError('Validation failed.', {
          orderedIds: ['The reorder must list every active status exactly once.'],
        })
      }
      const updated = setStatusSortOrder(
        current,
        (index + 1) * SORT_ORDER_STEP,
        now,
        this.currentUser.userId,
      )
      await this.statuses.save(updated)
    }

    await this.audit(
      'StatusesReordered',
      organizationId,
      organizationId,
      'Status order updated.',
      now,
      null,
    )
  }

  async delete(statusId: string): Promise<void> {
    const existing = await this.statuses.getById(statusId)
    if (existing === null) {
      throw new NotFoundError('Status not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    if (existing.isDeleted) {
      // Soft delete is idempotent.
      return
    }

    // Rule #7: an organization must retain at least 2 active statuses at all times. The status
    // being deleted is still active, so the current active count must exceed the floor.
    const activeCount = await this.statuses.countActiveByOrganization(existing.organizationId)
    if (activeCount <= MIN_ACTIVE_STATUSES_PER_ORGANIZATION) {
      throw new ValidationError('Validation failed.', {
        status: [
          `An organization must keep at least ${MIN_ACTIVE_STATUSES_PER_ORGANIZATION} active statuses; this status cannot be deleted.`,
        ],
      })
    }

    // Rule #6: a status referenced as a swimlane on any board cannot be soft-deleted.
    if (await this.boards.isStatusReferenced(statusId)) {
      throw new ValidationError('Validation failed.', {
        status: [
          'This status is used as a swimlane on a board and cannot be deleted until it is removed from that board.',
        ],
      })
    }

    const now = this.clock.now()
    const status = softDeleteStatus(existing, now, this.currentUser.userId)
    await this.statuses.save(status)

    await this.audit(
      'StatusDeleted',
      status.organizationId,
      status.id,
      `Status '${status.name}' soft-deleted.`,
      now,
      null,
    )
  }

  private async nextSortOrder(organizationId: string): Promise<number> {
    const existing = await this.statuses.listByOrganization(organizationId, true)
    if (existing.length === 0) {
      return SORT_ORDER_STEP
    }
    return Math.max(...existing.map((status) => status.sortOrder)) + SORT_ORDER_STEP
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  /** Site Admin (any org) or a member of the target organization (any role) may read the catalog. */
  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Organization not found.')
  }

  /** Site Admin (any org) or Org Admin (own org) may manage statuses (rule #2). */
  private ensureAdminScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()

    // Rule 25: a Site Admin acting as themselves may not mutate org-owned content - View As is
    // the path. No impersonation branch is needed: while a session is live this role is the
    // target's, so the guard does not fire. Read paths use ensureReadScope and are unaffected.
    ensureNotDirectSiteAdmin(this.currentUser)

    // No SiteAdmin pass-through below, deliberately: the guard above has already refused that
    // role, so a `return` here would be dead code that reads like a live bypass.
    if (role === Role.OrgAdmin) {
      if (this.currentUser.organizationId === organizationId) {
        return
      }
      throw new NotFoundError('Organization not found.')
    }

    throw new ForbiddenError('You are not allowed to manage statuses in this organization.')
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    organizationId: string,
    statusId: string,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditWriter.write({
      eventType,
      entityType: 'Status',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId: statusId,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
    })
  }
}

function isBlank(value: string | null): boolean {
  return value === null || value.trim().length === 0
}

function toItem(status: Status): StatusItem {
  return {
    statusId: status.id,
    organizationId: status.organizationId,
    name: status.name,
    color: status.color,
    sortOrder: status.sortOrder,
    isDeleted: status.isDeleted,
  }
}

function ensureReorderCoversActive(
  orderedIds: readonly string[],
  activeIds: readonly string[],
): void {
  const active = new Set(activeIds)
  const distinctCount = new Set(orderedIds).size
  const covers =
    orderedIds.length === active.size &&
    distinctCount === orderedIds.length &&
    orderedIds.every((id) => active.has(id))
  if (!covers) {
    throw new ValidationError('Validation failed.', {
      orderedIds: ['The reorder must list every active status exactly once.'],
    })
  }
}

/**
 * Total order for the status catalog: sortOrder, then name. Two statuses can share a sortOrder
 * (nothing enforces uniqueness on it), so the tie-break matters - and it must be something
 * stable and meaningful, not id, or two databases seeded from the same data can disagree on
 * which page a status lands on (SPEC/50-typescript-migration.md collision note).
 */
function compareStatusesForListing(a: Status, b: Status): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder
  }
  return compareStrings(a.name, b.name)
}

function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}
