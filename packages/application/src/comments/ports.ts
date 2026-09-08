import type { Comment } from '@collega/domain/comments'
import type { Role, UserStatus } from '@collega/domain/enums'
import type { PageRequest, SortDirection } from '../common/index.js'

// Persistence ---------------------------------------------------------------------------------

export type CommentListFilter = {
  readonly ideaId: string
  readonly page: PageRequest
  /** Requested direction only - chronological (`createdAtUtc`) order and the resolved direction
   * default are the repository's job, matching Users' `UserRepository.listByOrganization`. */
  readonly sortDirection: SortDirection | null
}

export type CommentPage<T> = {
  readonly items: readonly T[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: string | null
  readonly sortDirection: SortDirection
}

export interface CommentRepository {
  getById(commentId: string): Promise<Comment | null>

  add(comment: Comment): Promise<void>

  /** Persists an edited comment - the domain function returns a new immutable value rather than
   * mutating in place, so update is its own call (unlike .NET's EF change tracking). */
  update(comment: Comment): Promise<void>

  remove(comment: Comment): Promise<void>

  /** Paged chronological comment list for an idea (SPEC/30-Contracts.md "Comment Contracts"). */
  listByIdea(filter: CommentListFilter): Promise<CommentPage<Comment>>

  countByIdea(ideaId: string): Promise<number>

  /** Comment counts keyed by idea id, for enriching the board idea list. */
  countByIdeaIds(ideaIds: readonly string[]): Promise<ReadonlyMap<string, number>>
}

// Ideas (cross-partition) ----------------------------------------------------------------------
//
// The narrow slice of Ideas this feature needs: enough to scope a comment to its idea's
// organization and to build "comment added" notifications to the idea's author and assignees.
// Deliberately not `IdeaRepository` from the `ideas` feature (not this partition's, at that -
// Ideas is owned by a concurrent partition) - mirrors Upvotes' `IdeaLookupPort` and Ideas' own
// locally-declared `TagsPort`/`CommentsPort`/`UsersPort`/`BoardsPort`: each feature declares the
// exact shape it needs and Wave C satisfies every such port from the same underlying data.

export type IdeaSummary = {
  readonly id: string
  readonly organizationId: string
  readonly boardId: string
  readonly title: string
  readonly authorUserId: string
  readonly assigneeUserIds: readonly string[]
}

export interface IdeaLookupPort {
  /** Excludes soft-deleted ideas, mirroring `IIdeaRepository.GetByIdAsync(includeDeleted: false)`. */
  getById(ideaId: string): Promise<IdeaSummary | null>
}

// Users (cross-partition, B1) -------------------------------------------------------------------
//
// Mention resolution's narrow needs only - kept local rather than depending on Users'
// `UserRepository`, matching how Ideas kept its own copy of the identical .NET `MentionResolver`
// logic local rather than importing it from here.

export type UserSummary = {
  readonly id: string
  readonly organizationId: string | null
  readonly role: Role
  readonly status: UserStatus
}

export interface UsersPort {
  /** Global lookup by normalized (trimmed, lowercased) email, for mention resolution. The caller
   * still checks organization/role/status - mirrors .NET's `MentionResolver`. */
  findByNormalizedEmail(normalizedEmail: string): Promise<UserSummary | null>
}
