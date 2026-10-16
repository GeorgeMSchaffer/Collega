// Satisfies `BoardRepository` (boards/ports.ts). Structurally also satisfies `AiBoardLookupPort`
// (ai/ports.ts: `getById` -> {id, organizationId}, a subset of `Board`). `getBoardContext` and
// `getStatusInfo` additionally satisfy `ideas.BoardsPort` - kept here, not in a separate class,
// since both read the same `boards`/`board_swimlanes` rows this class already maps.
//
// `board_swimlanes` rows carry no id of their own - they are keyed by (board_id, status_id)
// (`ux_board_swimlanes_board_id_status_id`) - so a swimlane update is a full replace (delete every
// existing row for the board, insert the new set) rather than a per-row diff. That matches the
// domain's own `Board.swimlanes`, which the transition functions always replace wholesale.

import { randomUUID } from 'node:crypto'
import type { AiBoardLookupPort } from '@collega/application/ai'
import type {
  BoardRepository,
  BoardStatusIdeaCount,
  BoardTagIdeaCount,
  IdeaReassignment,
  LaneIdea,
  PullCandidate,
  PullCandidateFilter,
  UserName,
} from '@collega/application/boards'
import type { Page } from '@collega/application/common'
import type { BoardsPort, SwimlaneInfo } from '@collega/application/ideas'
import type { SprintBoardsPort } from '@collega/application/sprints'
import type { Board, BoardSwimlane } from '@collega/domain/boards'
import type { EffortLevel, Priority } from '@collega/domain/enums'
import { IdeaPhase } from '@collega/domain/enums'
import type {
  boards as BoardRow,
  board_swimlanes as SwimlaneRow,
} from '../generated/prisma/index.js'
import { Prisma } from '../generated/prisma/index.js'
import { PULL_UNAVAILABLE_MARKER } from '../persistence/constraint-errors.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type BoardRowWithSwimlanes = BoardRow & { board_swimlanes: SwimlaneRow[] }

function boardFromRow(row: BoardRowWithSwimlanes): Board {
  const swimlanes: BoardSwimlane[] = [...row.board_swimlanes]
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({
      statusId: s.status_id,
      displayOrder: s.display_order,
      isFinal: s.is_final,
      referencesBoardId: s.references_board_id,
      autoCreateTask: s.auto_create_task,
    }))

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    allowUserStatusUpdate: row.allow_user_status_update,
    swimlanes,
    isArchived: row.is_archived,
    archivedAtUtc: row.archived_at_utc,
    keyPrefix: row.key_prefix,
    sprintsEnabled: row.sprints_enabled,
    ideaFeaturesEnabled: row.idea_features_enabled,
    nextItemNumber: row.next_item_number,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

/**
 * The ideas every board-list aggregate counts: exactly what `GET /boards/{id}/ideas` lists - live
 * (not soft-deleted) and in the `Discovery` phase, since a promoted Issue leaves the ideation board
 * (`IdeaService.listByBoard`). Counting Delivery items too made a card read "11 ideas" over a board
 * showing six.
 */
function boardIdeasWhere(boardIds: readonly string[]): Prisma.ideasWhereInput {
  return { board_id: { in: [...boardIds] }, is_deleted: false, phase: IdeaPhase.Discovery }
}

