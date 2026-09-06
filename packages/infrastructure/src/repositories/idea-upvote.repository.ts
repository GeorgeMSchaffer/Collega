// Satisfies `IdeaUpvoteRepository` (upvotes/ports.ts). `countByIdeaIds` and `getUpvotedIdeaIds`
// are extra - not part of that interface - added so this same `idea_upvotes` adapter also
// satisfies `ideas.UpvoteCountsPort` (`countByIdea` is identical in both already).

import type { UpvoteCountsPort } from '@collega/application/ideas'
import type { IdeaUpvoteRepository } from '@collega/application/upvotes'
import type { IdeaUpvote } from '@collega/domain/upvotes'
import type { idea_upvotes as UpvoteRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: UpvoteRow): IdeaUpvote {
  return { id: row.id, ideaId: row.idea_id, userId: row.user_id, createdAtUtc: row.created_at_utc }
}

export class PrismaIdeaUpvoteRepository implements IdeaUpvoteRepository, UpvoteCountsPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getByIdeaAndUser(ideaId: string, userId: string): Promise<IdeaUpvote | null> {
    const row = await this.prisma.idea_upvotes.findUnique({
      where: { idea_id_user_id: { idea_id: ideaId, user_id: userId } },
    })
    return row ? fromRow(row) : null
  }

  async add(upvote: IdeaUpvote): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.idea_upvotes.create({
        data: {
          id: upvote.id,
          idea_id: upvote.ideaId,
          user_id: upvote.userId,
          created_at_utc: upvote.createdAtUtc,
        },
      }),
    )
  }

  async remove(upvote: IdeaUpvote): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.idea_upvotes.delete({ where: { id: upvote.id } }))
  }

  async countByIdea(ideaId: string): Promise<number> {
    return this.prisma.idea_upvotes.count({ where: { idea_id: ideaId } })
  }

  /** `ideas.UpvoteCountsPort.countByIdeaIds`. */
  async countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (ideaIds.length === 0) {
      return new Map()
    }
    const grouped = await this.prisma.idea_upvotes.groupBy({
      by: ['idea_id'],
      where: { idea_id: { in: [...ideaIds] } },
      _count: { _all: true },
    })
    return new Map(grouped.map((g) => [g.idea_id, g._count._all]))
  }

  /** `ideas.UpvoteCountsPort.getUpvotedIdeaIds` - the subset of `ideaIds` this user has upvoted. */
  async getUpvotedIdeaIds(
    userId: string,
    ideaIds: readonly string[],
  ): Promise<ReadonlySet<string>> {
    if (ideaIds.length === 0) {
      return new Set()
    }
    const rows = await this.prisma.idea_upvotes.findMany({
      where: { user_id: userId, idea_id: { in: [...ideaIds] } },
      select: { idea_id: true },
    })
    return new Set(rows.map((r) => r.idea_id))
  }
}
