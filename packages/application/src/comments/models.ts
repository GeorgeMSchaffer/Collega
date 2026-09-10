import type { SortDirection } from '../common/index.js'
// The person shape every idea payload already carries, borrowed rather than restated: a comment
// author renders the same avatar and the same name as an assignee, and the idea detail embeds
// these very comments. Declaring a second identical type here would give a client two ways to read
// one person. A type only - Comments still owns its own ports, for the reason ports.ts gives.
import type { IdeaAssigneeDto } from '../ideas/models.js'

/**
 * `mentionEmails` is additive beyond SPEC/30-Contracts.md's body-only comment request shape, so
 * comments honor "Comments" #5's requirement of the same email-based mention behavior as ideas -
 * mirrors .NET's `CreateCommentCommand` (flagged there as a contract gap for the same reason).
 */
export type CreateCommentCommand = {
  readonly body: string
  readonly mentionEmails: readonly string[] | null
}

export type UpdateCommentCommand = {
  readonly body: string
  readonly mentionEmails: readonly string[] | null
}

export type CommentListQuery = {
  readonly page: number | null
  readonly pageSize: number | null
  readonly sortDirection: SortDirection | null
}

export type CommentListItem = {
  readonly commentId: string
  readonly ideaId: string
  readonly authorUserId: string
  /**
   * Who wrote it. The same object the idea detail's embedded comments carry, so a thread rendered
   * from this endpoint and one rendered from the detail agree on the name and the avatar.
   *
   * Nullable because `comments.author_user_id` carries no foreign key (the schema is frozen at
   * S0.2) and nothing else guarantees the row. Deactivation is not that case: an inactive user is
   * still returned, named, with `isActive` false.
   */
  readonly author: IdeaAssigneeDto | null
  readonly body: string
  readonly createdAtUtc: Date
  readonly updatedAtUtc: Date
}

export type CommentListResult = {
  readonly items: readonly CommentListItem[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: SortDirection
}

export type CreateCommentResult = {
  readonly commentId: string
  readonly ideaId: string
}
