// Board configuration use cases (SPEC/20-feature-boards-and-statuses.md "Board Rules",
// SPEC/30-Contracts.md "Board Contracts"). Site Admin may manage any organization; Org Admin
// only their own. Listing and detail are available to any authenticated member of the
// organization; create/update/reorder are admin-only.

import { randomUUID } from 'node:crypto'
import {
  archiveBoard,
  type Board,
  BoardArchivedError,
  BoardInvariantError,
  createBoard,
  MIN_SWIMLANES,
  reorderBoardSwimlanes,
  unarchiveBoard,
  updateBoard,
} from '@collega/domain/boards'
import { Role } from '@collega/domain/enums'
import type { Status } from '@collega/domain/statuses'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  ConflictError,
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
  BoardListQuery,
  BoardTagCount,
  CreateBoardCommand,
  CreateBoardResult,
  IdeaMoveInput,
  ReorderSwimlanesCommand,
  SwimlaneDetail,
  SwimlaneInput,
  UpdateBoardCommand,
} from './models.js'
import type { BoardRepository, LaneIdea, OrganizationExistenceLookup } from './ports.js'

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

  async list(
    organizationId: string,
    query: BoardListQuery = { includeArchived: false },
  ): Promise<readonly BoardListItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const boards = (await this.boards.listByOrganization(organizationId)).filter(
      (board) => query.includeArchived || !board.isArchived,
    )
    // One query for every board's idea count. The client used to ask each board's idea endpoint
    // for a single row and read `totalCount` off the envelope, which is one round trip per board
    // from one render - fine at four boards, two hundred concurrent requests at two hundred.
    // The card aggregates follow the same rule: a fixed number of grouped reads for the whole
    // list, never one per board.
    const boardIds = boards.map((board) => board.id)
    const creatorIds = [...new Set(boards.flatMap((board) => board.createdByUserId ?? []))]
    const [ideaCounts, statusCounts, tagCounts, creatorNames, statusLookup] = await Promise.all([
      this.boards.countIdeasByBoard(boardIds),
      this.boards.countIdeasByBoardAndStatus(boardIds),
      this.boards.countIdeasByBoardAndTag(boardIds),
      this.boards.getUserNames(creatorIds),
      this.loadStatusLookup(organizationId),
    ])

    const laneIdeaCounts = new Map(
      statusCounts.map((row) => [laneKey(row.boardId, row.statusId), row.ideaCount]),
    )
    const tagsByBoard = new Map<string, BoardTagCount[]>()
    for (const row of tagCounts) {
      const tags = tagsByBoard.get(row.boardId) ?? []
      tags.push({ name: row.tagName, ideaCount: row.ideaCount, color: row.tagColor })
      tagsByBoard.set(row.boardId, tags)
    }

    return [...boards].sort(compareBoardsForListing).map((board) => {
      const tags = tagsByBoard.get(board.id) ?? []
      const creatorName =
        board.createdByUserId === null ? undefined : creatorNames.get(board.createdByUserId)
      return {
        boardId: board.id,
        organizationId: board.organizationId,
        name: board.name,
        allowUserStatusUpdate: board.allowUserStatusUpdate,
        swimlaneCount: board.swimlanes.length,
        ideaCount: ideaCounts.get(board.id) ?? 0,
        description: board.description,
        createdAtUtc: board.createdAtUtc,
        createdBy:
          board.createdByUserId === null || creatorName === undefined
            ? null
            : {
                userId: board.createdByUserId,
                displayName: `${creatorName.firstName} ${creatorName.lastName}`.trim(),
              },
        laneCounts: buildSwimlaneDetails(board, statusLookup).map((lane) => ({
          statusId: lane.statusId,
          statusName: lane.statusName,
          statusColor: lane.statusColor,
          order: lane.order,
          ideaCount: laneIdeaCounts.get(laneKey(board.id, lane.statusId)) ?? 0,
        })),
        topTags: [...tags].sort(compareTagsForCard).slice(0, TOP_TAG_LIMIT),
        tagCount: tags.length,
        isArchived: board.isArchived,
        archivedAtUtc: board.archivedAtUtc,
      }
    })
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
      description: command.description ?? null,
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
        description: command.description,
        allowUserStatusUpdate: command.allowUserStatusUpdate,
        orderedStatusIds,
      },
      now,
      this.currentUser.userId,
    )
    const moves = await this.planIdeaMoves(existing, board, command.ideaMoves ?? [], statusLookup)

    await this.boards.save(board)
    for (const move of moves) {
      await this.boards.moveIdeas(
        board.id,
        move.ideas.map((idea) => idea.ideaId),
        move.toStatusId,
        now,
        this.currentUser.userId,
      )
    }
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardUpdated',
      board.organizationId,
      board.id,
      `Board '${board.name}' updated.`,
      now,
      {
        name: board.name,
        swimlaneCount: board.swimlanes.length,
        ...(moves.length === 0
          ? {}
          : {
              ideaMoves: moves.map((move) => ({
                fromStatusId: move.fromStatusId,
                toStatusId: move.toStatusId,
                ideaCount: move.ideas.length,
              })),
            }),
      },
    )
    // One entry per moved idea, in the shape a move on the board writes, so an idea's history
    // reads the same however it changed lanes.
    for (const move of moves) {
      for (const idea of move.ideas) {
        await this.auditIdeaMove(board.organizationId, idea, move.toStatusId, now)
      }
    }

    return toDetail(board, statusLookup)
  }

  /**
   * A save that removes a lane still holding live ideas must say where they go
   * (SPEC/20-feature-boards-and-statuses.md rule 14): otherwise they would keep a status that is
   * no longer a column and drop off the board. Each move names a lane this save removes and a lane
   * the saved board keeps; a removed lane with ideas and no move is refused, and so is a move that
   * could not apply. A move from a removed lane that turns out to be empty is harmless and ignored.
   */
  private async planIdeaMoves(
    existing: Board,
    updated: Board,
    requested: readonly IdeaMoveInput[],
    statusLookup: ReadonlyMap<string, Status>,
  ): Promise<readonly PlannedIdeaMove[]> {
    const kept = new Set(updated.swimlanes.map((swimlane) => swimlane.statusId))
    const removed = existing.swimlanes
      .map((swimlane) => swimlane.statusId)
      .filter((statusId) => !kept.has(statusId))

    const targets = new Map<string, string>()
    for (const move of requested) {
      if (!removed.includes(move.fromStatusId)) {
        throw invalidIdeaMoves(['A move must come from a lane this save removes.'])
      }
      if (targets.has(move.fromStatusId)) {
        throw invalidIdeaMoves(['A removed lane can move its ideas to one lane only.'])
      }
      if (!kept.has(move.toStatusId)) {
        throw invalidIdeaMoves(['Ideas can only move to a lane that stays on the board.'])
      }
      targets.set(move.fromStatusId, move.toStatusId)
    }

    if (removed.length === 0) {
      return []
    }

    const ideas = await this.boards.listLaneIdeas(existing.id, removed)
    const planned: PlannedIdeaMove[] = []
    const unplaced: string[] = []
    for (const fromStatusId of removed) {
      const laneIdeas = ideas.filter((idea) => idea.statusId === fromStatusId)
      if (laneIdeas.length === 0) {
        continue
      }
      const toStatusId = targets.get(fromStatusId)
      if (toStatusId === undefined) {
        const name = statusLookup.get(fromStatusId)?.name ?? 'A removed lane'
        const [count, them] =
          laneIdeas.length === 1 ? ['1 idea', 'it'] : [`${laneIdeas.length} ideas`, 'them']
        unplaced.push(
          `'${name}' still holds ${count}. Choose a lane that stays on the board to move ${them} to.`,
        )
        continue
      }
      planned.push({ fromStatusId, toStatusId, ideas: laneIdeas })
    }
    if (unplaced.length > 0) {
      throw invalidIdeaMoves(unplaced)
    }
    return planned
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

  /**
   * Archives a board in place of deleting it (SPEC/20-feature-boards-and-statuses.md rule 13):
   * Org Admin of its organization only, and a direct Site Admin is refused like every other
   * org-content write. Archiving an archived board succeeds and changes nothing.
   */
  async archive(boardId: string): Promise<void> {
    await this.setArchived(boardId, archiveBoard, 'BoardArchived', 'archived')
  }

  /** Brings an archived board back unchanged. Unarchiving an active board changes nothing. */
  async unarchive(boardId: string): Promise<void> {
    await this.setArchived(boardId, unarchiveBoard, 'BoardUnarchived', 'unarchived')
  }

  private async setArchived(
    boardId: string,
    transition: (board: Board, nowUtc: Date, actorUserId: string | null) => Board,
    eventType: string,
    verb: string,
  ): Promise<void> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    const now = this.clock.now()
    const board = transition(existing, now, this.currentUser.userId)
    if (board === existing) {
      return
    }
    await this.boards.save(board)
    await this.unitOfWork.saveChanges()

    await this.audit(
      eventType,
      board.organizationId,
      board.id,
      `Board '${board.name}' ${verb}.`,
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

  /** The `IdeaStatusChanged` entry `IdeaService.changeStatus` writes, attributed the same way. */
  private async auditIdeaMove(
    organizationId: string,
    idea: LaneIdea,
    toStatusId: string,
    occurredAtUtc: Date,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType: 'IdeaStatusChanged',
      entityType: 'Idea',
      message: `Idea '${idea.title}' moved to a new status.`,
      occurredAtUtc,
      organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: idea.ideaId,
      metadataJson: JSON.stringify({ fromStatusId: idea.statusId, toStatusId }),
    })
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

type PlannedIdeaMove = {
  readonly fromStatusId: string
  readonly toStatusId: string
  readonly ideas: readonly LaneIdea[]
}

function invalidIdeaMoves(messages: readonly string[]): ValidationError {
  return new ValidationError('One or more fields are invalid.', { ideaMoves: [...messages] })
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
    if (error instanceof BoardArchivedError) {
      throw new ConflictError(error.message)
    }
    throw error
  }
}

function toDetail(board: Board, statusLookup: ReadonlyMap<string, Status>): BoardDetail {
  return {
    boardId: board.id,
    organizationId: board.organizationId,
    name: board.name,
    description: board.description,
    allowUserStatusUpdate: board.allowUserStatusUpdate,
    swimlanes: buildSwimlaneDetails(board, statusLookup),
    isArchived: board.isArchived,
    archivedAtUtc: board.archivedAtUtc,
  }
}

const TOP_TAG_LIMIT = 3

function laneKey(boardId: string, statusId: string): string {
  return `${boardId}:${statusId}`
}

/** Most-used first; a count tie reads alphabetically, ignoring case, then by exact spelling. */
function compareTagsForCard(a: BoardTagCount, b: BoardTagCount): number {
  return (
    b.ideaCount - a.ideaCount ||
    compareStrings(a.name.toLowerCase(), b.name.toLowerCase()) ||
    compareStrings(a.name, b.name)
  )
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
