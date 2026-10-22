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
  boardTakesIdeaType,
  createBoard,
  disableIdeaFeatures,
  MIN_SWIMLANES,
  reorderBoardSwimlanes,
  type SwimlaneLane,
  setAllowedIdeaTypes,
  unarchiveBoard,
  updateBoard,
} from '@collega/domain/boards'
import { IdeaPhase, Role } from '@collega/domain/enums'
import { type Idea, pullIdeaOntoBoard } from '@collega/domain/ideas'
import type { Status } from '@collega/domain/statuses'
import { normalizeTagName } from '@collega/domain/tags'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  ConflictError,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  normalizePageRequest,
  UnauthorizedError,
  type UnitOfWork,
  UnprocessableError,
  ValidationError,
} from '../common/index.js'
import {
  type AutoCreateTaskParent,
  IDEA_MOVED_PAST_OPEN_TASKS,
  type IdeaRepository,
  movedPastOpenTasksAudit,
  openTasksHoldingExit,
  readForceReason,
} from '../ideas/index.js'
import type { StatusRepository } from '../statuses/index.js'
import type {
  BoardDetail,
  BoardListItem,
  BoardListQuery,
  BoardTagCount,
  CreateBoardCommand,
  CreateBoardResult,
  IdeaMoveInput,
  PullCandidatePage,
  PullCandidateSource,
  PullCandidatesQuery,
  PulledItem,
  ReorderSwimlanesCommand,
  SetAllowedIdeaTypesCommand,
  SwimlaneDetail,
  SwimlaneInput,
  UpdateBoardCommand,
  UpdateBoardResult,
} from './models.js'
import type {
  AutoCreateTaskPort,
  BoardIdeaType,
  BoardRepository,
  LaneIdea,
  OrganizationExistenceLookup,
} from './ports.js'

export class BoardService {
  constructor(
    private readonly boards: BoardRepository,
    private readonly statuses: StatusRepository,
    private readonly organizations: OrganizationExistenceLookup,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly ideas: IdeaRepository,
    private readonly tasks: AutoCreateTaskPort,
  ) {}

