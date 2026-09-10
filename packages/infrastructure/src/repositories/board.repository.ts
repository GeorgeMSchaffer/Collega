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
import type { BoardRepository } from '@collega/application/boards'
import type { BoardsPort } from '@collega/application/ideas'
import type { Board, BoardSwimlane } from '@collega/domain/boards'
import type {
  boards as BoardRow,
  board_swimlanes as SwimlaneRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type BoardRowWithSwimlanes = BoardRow & { board_swimlanes: SwimlaneRow[] }

function boardFromRow(row: BoardRowWithSwimlanes): Board {
  const swimlanes: BoardSwimlane[] = [...row.board_swimlanes]
    .sort((a, b) => a.display_order - b.display_order)
    .map((s) => ({ statusId: s.status_id, displayOrder: s.display_order }))

  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    allowUserStatusUpdate: row.allow_user_status_update,
    swimlanes,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaBoardRepository implements BoardRepository, AiBoardLookupPort, BoardsPort {
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

  /** `is_deleted: false` matches `PrismaIdeaRepository.listByBoard`'s filter, so this count and
   * that endpoint's `totalCount` answer the same question. */
  async countIdeasByBoard(boardIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (boardIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.ideas.groupBy({
      by: ['board_id'],
      where: { board_id: { in: [...boardIds] }, is_deleted: false },
      _count: { _all: true },
    })
    return new Map(rows.map((row) => [row.board_id, row._count._all]))
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
    readonly swimlanes: readonly { readonly statusId: string; readonly displayOrder: number }[]
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
      swimlanes: board.swimlanes,
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

  async add(board: Board): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.boards.create({
        data: {
          id: board.id,
          organization_id: board.organizationId,
          name: board.name,
          allow_user_status_update: board.allowUserStatusUpdate,
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
          allow_user_status_update: board.allowUserStatusUpdate,
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
    }))
  }
}
