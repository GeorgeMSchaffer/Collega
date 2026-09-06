import type { IdeaUpvote } from '@collega/domain/upvotes'

export interface IdeaUpvoteRepository {
  getByIdeaAndUser(ideaId: string, userId: string): Promise<IdeaUpvote | null>

  add(upvote: IdeaUpvote): Promise<void>

  /** Removes the given upvote. Scoping the earlier `getByIdeaAndUser` lookup to the caller is
   * what makes this "only the user who cast it can remove it" (rule #33 / "Upvotes" #5). */
  remove(upvote: IdeaUpvote): Promise<void>

  countByIdea(ideaId: string): Promise<number>
}

/**
 * The narrow slice of Ideas this feature needs: whether the idea exists (and isn't soft-deleted)
 * and which organization it belongs to, for scoping. Deliberately not `IdeaRepository` from the
 * sibling `ideas` feature - upvoting does not need the full aggregate, and this keeps the feature
 * folder independently reachable per the subpath-export convention. Wave C can satisfy this with
 * the same repository that backs `ideas`.
 */
export interface IdeaLookupPort {
  getOrganizationId(ideaId: string): Promise<string | null>
}

export interface Clock {
  nowUtc(): Date
}

export type AuditEventInput = {
  readonly eventType: string
  readonly entityType: string
  readonly message: string
  readonly occurredAtUtc: Date
  readonly organizationId: string | null
  readonly actorUserId: string | null
  readonly entityId: string | null
  readonly metadataJson: string | null
  readonly onBehalfOfUserId: string | null
}

export interface AuditEventWriter {
  write(event: AuditEventInput): Promise<void>
}