  async list(
    organizationId: string,
    query: BoardListQuery = { includeArchived: false },
  ): Promise<readonly BoardListItem[]> {
    this.ensureReadScope(organizationId)
    await this.ensureOrganizationExists(organizationId)

    const organizationBoards = await this.boards.listByOrganization(organizationId)
    const boards = organizationBoards.filter((board) => query.includeArchived || !board.isArchived)
    // Lanes arrive with the boards, so the reference links cost no further read.
    const referencedBy = new Map<string, string[]>()
    for (const board of organizationBoards) {
      if (board.isArchived) continue
      for (const targetId of new Set(
        board.swimlanes.flatMap((lane) => lane.referencesBoardId ?? []),
      )) {
        referencedBy.set(targetId, [...(referencedBy.get(targetId) ?? []), board.id])
      }
    }
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
        keyPrefix: board.keyPrefix,
        sprintsEnabled: board.sprintsEnabled,
        ideaFeaturesEnabled: board.ideaFeaturesEnabled,
        nextItemNumber: board.nextItemNumber,
        hasReferenceLane: board.swimlanes.some((lane) => lane.referencesBoardId !== null),
        referencedByBoardIds: referencedBy.get(board.id) ?? [],
      }
    })
  }

  async create(organizationId: string, command: CreateBoardCommand): Promise<CreateBoardResult> {
    const role = this.ensureCreateScope(organizationId)
    const forceReason = readForceReason(command.forceReason, role)
    await this.ensureOrganizationExists(organizationId)

    const statusLookup = await this.loadStatusLookup(organizationId)
    const orderedLanes = validateAndOrderSwimlanes(command.swimlanes, statusLookup)
    const allowedIdeaTypeIds =
      (command.allowedIdeaTypeIds ?? []).length === 0
        ? []
        : validateAllowedIdeaTypeIds(
            'allowedIdeaTypeIds',
            command.allowedIdeaTypeIds ?? [],
            await this.boards.listIdeaTypes(organizationId),
          )

    const now = this.clock.now()
    const board = runDomain(createBoard, {
      id: randomUUID(),
      organizationId,
      name: command.name,
      description: command.description ?? null,
      allowUserStatusUpdate: command.allowUserStatusUpdate,
      orderedLanes,
      keyPrefix: command.keyPrefix,
      sprintsEnabled: command.sprintsEnabled,
      ideaFeaturesEnabled: command.ideaFeaturesEnabled,
      allowedIdeaTypeIds,
      nowUtc: now,
      actorUserId: this.currentUser.userId,
    })
    const organizationBoards = await this.boards.listByOrganization(organizationId)
    ensureKeyPrefixFree(board, organizationBoards)
    const newTargets = planReferences(board, organizationBoards)
    const pull = await this.planPull(
      organizationId,
      board,
      command.pullItemIds ?? [],
      forceReason,
      now,
    )
    await this.boards.add(board)
    await this.disableTargetIdeaFeatures(newTargets, now)
    if (pull !== null) {
      await this.stagePull(board.id, pull, now)
    }
    const finishTasks = await this.stageAutoCreatedTasks(board, pulledEntries(pull))
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardCreated',
      organizationId,
      board.id,
      `Board '${board.name}' created.`,
      now,
      { name: board.name, swimlaneCount: board.swimlanes.length, ...pullAuditCounts(pull) },
    )
    await this.auditPull(organizationId, board, pull, now)
    for (const finish of finishTasks) {
      await finish()
    }

    return {
      boardId: board.id,
      name: board.name,
      swimlanes: buildSwimlaneDetails(board, statusLookup),
      ...pulledItemsOf(pull),
    }
  }

  async getById(boardId: string): Promise<BoardDetail> {
    const board = await this.boards.getById(boardId)
    if (board === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureReadScope(board.organizationId)

    const statusLookup = await this.loadStatusLookup(board.organizationId)
    return toDetail(board, statusLookup, this.canSetAllowedIdeaTypes(board))
  }

  /**
   * Replaces the idea types the board takes (SPEC/contracts/boards.md "Allowed idea types"). Taken
   * while Idea features are off too: the list is stored, and applies once they are on. Ideas
   * already on the board keep their type. Audited as `BoardUpdated`; no notification.
   */
  async setAllowedIdeaTypes(
    boardId: string,
    command: SetAllowedIdeaTypesCommand,
  ): Promise<BoardDetail> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }
    this.ensureAllowedIdeaTypesScope(existing)

    const ideaTypeIds = validateAllowedIdeaTypeIds(
      'ideaTypeIds',
      command.ideaTypeIds,
      await this.boards.listIdeaTypes(existing.organizationId),
    )
    const now = this.clock.now()
    const board = runDomain(
      setAllowedIdeaTypes,
      existing,
      ideaTypeIds,
      now,
      this.currentUser.userId,
    )
    await this.boards.replaceAllowedIdeaTypes(board)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'BoardUpdated',
      board.organizationId,
      board.id,
      `Board '${board.name}' updated.`,
      now,
      { name: board.name, swimlaneCount: board.swimlanes.length, allowedIdeaTypeIds: ideaTypeIds },
    )

    const statusLookup = await this.loadStatusLookup(board.organizationId)
    return toDetail(board, statusLookup, this.canSetAllowedIdeaTypes(board))
  }

  async update(boardId: string, command: UpdateBoardCommand): Promise<UpdateBoardResult> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)
    const forceReason = readForceReason(command.forceReason, this.requireAuthenticatedRole())

    const statusLookup = await this.loadStatusLookup(existing.organizationId)
    const orderedLanes = validateAndOrderSwimlanes(command.swimlanes, statusLookup)

    const now = this.clock.now()
    const board = runDomain(
      updateBoard,
      existing,
      {
        name: command.name,
        description: command.description,
        allowUserStatusUpdate: command.allowUserStatusUpdate,
        orderedLanes,
        keyPrefix: command.keyPrefix,
        sprintsEnabled: command.sprintsEnabled,
        ideaFeaturesEnabled: command.ideaFeaturesEnabled,
      },
      now,
      this.currentUser.userId,
    )
    const organizationBoards = await this.boards.listByOrganization(existing.organizationId)
    if (board.keyPrefix !== existing.keyPrefix) {
      // Ruling 4: the prefix is editable only until the first key is issued.
      if (existing.nextItemNumber > 1) {
        throw new UnprocessableError(
          'keyPrefixLocked',
          'The key prefix cannot change once an item key has been issued on this board.',
        )
      }
      ensureKeyPrefixFree(board, organizationBoards)
    }
    const newTargets = planReferences(board, organizationBoards)
    await this.ensureReferenceLanesFree(existing, board)
    const moves = await this.planIdeaMoves(existing, board, command.ideaMoves ?? [], statusLookup)
    const pull = await this.planPull(
      board.organizationId,
      board,
      command.pullItemIds ?? [],
      forceReason,
      now,
    )

    await this.boards.save(board)
    await this.disableTargetIdeaFeatures(newTargets, now)
    for (const move of moves) {
      await this.boards.moveIdeas(
        board.id,
        move.ideas.map((idea) => idea.ideaId),
        move.fromStatusId,
        move.toStatusId,
        now,
        this.currentUser.userId,
      )
      // A move skips an idea someone moved out of the lane meanwhile. Into an auto-create lane that
      // would commit a task for an idea that never entered it, so there a miss refuses the save.
      if (board.swimlanes.find((lane) => lane.statusId === move.toStatusId)?.autoCreateTask) {
        await this.boards.verifyIdeasMoved(
          board.id,
          move.ideas.map((idea) => ({ ideaId: idea.ideaId, title: idea.title })),
          move.toStatusId,
          now,
        )
      }
    }
    if (pull !== null) {
      await this.stagePull(board.id, pull, now)
    }
    const finishTasks = await this.stageAutoCreatedTasks(board, [
      // A board with a reference lane is never a reference target, so it holds no tasks.
      ...moves.flatMap((move) =>
        move.ideas.map((idea) => ({
          parent: {
            id: idea.ideaId,
            organizationId: board.organizationId,
            title: idea.title,
            parentIdeaId: null,
          },
          statusId: move.toStatusId,
        })),
      ),
      ...pulledEntries(pull),
    ])
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
        ...pullAuditCounts(pull),
      },
    )
    // One entry per moved idea, in the shape a move on the board writes, so an idea's history
    // reads the same however it changed lanes.
    for (const move of moves) {
      for (const idea of move.ideas) {
        await this.auditIdeaMove(board.organizationId, idea, move.toStatusId, now)
      }
    }
    await this.auditPull(board.organizationId, board, pull, now)
    for (const finish of finishTasks) {
      await finish()
    }

    return {
      ...toDetail(board, statusLookup, this.canSetAllowedIdeaTypes(board)),
      ...pulledItemsOf(pull),
    }
  }

  /**
   * What the pull picker offers (SPEC/20-feature-board-pull-in.md rules 9 to 11): the same
   * eligibility as a pull, narrowed to what this caller may pull, so a User sees only their own
   * Discovery ideas and no Issues. Same scope as creating a board: Read Only is refused, a direct
   * Site Admin is refused, and another organization is not found.
   */
  async listPullCandidates(
    organizationId: string,
    query: PullCandidatesQuery,
  ): Promise<PullCandidatePage> {
    const role = this.ensureCreateScope(organizationId)
    await this.ensureOrganizationExists(organizationId)
    const userId = this.requireAuthenticatedUserId()

    const source = parsePullSource(query.source)
    if (source === 'backlog' && role !== Role.OrgAdmin) {
      throw new ForbiddenError('Only an Org Admin can pull backlog issues.')
    }

    return this.boards.listPullCandidates({
      organizationId,
      source,
      excludeBoardId: query.excludeBoardId,
      search: query.search,
      tags: [...new Set(query.tags.map(normalizeTagName).filter((name) => name !== ''))],
      // A User sees only what they could pull, which is their own ideas whatever author was asked.
      authorUserId: role === Role.OrgAdmin ? query.authorUserId : userId,
      currentUserId: userId,
      page: normalizePageRequest(toPageRequest(query.page, query.pageSize)),
    })
  }

  /**
   * Validates every named item against rules 10 to 13 and works out where each lands on `board`'s
   * lanes (the ones this same save leaves), or `null` when nothing is pulled. Every problem is
   * reported at once under `pullItemIds`; nothing is staged here, so a refusal saves nothing.
   * Items are returned oldest first, the order they are audited and answered in.
   */
  private async planPull(
    organizationId: string,
    board: Board,
    requested: readonly string[],
    forceReason: string | null,
    now: Date,
  ): Promise<PullPlan | null> {
    if (requested.length === 0) {
      return null
    }
    if (requested.length > MAX_PULL_ITEMS) {
      throw invalidPullItems([`At most ${MAX_PULL_ITEMS} items can be pulled in one save.`])
    }
    const malformed = requested.find((id) => !UUID_PATTERN.test(id))
    if (malformed !== undefined) {
      throw invalidPullItems([`'${malformed}' is not a valid item id.`])
    }
    if (new Set(requested.map((id) => id.toLowerCase())).size !== requested.length) {
      throw invalidPullItems(['An item can be named only once.'])
    }

    const role = this.requireAuthenticatedRole()
    const userId = this.requireAuthenticatedUserId()
    const found = await Promise.all(requested.map((id) => this.ideas.getById(id, true)))
    const openTasksOf = await this.openTasksHoldingPull(found, board.id)
    // Rule 15: a board that limits its idea types refuses a pull of any other type.
    const ideaTypeNames =
      board.ideaFeaturesEnabled && board.allowedIdeaTypeIds.length > 0
        ? new Map(
            (await this.boards.listIdeaTypes(organizationId)).map((type) => [type.id, type.name]),
          )
        : new Map<string, string>()

    const laneOrder = [...board.swimlanes].sort((a, b) => a.displayOrder - b.displayOrder)
    const laneStatusIds = new Set(laneOrder.map((lane) => lane.statusId))
    const leftmostStatusId = laneOrder[0]?.statusId ?? ''
    const lanesByStatus = new Map(laneOrder.map((lane) => [lane.statusId, lane]))

    const problems: string[] = []
    const items: PlannedPull[] = []
    requested.forEach((id, index) => {
      const before = found[index] ?? null
      if (before === null || before.organizationId !== organizationId) {
        problems.push(`Item '${id}' was not found.`)
        return
      }
      const problem = pullRefusal(before, board.id, role, userId)
      if (problem !== null) {
        problems.push(problem)
        return
      }
      if (!boardTakesIdeaType(board, before.ideaTypeId)) {
        const typeName = ideaTypeNames.get(before.ideaTypeId) ?? before.ideaTypeId
        problems.push(`'${before.title}' is a ${typeName} idea, and this board doesn't take those.`)
        return
      }
      // The reference-lane lock: being pulled away is an exit from the source board's lane.
      const openTasks = openTasksOf(before)
      if (openTasks > 0 && forceReason === null) {
        problems.push(
          `'${before.title}' is waiting on ${openTasks} open tasks, so it cannot be pulled.`,
        )
        return
      }
      const statusId = laneStatusIds.has(before.statusId) ? before.statusId : leftmostStatusId
      // The Effort entry rule holds on a pull too (Board References Ruling 6).
      if (before.effort === null && lanesByStatus.get(statusId)?.referencesBoardId) {
        throw new UnprocessableError(
          'effortRequiredForReferenceLane',
          `Set an Effort on '${before.title}' before pulling it into a lane that references a board.`,
        )
      }
      items.push({
        before,
        after: pullIdeaOntoBoard(before, board.id, statusId, now, this.currentUser.userId),
        forced: openTasks > 0 && forceReason !== null ? { openTasks, reason: forceReason } : null,
      })
    })
    if (problems.length > 0) {
      throw invalidPullItems(problems)
    }

    items.sort(
      (a, b) =>
        a.before.createdAtUtc.getTime() - b.before.createdAtUtc.getTime() ||
        compareStrings(a.before.id, b.before.id),
    )
    return { items }
  }

  /** Open tasks holding each found item in a reference lane of the board it is pulled from. */
  private async openTasksHoldingPull(
    found: readonly (Idea | null)[],
    targetBoardId: string,
  ): Promise<(idea: Idea) => number> {
    const sourceBoardIds = [
      ...new Set(
        found.flatMap((idea) =>
          idea?.boardId && idea.boardId !== targetBoardId ? [idea.boardId] : [],
        ),
      ),
    ]
    const sourceBoards = await Promise.all(sourceBoardIds.map((id) => this.boards.getById(id)))
    const referenceLanes = new Set(
      sourceBoards.flatMap((source) =>
        source === null
          ? []
          : source.swimlanes
              .filter((lane) => lane.referencesBoardId !== null)
              .map((lane) => laneKey(source.id, lane.statusId)),
      ),
    )
    const inReferenceLane = (idea: Idea): boolean =>
      idea.boardId !== null && referenceLanes.has(laneKey(idea.boardId, idea.statusId))
    const parentIds = found.flatMap((idea) =>
      idea !== null && inReferenceLane(idea) ? [idea.id] : [],
    )
    const counts =
      parentIds.length === 0
        ? new Map<string, { readonly total: number; readonly done: number }>()
        : await this.ideas.countChildrenByParentIds(parentIds)
    return (idea) => openTasksHoldingExit(inReferenceLane(idea), counts.get(idea.id))
  }

  /**
   * Stages the one task of every card this save places in an `autoCreateTask` lane, by a pull or
   * an `ideaMoves` entry (SPEC/contracts/boards.md, decided 2026-10-16). Staged before the save's
   * commit, so a refused task fails the whole save; the returned callbacks write the tasks' audit
   * entries after it.
   */
  private async stageAutoCreatedTasks(
    board: Board,
    entering: readonly { readonly parent: AutoCreateTaskParent; readonly statusId: string }[],
  ): Promise<readonly (() => Promise<void>)[]> {
    const finishers: (() => Promise<void>)[] = []
    for (const { parent, statusId } of entering) {
      const lane = board.swimlanes.find((swimlane) => swimlane.statusId === statusId)
      if (lane?.autoCreateTask && lane.referencesBoardId !== null) {
        finishers.push(await this.tasks.stageAutoCreatedTask(parent, lane.referencesBoardId))
      }
    }
    return finishers
  }

  private async stagePull(boardId: string, pull: PullPlan, now: Date): Promise<void> {
    await this.boards.reassignIdeas(
      boardId,
      pull.items.map(({ before, after }) => ({
        ideaId: before.id,
        title: before.title,
        from: {
          boardId: before.boardId,
          statusId: before.statusId,
          phase: before.phase,
          sprintId: before.sprintId,
        },
        toStatusId: after.statusId,
        returnsToDiscovery: before.phase === IdeaPhase.Delivery,
      })),
      now,
      this.currentUser.userId,
    )
  }

  /** The per-item entries of a pull (rule 18), after the board's own entry. */
  private async auditPull(
    organizationId: string,
    board: Board,
    pull: PullPlan | null,
    now: Date,
  ): Promise<void> {
    for (const { before, after, forced } of pull?.items ?? []) {
      await this.auditIdea(
        'IdeaBoardChanged',
        organizationId,
        before.id,
        `Idea '${before.title}' pulled onto board '${board.name}'.`,
        now,
        { fromBoardId: before.boardId, toBoardId: board.id },
      )
      if (after.statusId !== before.statusId) {
        await this.auditIdea(
          'IdeaStatusChanged',
          organizationId,
          before.id,
          `Idea '${before.title}' moved to a new status.`,
          now,
          { fromStatusId: before.statusId, toStatusId: after.statusId },
        )
      }
      if (before.phase === IdeaPhase.Delivery) {
        await this.auditIdea(
          'IssueReturnedToDiscovery',
          organizationId,
          before.id,
          `Issue '${before.title}' returned to discovery.`,
          now,
          { previousSprintId: before.sprintId },
        )
      }
      if (forced !== null) {
        const { message, metadata } = movedPastOpenTasksAudit(
          before.title,
          forced.openTasks,
          forced.reason,
        )
        await this.auditIdea(IDEA_MOVED_PAST_OPEN_TASKS, organizationId, before.id, message, now, {
          ...metadata,
        })
      }
    }
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

    // Every problem is reported at once, deduplicated, rather than the first alone. A lane named by
    // any entry, valid or not, is not reported again as unplaced: its entry's message says why.
    const problems = new Set<string>()
    const named = new Set<string>()
    const targets = new Map<string, string>()
    for (const move of requested) {
      if (!removed.includes(move.fromStatusId)) {
        problems.add('A move must come from a lane this save removes.')
        continue
      }
      if (named.has(move.fromStatusId)) {
        problems.add('A removed lane can move its ideas to one lane only.')
        continue
      }
      named.add(move.fromStatusId)
      if (!kept.has(move.toStatusId)) {
        problems.add('Ideas can only move to a lane that stays on the board.')
        continue
      }
      targets.set(move.fromStatusId, move.toStatusId)
    }

    if (removed.length === 0) {
      if (problems.size > 0) {
        throw invalidIdeaMoves([...problems])
      }
      return []
    }

    const ideas = await this.boards.listLaneIdeas(existing.id, removed)
    const planned: PlannedIdeaMove[] = []
    for (const fromStatusId of removed) {
      const laneIdeas = ideas.filter((idea) => idea.statusId === fromStatusId)
      if (laneIdeas.length === 0) {
        continue
      }
      const toStatusId = targets.get(fromStatusId)
      if (toStatusId === undefined) {
        if (named.has(fromStatusId)) {
          continue
        }
        const name = statusLookup.get(fromStatusId)?.name ?? 'A removed lane'
        const [count, them] =
          laneIdeas.length === 1 ? ['1 idea', 'it'] : [`${laneIdeas.length} ideas`, 'them']
        problems.add(
          `'${name}' still holds ${count}. Choose a lane that stays on the board to move ${them} to.`,
        )
        continue
      }
      if (
        updated.swimlanes.some((lane) => lane.statusId === toStatusId && lane.referencesBoardId) &&
        laneIdeas.some((idea) => idea.effort === null)
      ) {
        throw new UnprocessableError(
          'effortRequiredForReferenceLane',
          'Set an Effort on every idea before moving it into a lane that references a board.',
        )
      }
      planned.push({ fromStatusId, toStatusId, ideas: laneIdeas })
    }
    if (problems.size > 0) {
      throw invalidIdeaMoves([...problems])
    }
    return planned
  }

  async reorderSwimlanes(boardId: string, command: ReorderSwimlanesCommand): Promise<void> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)

    const orderedStatusIds = orderSwimlaneInputs(command.swimlanes).map((lane) => lane.statusId)
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
    await this.setArchived(boardId, archiveBoard, 'BoardArchived', 'archived', async (existing) => {
      if (existing.isArchived) {
        return
      }
      const organizationBoards = await this.boards.listByOrganization(existing.organizationId)
      const referenced = organizationBoards.some(
        (other) =>
          other.id !== existing.id &&
          other.swimlanes.some((lane) => lane.referencesBoardId === existing.id),
      )
      if (referenced) {
        throw new UnprocessableError(
          'referenceTargetArchived',
          'A board that a lane references cannot be archived.',
        )
      }
    })
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
    guard?: (existing: Board) => Promise<void>,
  ): Promise<void> {
    const existing = await this.boards.getById(boardId)
    if (existing === null) {
      throw new NotFoundError('Board not found.')
    }

    this.ensureAdminScope(existing.organizationId)
    await guard?.(existing)

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

  /**
   * Ruling 6, tightened to contracts/boards.md: a lane that holds ideas cannot have
   * `referencesBoardId` given, changed or removed, and a reference lane cannot be removed - an
   * `ideaMoves` entry does not lift it, since the ideas there are parents of tasks on the
   * referenced board. An ordinary lane may still be removed (with moves).
   */
  private async ensureReferenceLanesFree(existing: Board, updated: Board): Promise<void> {
    const kept = new Map(updated.swimlanes.map((lane) => [lane.statusId, lane]))
    const changed = existing.swimlanes.filter((lane) => {
      const after = kept.get(lane.statusId)
      return after === undefined
        ? lane.referencesBoardId !== null
        : after.referencesBoardId !== lane.referencesBoardId
    })
    if (changed.length === 0) {
      return
    }
    const counts = await this.boards.countIdeasByBoardAndStatus([existing.id])
    const inUse = changed.some((lane) =>
      counts.some((row) => row.statusId === lane.statusId && row.ideaCount > 0),
    )
    if (inUse) {
      throw new UnprocessableError(
        'laneInUse',
        'A lane that holds ideas cannot have its referenced board changed.',
      )
    }
  }

  /** A board first named as a reference target stops offering idea features (contracts/boards.md). */
  private async disableTargetIdeaFeatures(targets: readonly Board[], now: Date): Promise<void> {
    for (const target of targets) {
      const updated = disableIdeaFeatures(target, now, this.currentUser.userId)
      if (updated !== target) {
        await this.boards.save(updated)
      }
    }
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

  /**
   * Who may create a board: an Org Admin or a User of that organization (`SPEC/decisions.md`
   * 2026-10-04). Editing, archiving and reordering an existing board stay `ensureAdminScope`.
   */
  private ensureCreateScope(organizationId: string): Role {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)

    if (role === Role.OrgAdmin || role === Role.User) {
      if (this.currentUser.organizationId === organizationId) return role
      throw new NotFoundError('Board not found.')
    }

    throw new ForbiddenError('You are not allowed to create boards in this organization.')
  }

  /**
   * Who may set a board's allowed idea types: an Org Admin of its organization, or the board's
   * creator while a User there (SPEC/decisions.md 2026-10-22). Evaluated against the acting role,
   * so a Site Admin qualifies only through View As, as the target. Being signed in at all means the
   * account is active.
   */
  private ensureAllowedIdeaTypesScope(board: Board): void {
    const role = this.requireAuthenticatedRole()
    ensureNotDirectSiteAdmin(this.currentUser)
    if (this.currentUser.organizationId !== board.organizationId) {
      throw new NotFoundError('Board not found.')
    }
    if (!this.mayChooseAllowedIdeaTypes(board, role)) {
      throw new ForbiddenError('You are not allowed to choose the idea types this board takes.')
    }
  }

  /** The read flag for `ensureAllowedIdeaTypesScope`, false on an archived board. */
  private canSetAllowedIdeaTypes(board: Board): boolean {
    const role = this.currentUser.role
    return (
      role !== null &&
      !board.isArchived &&
      this.currentUser.organizationId === board.organizationId &&
      this.mayChooseAllowedIdeaTypes(board, role)
    )
  }

  private mayChooseAllowedIdeaTypes(board: Board, role: Role): boolean {
    return (
      role === Role.OrgAdmin ||
      (role === Role.User &&
        board.createdByUserId !== null &&
        board.createdByUserId === this.currentUser.userId)
    )
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

  private requireAuthenticatedUserId(): string {
    if (this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.userId
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

  private async auditIdea(
    eventType: string,
    organizationId: string,
    ideaId: string,
    message: string,
    occurredAtUtc: Date,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditEvents.write({
      eventType,
      entityType: 'Idea',
      message,
      occurredAtUtc,
      organizationId,
      attribution: attributeAudit(this.currentUser, this.currentUser.userId),
      entityId: ideaId,
      metadataJson: JSON.stringify(metadata),
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

const MAX_PULL_ITEMS = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The ideas as read and as they will be saved, oldest first. */
type PullPlan = { readonly items: readonly PlannedPull[] }
type PlannedPull = {
  readonly before: Idea
  readonly after: Idea
  /** Set when an Org Admin's reason took the item past open tasks in a reference lane. */
  readonly forced: { readonly openTasks: number; readonly reason: string } | null
}

function invalidPullItems(messages: readonly string[]): ValidationError {
  return new ValidationError('One or more fields are invalid.', { pullItemIds: [...messages] })
}

/**
 * Why `idea` cannot be pulled onto `boardId` by this caller, or `null` when it can (rules 10 and
 * 11). Eligibility first, then rights, so a message says what is wrong with the item before it
 * says what the caller may not do.
 */
function pullRefusal(idea: Idea, boardId: string, role: Role, userId: string): string | null {
  if (idea.isDeleted) {
    return `'${idea.title}' is no longer available.`
  }
  if (idea.boardId === boardId) {
    return `'${idea.title}' is already on this board.`
  }
  if (idea.parentIdeaId !== null) {
    return `'${idea.title}' is a task, so it cannot be pulled. Tasks stay on their parent's reference board.`
  }
  if (idea.phase === IdeaPhase.Delivery) {
    if (idea.sprintId !== null) {
      return `'${idea.title}' is in a sprint, so it cannot be pulled. Move it back to the backlog first.`
    }
    if (role !== Role.OrgAdmin) {
      return `'${idea.title}' is an issue, and only an Org Admin can pull issues.`
    }
    return null
  }
  if (role !== Role.OrgAdmin && idea.authorUserId !== userId) {
    return `You can pull only ideas you created; '${idea.title}' was created by someone else.`
  }
  return null
}

/** Each pulled item and the lane it lands in, oldest first. */
function pulledEntries(
  pull: PullPlan | null,
): { readonly parent: AutoCreateTaskParent; readonly statusId: string }[] {
  return (pull?.items ?? []).map(({ after }) => ({ parent: after, statusId: after.statusId }))
}

function pullAuditCounts(pull: PullPlan | null): Record<string, number> {
  return pull === null
    ? {}
    : {
        pulledItemCount: pull.items.length,
        returnedIssueCount: pull.items.filter(({ before }) => before.phase === IdeaPhase.Delivery)
          .length,
      }
}

function pulledItemsOf(pull: PullPlan | null): { pulledItems?: readonly PulledItem[] } {
  return pull === null
    ? {}
    : {
        pulledItems: pull.items.map(({ before, after }) => ({
          ideaId: before.id,
          fromBoardId: before.boardId,
          statusId: after.statusId,
        })),
      }
}

function parsePullSource(source: string | null): PullCandidateSource {
  if (source === 'unassigned' || source === 'boards' || source === 'backlog') {
    return source
  }
  throw new ValidationError('One or more fields are invalid.', {
    source: ["Source must be 'unassigned', 'boards' or 'backlog'."],
  })
}

function toPageRequest(
  page: number | null,
  pageSize: number | null,
): { page?: number; pageSize?: number } {
  return {
    ...(page === null ? {} : { page }),
    ...(pageSize === null ? {} : { pageSize }),
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

function orderSwimlaneInputs(swimlanes: readonly SwimlaneInput[]): readonly SwimlaneInput[] {
  return [...swimlanes].sort((a, b) => a.order - b.order)
}

/** A `keyPrefix` already used by another board of the organization is a `409`. */
function ensureKeyPrefixFree(board: Board, organizationBoards: readonly Board[]): void {
  if (
    board.keyPrefix !== null &&
    organizationBoards.some((other) => other.id !== board.id && other.keyPrefix === board.keyPrefix)
  ) {
    throw new ConflictError('keyPrefixTaken')
  }
}

/**
 * The reference rules for `board`'s lanes against the organization's stored boards
 * (contracts/boards.md "Board References"), checked in this order: own board, missing or archived
 * target, one level only. Returns the targets this save names for the first time, whose idea
 * features are then turned off.
 */
function planReferences(board: Board, organizationBoards: readonly Board[]): readonly Board[] {
  const referencedIds = [
    ...new Set(board.swimlanes.flatMap((lane) => lane.referencesBoardId ?? [])),
  ]
  if (referencedIds.length === 0) {
    return []
  }
  if (referencedIds.includes(board.id)) {
    throw new UnprocessableError('laneReferencesOwnBoard', 'A lane cannot reference its own board.')
  }
  const targets: Board[] = []
  for (const id of referencedIds) {
    const target = organizationBoards.find((other) => other.id === id)
    if (target === undefined || target.isArchived) {
      throw new UnprocessableError(
        'referencesBoardInvalid',
        'A lane can reference only an active board of this organization.',
      )
    }
    targets.push(target)
  }
  const targetsHaveReferences = targets.some((target) =>
    target.swimlanes.some((lane) => lane.referencesBoardId !== null),
  )
  const isTarget = organizationBoards.some(
    (other) =>
      other.id !== board.id && other.swimlanes.some((lane) => lane.referencesBoardId === board.id),
  )
  if (targetsHaveReferences || isTarget) {
    throw new UnprocessableError(
      'referenceChainNotAllowed',
      'A board that references another board cannot itself be referenced.',
    )
  }
  return targets.filter(
    (target) =>
      !organizationBoards.some((other) =>
        other.swimlanes.some((lane) => lane.referencesBoardId === target.id),
      ),
  )
}

/**
 * Normalizes the requested swimlanes to a dense, ordered list of status ids and validates the
 * 2-swimlane minimum, distinctness, and that every status is an active status of the
 * organization (subset support).
 */
function validateAndOrderSwimlanes(
  swimlanes: readonly SwimlaneInput[],
  statusLookup: ReadonlyMap<string, Status>,
): readonly SwimlaneLane[] {
  const ordered = orderSwimlaneInputs(swimlanes)
  const orderedStatusIds = ordered.map((lane) => lane.statusId)

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

  const lanes = ordered.map((lane) => ({
    statusId: lane.statusId,
    isFinal: lane.isFinal === true,
    referencesBoardId: lane.referencesBoardId?.trim() || null,
    autoCreateTask: lane.autoCreateTask === true,
  }))
  if (lanes.some((lane) => lane.isFinal && lane.referencesBoardId !== null)) {
    throw new UnprocessableError(
      'finalLaneCannotReference',
      'A final lane cannot reference a board.',
    )
  }
  if (lanes.some((lane) => lane.autoCreateTask && lane.referencesBoardId === null)) {
    throw new UnprocessableError(
      'autoCreateTaskRequiresReference',
      'A lane can create a task on entry only when it references a board.',
    )
  }
  return lanes
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

/**
 * Checks a requested allowed-types list against the organization's idea types and answers it in
 * idea type sort order (SPEC/contracts/boards.md "Allowed idea types"). The controller has already
 * refused anything but an array of strings, with the first message here.
 */
function validateAllowedIdeaTypeIds(
  field: string,
  requested: readonly string[],
  ideaTypes: readonly BoardIdeaType[],
): readonly string[] {
  const invalid = (messages: readonly string[]): ValidationError =>
    new ValidationError('One or more fields are invalid.', { [field]: [...messages] })
  if (requested.some((id) => !UUID_PATTERN.test(id))) {
    throw invalid(['Idea type ids must be an array of ids.'])
  }
  const wanted = new Set(requested.map((id) => id.toLowerCase()))
  if (wanted.size !== requested.length) {
    throw invalid(['An idea type can be named only once.'])
  }
  const active = ideaTypes.filter((type) => !type.isDeleted)
  const activeIds = new Set(active.map((type) => type.id.toLowerCase()))
  const missing = requested.filter((id) => !activeIds.has(id.toLowerCase()))
  if (missing.length > 0) {
    throw invalid(missing.map((id) => `Idea type '${id}' was not found.`))
  }
  return active.filter((type) => wanted.has(type.id.toLowerCase())).map((type) => type.id)
}

function toDetail(
  board: Board,
  statusLookup: ReadonlyMap<string, Status>,
  canSetAllowedIdeaTypes: boolean,
): BoardDetail {
  return {
    boardId: board.id,
    organizationId: board.organizationId,
    name: board.name,
    description: board.description,
    allowUserStatusUpdate: board.allowUserStatusUpdate,
    swimlanes: buildSwimlaneDetails(board, statusLookup),
    isArchived: board.isArchived,
    archivedAtUtc: board.archivedAtUtc,
    keyPrefix: board.keyPrefix,
    sprintsEnabled: board.sprintsEnabled,
    ideaFeaturesEnabled: board.ideaFeaturesEnabled,
    nextItemNumber: board.nextItemNumber,
    allowedIdeaTypeIds: board.allowedIdeaTypeIds,
    canSetAllowedIdeaTypes,
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
        isFinal: swimlane.isFinal,
        referencesBoardId: swimlane.referencesBoardId,
        autoCreateTask: swimlane.autoCreateTask === true,
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
