// Satisfies `CommentRepository` (comments/ports.ts). `comment_mentions` rows carry no data beyond
// the (comment, user) pair and no id supplied by the domain - `Wave C generates each junction
// row's id at persistence time` per the domain's own doc comment, same as `idea_mentions`.

import { randomUUID } from 'node:crypto'
import type {
  CommentListFilter,
  CommentPage,
  CommentRepository,
} from '@collega/application/comments'
import type { CommentsPort as IdeasCommentsPort } from '@collega/application/ideas'
import type { Comment } from '@collega/domain/comments'
import type {
  comments as CommentRow,
  comment_mentions as MentionRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

type CommentRowWithMentions = CommentRow & { comment_mentions: MentionRow[] }

function fromRow(row: CommentRowWithMentions): Comment {
  return {
    id: row.id,
    ideaId: row.idea_id,
    authorUserId: row.author_user_id,
    body: row.body,
    mentionedUserIds: row.comment_mentions.map((m) => m.mentioned_user_id),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaCommentRepository implements CommentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async getById(commentId: string): Promise<Comment | null> {
    const row = await this.prisma.comments.findUnique({
      where: { id: commentId },
      include: { comment_mentions: true },
    })
    return row ? fromRow(row) : null
  }

  async add(comment: Comment): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.comments.create({
        data: {
          id: comment.id,
          idea_id: comment.ideaId,
          author_user_id: comment.authorUserId,
          body: comment.body,
          created_at_utc: comment.createdAtUtc,
          updated_at_utc: comment.updatedAtUtc,
          created_by_user_id: comment.createdByUserId,
          updated_by_user_id: comment.updatedByUserId,
        },
      }),
    )
    if (comment.mentionedUserIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.comment_mentions.createMany({
          data: comment.mentionedUserIds.map((userId) => ({
            id: randomUUID(),
            comment_id: comment.id,
            mentioned_user_id: userId,
          })),
        }),
      )
    }
  }

  async update(comment: Comment): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.comments.update({
        where: { id: comment.id },
        data: {
          body: comment.body,
          updated_at_utc: comment.updatedAtUtc,
          updated_by_user_id: comment.updatedByUserId,
        },
      }),
    )
    this.unitOfWork.enqueue(
      this.prisma.comment_mentions.deleteMany({ where: { comment_id: comment.id } }),
    )
    if (comment.mentionedUserIds.length > 0) {
      this.unitOfWork.enqueue(
        this.prisma.comment_mentions.createMany({
          data: comment.mentionedUserIds.map((userId) => ({
            id: randomUUID(),
            comment_id: comment.id,
            mentioned_user_id: userId,
          })),
        }),
      )
    }
  }

  async remove(comment: Comment): Promise<void> {
    // `comment_mentions` cascades on delete (FK_comment_mentions_comments_comment_id ON DELETE
    // CASCADE), so only the comment row itself needs enqueueing.
    this.unitOfWork.enqueue(this.prisma.comments.delete({ where: { id: comment.id } }))
  }

  async listByIdea(filter: CommentListFilter): Promise<CommentPage<Comment>> {
    const direction = filter.sortDirection === 'desc' ? 'desc' : 'asc'
    const where = { idea_id: filter.ideaId }

    const [rows, totalCount] = await Promise.all([
      this.prisma.comments.findMany({
        where,
        include: { comment_mentions: true },
        // TOTAL ORDER: `id` is the only other stable column on this table, used strictly as a
        // last-resort tie-break behind the meaningful `created_at_utc`, not in place of it.
        orderBy: [{ created_at_utc: direction }, { id: 'asc' }],
        skip: (filter.page.page - 1) * filter.page.pageSize,
        take: filter.page.pageSize,
      }),
      this.prisma.comments.count({ where }),
    ])

    return {
      items: rows.map(fromRow),
      page: filter.page.page,
      pageSize: filter.page.pageSize,
      totalCount,
      // The literal `EfCommentRepository.ListByIdeaAsync` returned, not `null`: this list has no
      // sort switch - it is always chronological - but it still ECHOES the column it ordered by,
      // and every recorded comment-list fixture pins `"createdAtUtc"`.
      sortBy: 'createdAtUtc',
      sortDirection: direction,
    }
  }

  async countByIdea(ideaId: string): Promise<number> {
    return this.prisma.comments.count({ where: { idea_id: ideaId } })
  }

  async countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (ideaIds.length === 0) {
      return new Map()
    }
    const grouped = await this.prisma.comments.groupBy({
      by: ['idea_id'],
      where: { idea_id: { in: [...ideaIds] } },
      _count: { _all: true },
    })
    return new Map(grouped.map((g) => [g.idea_id, g._count._all]))
  }
}

/** Satisfies `ideas.CommentsPort` (a narrower, unpaged read used by the idea detail/list
 * projection). Separate from `PrismaCommentRepository` because both ports declare a method
 * named `listByIdea` with incompatible signatures (paged `Comment` vs. unpaged
 * `IdeaCommentSummary`) - one class cannot implement both under that name. */
export class IdeaCommentsLookupRepository implements IdeasCommentsPort {
  constructor(private readonly prisma: PrismaClient) {}

  async listByIdea(ideaId: string): Promise<
    readonly {
      readonly commentId: string
      readonly ideaId: string
      readonly authorUserId: string
      readonly body: string
      readonly createdAtUtc: Date
      readonly updatedAtUtc: Date
    }[]
  > {
    const rows = await this.prisma.comments.findMany({
      where: { idea_id: ideaId },
      orderBy: [{ created_at_utc: 'asc' }, { id: 'asc' }],
    })
    return rows.map((row) => ({
      commentId: row.id,
      ideaId: row.idea_id,
      authorUserId: row.author_user_id,
      body: row.body,
      createdAtUtc: row.created_at_utc,
      updatedAtUtc: row.updated_at_utc,
    }))
  }

  async countByIdea(ideaId: string): Promise<number> {
    return this.prisma.comments.count({ where: { idea_id: ideaId } })
  }

  async countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (ideaIds.length === 0) {
      return new Map()
    }
    const grouped = await this.prisma.comments.groupBy({
      by: ['idea_id'],
      where: { idea_id: { in: [...ideaIds] } },
      _count: { _all: true },
    })
    return new Map(grouped.map((g) => [g.idea_id, g._count._all]))
  }
}
