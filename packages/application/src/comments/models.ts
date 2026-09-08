import type { SortDirection } from '../common/index.js'

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
