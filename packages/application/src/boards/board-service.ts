// Board configuration use cases (SPEC/20-feature-boards-and-statuses.md "Board Rules",
// SPEC/30-Contracts.md "Board Contracts"). Site Admin may manage any organization; Org Admin
// only their own. Listing and detail are available to any authenticated member of the
// organization; create/update/reorder are admin-only.

import { randomUUID } from 'node:crypto'
import {
  type Board,
  BoardInvariantError,
  createBoard,
  MIN_SWIMLANES,
  reorderBoardSwimlanes,
  updateBoard,
} from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import type { Status } from '@collega/domain/statuses'
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
import type { StatusRepository } from '../statuses/index.js'
import type {
  BoardDetail,
  BoardListItem,
  CreateBoardCommand,
  CreateBoardResult,
  ReorderSwimlanesCommand,
  SwimlaneDetail,
  SwimlaneInput,
  UpdateBoardCommand,
} from './models.js'
import type { BoardRepository, OrganizationExistenceLookup } from './ports.js'

export class BoardService {
  constructor(
    private readonly boards: BoardRepository,
    private readonly statuses: StatusRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(organizationId: string): Promise<readonly BoardListItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const boards = await this.boards.listByOrganization(organizationId)
    return [...boards].sort(compareBoardsForListing).map((board) => ({
      boardId: board.id,
      organizationId: board.organizationId,
      name: board.name,
      allowUserStatusUpdate: board.allowUserStatusUpdate,
      swimlaneCount: board.swimlanes.length,
    }))
  }

  async create(organizationId: string, command: CreateBoardCommand): Promise<CreateBoardResult> {
    this.ensureAdminScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const statusLookup = await this.loadStatusLookup(organizationId)
    const orderedStatusIds = validateAndOrderSwimlanes(command.swimlanes, statusLookup)

    const now = this.clock.now()
    const board = runDomain(createBoard, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      allowUserStatusUpdate: command.allowUserStatusUpdate,
      orderedStatusIds,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })
    await this.boards.add(board)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardCreated',
      organizationId,
      board.id,
      `Board '${board.name}' created.`,
      now,
      { name: board.name, swimlaneCount: board.swimlanes.length },
    )

    return {
      boardId: board.id,
      name: board.name,
      swimlanes: buildSwimlaneDetails(board, statusLookup),
    }
  }

  async getById(boardId: string): Promise<BoardDetail> {
    const board = await this.boards.getById(boardId)
    if (board === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureReadScope(board.organizationId)

    const statusLookup = await this.loadStatusLookup(board.organizationId)
    return toDetail(board, statusLookup)
  }

  async update(boardId: string, command: UpdateBoardCommand): Promise<BoardDetail> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    const statusLookup = await this.loadStatusLookup(existing.organizationId)
    const orderedStatusIds = validateAndOrderSwimlanes(command.swimlanes, statusLookup)

    const now = this.clock.now()
    const board = runDomain(
      updateBoard,
      existing,
      {
        name: command.name,
        allowUserStatusUpdate: command.allowUserStatusUpdate,
        orderedStatusIds,
      },
      now,
      this.currentUser.userId,
    )
    await this.boards.save(board)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardUpdated',
      board.organizationId,
      board.id,
      `Board '${board.name}' updated.`,
      now,
      { name: board.name, swimlaneCount: board.swimlanes.length },
    )

    return toDetail(board, statusLookup)
  }

  async reorderSwimlanes(boardId: string, command: ReorderSwimlanesCommand): Promise<void> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    const orderedStatusIds = orderSwimlaneInputs(command.swimlanes)
    if (new Set(orderedStatusIds).size !== orderedStatusIds.length) {
      throw new ValidationError('One or more fields are invalid.', {
        swimlanes: ['A board cannot list the same status twice.'],
      })
    }

    // A reorder cannot add or remove swimlanes - it must list exactly the current set.
    const current = new Set(existing.swimlanes.map((swimlane) => swimlane.statusId))
    const requested = new Set(orderedStatusIds)
    const sameSet =
      orderedStatusIds.length === current.size && [...requested].every((id) => current.has(id))
    if (!sameSet) {
      throw new ValidationError('One or more fields are invalid.', {
        swimlanes: ["A reorder must list exactly the board's current swimlane statuses."],
      })
    }

    const now = this.clock.now()
    const board = runDomain(
      reorderBoardSwimlanes,
      existing,
      orderedStatusIds,
      now,
      this.currentUser.userId,
    )
    await this.boards.save(board)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardSwimlanesReordered',
      board.organizationId,
      board.id,
      `Board '${board.name}' swimlanes reordered.`,
      now,
      null,
    )
  }

  private async loadStatusLookup(organizationId: string): Promise<ReadonlyMap<string, Status>> {
    // Include deleted so board detail can still surface a prior status name if one was later
    // removed (rule #8); create/update validation rejects deleted statuses separately.
    const statuses = await this.statuses.listByOrganization(organizationId, true)
    return new Map(statuses.map((status) => [status.id, status]))
  }

  private async ensureOrganizationExists(organizationId: string): Promise<void> {
    if (!(await this.organizations.existsById(organizationId))) {
      throw new NotFoundError('Organization not found.')
    }
  }

  private ensureReadScope(organizationId: string): void {
    const role = this.requireAuthenticatedRole()
    if (role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId === organizationId) {
      return
    }
    throw new NotFoundError('Board not found.')
  }

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
      throw new NotFoundError('Board not found.')
    }

    throw new ForbiddenError('You are not allowed to manage boards in this organization.')
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
    boardId: string,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'Board',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId: boardId,
      metadataJson: metadata === null ? null : JSON.stringify(metadata),
    })
  }
}