export class PrismaBoardRepository
  implements BoardRepository, AiBoardLookupPort, BoardsPort, SprintBoardsPort
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(boardId: string): Promise<Board | null> {
    const row = await this.prisma.boards.findUnique({
      where: { id: boardId },
      include: { board_swimlanes: true },
    })
    return row ? boardFromRow(row) : null
  }

  async listByOrganization(organizationId: string): Promise<readonly Board[]> {
    const rows = await this.prisma.boards.findMany({
      where: { organization_id: organizationId },
      include: { board_swimlanes: true },
    })
    return rows.map(boardFromRow)
  }

  /** `boardIdeasWhere` matches the board idea list's filter, so this count and that endpoint's
   * `totalCount` answer the same question. */
  async countIdeasByBoard(boardIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (boardIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.ideas.groupBy({
      by: ['board_id'],
      where: boardIdeasWhere(boardIds),
      _count: { _all: true },
    })
    // The where names the boards, so no board-less group comes back; this only narrows the type.
    return new Map(
      rows.flatMap((row) =>
        row.board_id === null ? [] : [[row.board_id, row._count._all] as const],
      ),
    )
  }

  async countIdeasByBoardAndStatus(
    boardIds: readonly string[],
  ): Promise<readonly BoardStatusIdeaCount[]> {
    if (boardIds.length === 0) {
      return []
    }
    const rows = await this.prisma.ideas.groupBy({
      by: ['board_id', 'status_id'],
      where: boardIdeasWhere(boardIds),
      _count: { _all: true },
    })
    return rows.flatMap((row) =>
      row.board_id === null
        ? []
        : [{ boardId: row.board_id, statusId: row.status_id, ideaCount: row._count._all }],
    )
  }

  /** Raw SQL because the tag name is two joins away from the board, and `groupBy` cannot join.
   * The idea filter must stay the one `boardIdeasWhere` expresses. */
  async countIdeasByBoardAndTag(
    boardIds: readonly string[],
  ): Promise<readonly BoardTagIdeaCount[]> {
    if (boardIds.length === 0) {
      return []
    }
    const rows = await this.prisma.$queryRaw<
      { board_id: string; tag_name: string; tag_color: string; idea_count: number }[]
    >(Prisma.sql`
      SELECT idea.board_id, tag.name AS tag_name, tag.color AS tag_color, COUNT(*)::int AS idea_count
      FROM idea_tags AS idea_tag
      INNER JOIN ideas AS idea ON idea.id = idea_tag.idea_id
      INNER JOIN tags AS tag ON tag.id = idea_tag.tag_id
      WHERE idea.board_id IN (${Prisma.join(boardIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND idea.is_deleted = FALSE
        AND idea.phase = ${IdeaPhase.Discovery}::"IdeaPhase"
      GROUP BY idea.board_id, tag.id, tag.name, tag.color
    `)
    return rows.map((row) => ({
      boardId: row.board_id,
      tagName: row.tag_name,
      tagColor: row.tag_color,
      ideaCount: row.idea_count,
    }))
  }

  async getUserNames(userIds: readonly string[]): Promise<ReadonlyMap<string, UserName>> {
    if (userIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.users.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, first_name: true, last_name: true },
    })
    return new Map(
      rows.map((row) => [row.id, { firstName: row.first_name, lastName: row.last_name }]),
    )
  }

  /** `boardIdeasWhere` again, so a lane removal moves exactly the ideas its lane count showed. */
  async listLaneIdeas(boardId: string, statusIds: readonly string[]): Promise<readonly LaneIdea[]> {
    if (statusIds.length === 0) {
      return []
    }
    const rows = await this.prisma.ideas.findMany({
      where: { ...boardIdeasWhere([boardId]), status_id: { in: [...statusIds] } },
      select: { id: true, title: true, status_id: true, effort: true },
      orderBy: [{ created_at_utc: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => ({
      ideaId: row.id,
      title: row.title,
      statusId: row.status_id,
      effort: row.effort as EffortLevel | null,
    }))
  }

  async moveIdeas(
    boardId: string,
    ideaIds: readonly string[],
    fromStatusId: string,
    toStatusId: string,
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<void> {
    if (ideaIds.length === 0) {
      return
    }
    // `status_id` in the filter: an idea someone moved out of the lane since it was counted keeps
    // the lane they chose rather than being overwritten.
    this.unitOfWork.enqueue(
      this.prisma.ideas.updateMany({
        where: {
          ...boardIdeasWhere([boardId]),
          id: { in: [...ideaIds] },
          status_id: fromStatusId,
        },
        data: { status_id: toStatusId, updated_at_utc: nowUtc, updated_by_user_id: actorUserId },
      }),
    )
  }

  /**
   * One guarded `updateMany` per item, then one statement that proves they all landed. A batch
   * cannot read a count back, so a guard that matched nothing would otherwise pass silently; the
   * closing SELECT casts a marker naming the first missing item to an integer, which Postgres
   * refuses, and that refusal rolls the whole batch back (`translateWriteError` turns it into the
   * keyed 400). An item already on the board by another route fails the check too, and
   * `updated_at_utc = nowUtc` is what ties a landed row to this save.
   */
  async reassignIdeas(
    boardId: string,
    items: readonly IdeaReassignment[],
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<void> {
    if (items.length === 0) {
      return
    }
    for (const item of items) {
      this.unitOfWork.enqueue(
        this.prisma.ideas.updateMany({
          where: {
            id: item.ideaId,
            is_deleted: false,
            board_id: item.from.boardId,
            status_id: item.from.statusId,
            phase: item.from.phase,
            sprint_id: item.from.sprintId,
          },
          data: {
            board_id: boardId,
            status_id: item.toStatusId,
            // The old board's number means nothing here (and could collide with one issued here);
            // the allocation below issues this board's own.
            item_number: null,
            // A task off the referenced board is no longer that parent's task.
            parent_idea_id: null,
            updated_at_utc: nowUtc,
            updated_by_user_id: actorUserId,
            ...(item.returnsToDiscovery
              ? { phase: IdeaPhase.Discovery, delivery_status: null, sprint_id: null }
              : {}),
          },
        }),
      )
      // Sprints and dependencies are same-board only: leaving the board ends both. A legacy
      // (board-less) sprint is untouched.
      this.unitOfWork.enqueue(
        this.prisma.$executeRaw(Prisma.sql`
          UPDATE ideas SET sprint_id = NULL
          WHERE id = ${item.ideaId}::uuid AND board_id = ${boardId}::uuid
            AND sprint_id IN (SELECT sprints.id FROM sprints WHERE sprints.board_id IS NOT NULL)
        `),
      )
      this.unitOfWork.enqueue(
        this.prisma.idea_dependencies.deleteMany({
          where: { OR: [{ blocked_idea_id: item.ideaId }, { blocker_idea_id: item.ideaId }] },
        }),
      )
      // Inside the batch, unlike `allocateItemNumber`: the target may be staged in this same save,
      // and a pull that fails the check below must not burn numbers. A board without a prefix
      // allocates nothing, so the subselect is null and the item stays unnumbered.
      this.unitOfWork.enqueue(
        this.prisma.$executeRaw(Prisma.sql`
          WITH issued AS (
            UPDATE boards SET next_item_number = next_item_number + 1
            WHERE id = ${boardId}::uuid AND key_prefix IS NOT NULL
            RETURNING next_item_number - 1 AS item_number
          )
          UPDATE ideas SET item_number = (SELECT issued.item_number FROM issued)
          WHERE id = ${item.ideaId}::uuid AND board_id = ${boardId}::uuid
            AND updated_at_utc = ${nowUtc}::timestamptz
        `),
      )
    }
    this.unitOfWork.enqueue(
      this.prisma.$queryRaw(Prisma.sql`
        SELECT CAST(COALESCE(
          (SELECT ${PULL_UNAVAILABLE_MARKER} || encode(convert_to(expected.title, 'UTF8'), 'hex')
           FROM UNNEST(${items.map((item) => item.ideaId)}::uuid[], ${items.map((item) => item.title)}::text[])
             WITH ORDINALITY AS expected(idea_id, title, position)
           WHERE NOT EXISTS (
             SELECT 1 FROM ideas AS landed
             WHERE landed.id = expected.idea_id
               AND landed.board_id = ${boardId}::uuid
               AND landed.updated_at_utc = ${nowUtc}::timestamptz
           )
           ORDER BY expected.position
           LIMIT 1), '0') AS integer) AS verified
      `),
    )
  }

  /**
   * The pull picker's read. Raw SQL for the same reason the idea lists are: the card carries the
   * author's, board's and status's names and the idea's tags, none of which the frozen schema
   * relates to `ideas`. The population mirrors the eligibility in rule 10, one tab per source;
   * oldest first, then title, then id.
   */
  async listPullCandidates(filter: PullCandidateFilter): Promise<Page<PullCandidate>> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`i.organization_id = ${filter.organizationId}::uuid`,
      Prisma.sql`i.is_deleted = FALSE`,
    ]
    switch (filter.source) {
      case 'unassigned':
        conditions.push(Prisma.sql`i.phase = 'Discovery'::"IdeaPhase" AND i.board_id IS NULL`)
        break
      case 'boards':
        conditions.push(Prisma.sql`i.phase = 'Discovery'::"IdeaPhase" AND i.board_id IS NOT NULL`)
        break
      case 'backlog':
        conditions.push(Prisma.sql`i.phase = 'Delivery'::"IdeaPhase" AND i.sprint_id IS NULL`)
        break
    }
    if (filter.excludeBoardId !== null) {
      conditions.push(Prisma.sql`i.board_id IS DISTINCT FROM ${filter.excludeBoardId}::uuid`)
    }
    if (filter.authorUserId !== null) {
      conditions.push(Prisma.sql`i.author_user_id = ${filter.authorUserId}::uuid`)
    }
    if (filter.search !== null) {
      const term = `%${filter.search.replace(/[\\%_]/g, '\\$&')}%`
      conditions.push(Prisma.sql`i.title ILIKE ${term}`)
    }
    if (filter.tags.length > 0) {
      conditions.push(
        Prisma.sql`EXISTS (SELECT 1 FROM idea_tags AS filter_link INNER JOIN tags AS filter_tag ON filter_tag.id = filter_link.tag_id WHERE filter_link.idea_id = i.id AND filter_tag.normalized_name IN (${Prisma.join(filter.tags)}))`,
      )
    }
    const where = Prisma.join(conditions, ' AND ')
    const { page, pageSize } = filter.page

    const rows = await this.prisma.$queryRaw<
      {
        idea_id: string
        title: string
        author_user_id: string
        author_name: string | null
        board_id: string | null
        board_name: string | null
        status_id: string
        status_name: string | null
        phase: IdeaPhase
        priority: Priority | null
        tag_names: string[]
        upvote_count: number
      }[]
    >(Prisma.sql`
      SELECT i.id AS idea_id, i.title, i.author_user_id,
        (author.first_name || ' ' || author.last_name) AS author_name,
        i.board_id, board.name AS board_name, i.status_id, status.name AS status_name,
        i.phase, CASE WHEN i.parent_idea_id IS NULL THEN i.priority END AS priority,
        COALESCE((
          SELECT ARRAY_AGG(tag.name ORDER BY LOWER(tag.name), tag.name)
          FROM idea_tags AS link INNER JOIN tags AS tag ON tag.id = link.tag_id
          WHERE link.idea_id = i.id
        ), ARRAY[]::text[]) AS tag_names,
        (SELECT COUNT(*)::int FROM idea_upvotes AS upvote WHERE upvote.idea_id = i.id) AS upvote_count
      FROM ideas AS i
      LEFT JOIN users AS author ON author.id = i.author_user_id
      LEFT JOIN boards AS board ON board.id = i.board_id
      LEFT JOIN statuses AS status ON status.id = i.status_id
      WHERE ${where}
      ORDER BY i.created_at_utc ASC, i.title ASC, i.id ASC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `)
    const countRows = await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total FROM ideas AS i WHERE ${where}
    `)

    return {
      items: rows.map((row) => ({
        ideaId: row.idea_id,
        title: row.title,
        authorUserId: row.author_user_id,
        authorName: row.author_name ?? '',
        boardId: row.board_id,
        boardName: row.board_name,
        statusId: row.status_id,
        statusName: row.status_name ?? '',
        phase: row.phase,
        tags: row.tag_names,
        priority: row.priority,
        upvoteCount: row.upvote_count,
        isMine: row.author_user_id === filter.currentUserId,
      })),
      page,
      pageSize,
      totalCount: countRows[0]?.total ?? 0,
    }
  }

  async isStatusReferenced(statusId: string): Promise<boolean> {
    const found = await this.prisma.board_swimlanes.findFirst({
      where: { status_id: statusId },
      select: { id: true },
    })
    return found !== null
  }

  /** `ideas.BoardsPort.getBoardContext`. */
  async getBoardContext(boardId: string): Promise<{
    readonly boardId: string
    readonly organizationId: string
    readonly name: string
    readonly allowUserStatusUpdate: boolean
    readonly isArchived: boolean
    readonly keyPrefix: string | null
    readonly ideaFeaturesEnabled: boolean
    readonly swimlanes: readonly SwimlaneInfo[]
  } | null> {
    const board = await this.getById(boardId)
    if (!board) {
      return null
    }
    return {
      boardId: board.id,
      organizationId: board.organizationId,
      name: board.name,
      allowUserStatusUpdate: board.allowUserStatusUpdate,
      isArchived: board.isArchived,
      keyPrefix: board.keyPrefix,
      ideaFeaturesEnabled: board.ideaFeaturesEnabled,
      swimlanes: board.swimlanes,
    }
  }

  /** `sprints.SprintBoardsPort.getSprintBoard`. */
  async getSprintBoard(boardId: string): Promise<{
    readonly id: string
    readonly organizationId: string
    readonly sprintsEnabled: boolean
    readonly isArchived: boolean
    readonly finalStatusIds: readonly string[]
  } | null> {
    const board = await this.getById(boardId)
    if (!board) {
      return null
    }
    return {
      id: board.id,
      organizationId: board.organizationId,
      sprintsEnabled: board.sprintsEnabled,
      isArchived: board.isArchived,
      finalStatusIds: board.swimlanes.filter((lane) => lane.isFinal).map((lane) => lane.statusId),
    }
  }

  /** `ideas.BoardsPort.getStatusInfo` - every status in the organization, INCLUDING soft-deleted
   * ones, so a historical reference on an idea still renders its prior name/color (rule #8). */
  async getStatusInfo(organizationId: string): Promise<
    ReadonlyMap<
      string,
      {
        readonly statusId: string
        readonly name: string
        readonly color: string
        readonly isDeleted: boolean
      }
    >
  > {
    const rows = await this.prisma.statuses.findMany({ where: { organization_id: organizationId } })
    return new Map(
      rows.map((row) => [
        row.id,
        { statusId: row.id, name: row.name, color: row.color, isDeleted: row.is_deleted },
      ]),
    )
  }

  /** `ideas.BoardsPort.getFirstActiveStatusId` - the status a pool idea starts with. */
  async getFirstActiveStatusId(organizationId: string): Promise<string | null> {
    const row = await this.prisma.statuses.findFirst({
      where: { organization_id: organizationId, is_deleted: false },
      orderBy: [{ sort_order: 'asc' }, { created_at_utc: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })
    return row?.id ?? null
  }

  /** `ideas.BoardsPort.allocateItemNumber`: awaited and committed on its own, outside the unit of
   * work (Board References Ruling 5; precedent `tag.repository.ts` `getOrCreate`). The row lock the
   * UPDATE takes serializes concurrent creates, so each reads a distinct counter value. */
  async allocateItemNumber(boardId: string): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ item_number: number }[]>(Prisma.sql`
      UPDATE boards SET next_item_number = next_item_number + 1
      WHERE id = ${boardId}::uuid AND key_prefix IS NOT NULL
      RETURNING next_item_number - 1 AS item_number
    `)
    return rows[0]?.item_number ?? null
  }

  /** `ideas.BoardsPort.getKeyPrefixes`. */
  async getKeyPrefixes(boardIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (boardIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.boards.findMany({
      where: { id: { in: [...boardIds] }, key_prefix: { not: null } },
      select: { id: true, key_prefix: true },
    })
    return new Map(
      rows.flatMap((row) => (row.key_prefix === null ? [] : [[row.id, row.key_prefix] as const])),
    )
  }

  /** `ideas.BoardsPort.getBoardReadFacts`. */
  async getBoardReadFacts(boardIds: readonly string[]): Promise<
    ReadonlyMap<
      string,
      {
        readonly ideaFeaturesEnabled: boolean
        readonly referencedBoardByStatusId: ReadonlyMap<string, string>
      }
    >
  > {
    if (boardIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.boards.findMany({
      where: { id: { in: [...boardIds] } },
      select: {
        id: true,
        idea_features_enabled: true,
        board_swimlanes: { select: { status_id: true, references_board_id: true } },
      },
    })
    return new Map(
      rows.map((row) => [
        row.id,
        {
          ideaFeaturesEnabled: row.idea_features_enabled,
          referencedBoardByStatusId: new Map(
            row.board_swimlanes.flatMap((lane) =>
              lane.references_board_id ? [[lane.status_id, lane.references_board_id] as const] : [],
            ),
          ),
        },
      ]),
    )
  }

  async add(board: Board): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.boards.create({
        data: {
          id: board.id,
          organization_id: board.organizationId,
          name: board.name,
          description: board.description,
          allow_user_status_update: board.allowUserStatusUpdate,
          is_archived: board.isArchived,
          archived_at_utc: board.archivedAtUtc,
          key_prefix: board.keyPrefix,
          sprints_enabled: board.sprintsEnabled,
          idea_features_enabled: board.ideaFeaturesEnabled,
          next_item_number: board.nextItemNumber,
          created_at_utc: board.createdAtUtc,
          updated_at_utc: board.updatedAtUtc,
          created_by_user_id: board.createdByUserId,
          updated_by_user_id: board.updatedByUserId,
        },
      }),
    )
    this.unitOfWork.enqueue(
      this.prisma.board_swimlanes.createMany({ data: this.swimlaneRows(board) }),
    )
  }

  async save(board: Board): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.boards.update({
        where: { id: board.id },
        data: {
          name: board.name,
          description: board.description,
          allow_user_status_update: board.allowUserStatusUpdate,
          is_archived: board.isArchived,
          archived_at_utc: board.archivedAtUtc,
          key_prefix: board.keyPrefix,
          sprints_enabled: board.sprintsEnabled,
          idea_features_enabled: board.ideaFeaturesEnabled,
          // next_item_number is deliberately absent: only the atomic allocation increments it, and
          // a save from a stale copy must never move it backwards.
          updated_at_utc: board.updatedAtUtc,
          updated_by_user_id: board.updatedByUserId,
        },
      }),
    )
    this.unitOfWork.enqueue(
      this.prisma.board_swimlanes.deleteMany({ where: { board_id: board.id } }),
    )
    this.unitOfWork.enqueue(
      this.prisma.board_swimlanes.createMany({ data: this.swimlaneRows(board) }),
    )
  }

  private swimlaneRows(board: Board) {
    return board.swimlanes.map((swimlane) => ({
      id: randomUUID(),
      board_id: board.id,
      status_id: swimlane.statusId,
      display_order: swimlane.displayOrder,
      is_final: swimlane.isFinal,
      references_board_id: swimlane.referencesBoardId,
      auto_create_task: swimlane.autoCreateTask === true,
    }))
  }
}
