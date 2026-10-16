// Satisfies `ideas.IdeaDependenciesPort` over `idea_dependencies`. The writes are staged on the
// unit of work so a blocker replacement commits in the same transaction as whatever else the
// request changes; the reads exclude soft-deleted items.

import type { BlockerRef, DependencyEdge, IdeaDependenciesPort } from '@collega/application/ideas'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

export class PrismaIdeaDependencyRepository implements IdeaDependenciesPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async listBlockerIds(blockedId: string): Promise<readonly string[]> {
    const rows = await this.prisma.idea_dependencies.findMany({
      where: { blocked_idea_id: blockedId },
      select: { blocker_idea_id: true },
      orderBy: { blocker_idea_id: 'asc' },
    })
    return rows.map((row) => row.blocker_idea_id)
  }

  async listBlockersByBlockedIds(
    blockedIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly BlockerRef[]>> {
    if (blockedIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.idea_dependencies.findMany({
      where: { blocked_idea_id: { in: [...blockedIds] }, blocker: { is_deleted: false } },
      select: {
        blocked_idea_id: true,
        blocker: { select: { id: true, board_id: true, status_id: true, item_number: true } },
      },
      orderBy: [{ created_at_utc: 'asc' }, { blocker_idea_id: 'asc' }],
    })
    const byBlocked = new Map<string, BlockerRef[]>()
    for (const row of rows) {
      const refs = byBlocked.get(row.blocked_idea_id) ?? []
      refs.push({
        ideaId: row.blocker.id,
        boardId: row.blocker.board_id,
        statusId: row.blocker.status_id,
        itemNumber: row.blocker.item_number,
      })
      byBlocked.set(row.blocked_idea_id, refs)
    }
    return byBlocked
  }

  async listEdgesForBoard(boardId: string): Promise<readonly DependencyEdge[]> {
    const rows = await this.prisma.idea_dependencies.findMany({
      where: { blocked: { board_id: boardId, is_deleted: false } },
      select: { blocked_idea_id: true, blocker_idea_id: true },
    })
    return rows.map((row) => ({ blockedId: row.blocked_idea_id, blockerId: row.blocker_idea_id }))
  }

  async replaceBlockers(
    blockedId: string,
    blockerIds: readonly string[],
    nowUtc: Date,
  ): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.idea_dependencies.deleteMany({ where: { blocked_idea_id: blockedId } }),
    )
    if (blockerIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.idea_dependencies.createMany({
          data: blockerIds.map((blockerId) => ({
            blocked_idea_id: blockedId,
            blocker_idea_id: blockerId,
            created_at_utc: nowUtc,
          })),
        }),
      )
    }
  }

  async deleteAllFor(ideaId: string): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.idea_dependencies.deleteMany({
        where: { OR: [{ blocked_idea_id: ideaId }, { blocker_idea_id: ideaId }] },
      }),
    )
  }
}