function orderSwimlaneInputs(swimlanes: readonly SwimlaneInput[]): readonly string[] {
  return [...swimlanes].sort((a, b) => a.order - b.order).map((swimlane) => swimlane.statusId)
}

/**
 * Normalizes the requested swimlanes to a dense, ordered list of status ids and validates the
 * 2-swimlane minimum, distinctness, and that every status is an active status of the
 * organization (subset support).
 */
function validateAndOrderSwimlanes(
  swimlanes: readonly SwimlaneInput[],
  statusLookup: ReadonlyMap<string, Status>,
): readonly string[] {
  const orderedStatusIds = orderSwimlaneInputs(swimlanes)

  if (orderedStatusIds.length < MIN_SWIMLANES) {
    throw new ValidationError('One or more fields are invalid.', {
      swimlanes: [`A board must have at least ${MIN_SWIMLANES} swimlanes.`],
    })
  }

  if (new Set(orderedStatusIds).size !== orderedStatusIds.length) {
    throw new ValidationError('One or more fields are invalid.', {
      swimlanes: ['A board cannot list the same status twice.'],
    })
  }

  for (const statusId of orderedStatusIds) {
    const status = statusLookup.get(statusId)
    if (status === undefined || status.isDeleted) {
      throw new ValidationError('One or more fields are invalid.', {
        swimlanes: ['Every swimlane must reference an active status in this organization.'],
      })
    }
  }

  return orderedStatusIds
}

/**
 * Wraps a domain transition so a `BoardInvariantError` (a plain-Error invariant violation -
 * packages/domain imports nothing, so it cannot throw the kernel's `ValidationError` itself)
 * surfaces as a proper field-level 400, mirroring how .NET let `Board`'s `ArgumentException`
 * reach the API only through a `ValidationAppException` raised in the service, never directly
 * (SPEC/decisions.md 2026-09-06 "Wave B conventions"; B3's `runDomain` is the reference).
 *
 * Takes `fn` and its arguments separately, rather than a `() => T` thunk, so a narrowed `let`
 * or `const` binding is read as a plain argument expression instead of inside a closure body.
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof BoardInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}

function toDetail(board: Board, statusLookup: ReadonlyMap<string, Status>): BoardDetail {
  return {
    boardId: board.id,
    organizationId: board.organizationId,
    name: board.name,
    allowUserStatusUpdate: board.allowUserStatusUpdate,
    swimlanes: buildSwimlaneDetails(board, statusLookup),
  }
}

function buildSwimlaneDetails(
  board: Board,
  statusLookup: ReadonlyMap<string, Status>,
): readonly SwimlaneDetail[] {
  return [...board.swimlanes]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((swimlane) => {
      const status = statusLookup.get(swimlane.statusId)
      return {
        statusId: swimlane.statusId,
        statusName: status?.name ?? '',
        statusColor: status?.color ?? '',
        order: swimlane.displayOrder,
        statusIsDeleted: status?.isDeleted ?? false,
      }
    })
}

/**
 * Total order for the board list: name, then creation time - never id. Nothing enforces unique
 * board names, so a name tie is possible; the golden capture's collision note found endpoints
 * elsewhere breaking such ties on generated id, which disagrees between two databases seeded
 * from the same data (SPEC/50-typescript-migration.md). Creation time is stable and meaningful
 * even though the .NET list only ordered by name.
 */
function compareBoardsForListing(a: Board, b: Board): number {
  const byName = compareStrings(a.name, b.name)
  if (byName !== 0) {
    return byName
  }
  return a.createdAtUtc.getTime() - b.createdAtUtc.getTime()
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
