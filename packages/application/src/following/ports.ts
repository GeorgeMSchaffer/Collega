import type { IdeaFollower } from '@collega/domain/followers'

/**
 * `idea_followers`. Writes are staged on the unit of work, so an idea save and the follow rows it
 * implies commit together.
 */
export interface IdeaFollowerRepository {
  /** Stages the rows; a person who already follows the idea is left as they are. */
  add(followers: readonly IdeaFollower[]): Promise<void>

  /** Stages the removal of this person's row, if there is one. */
  remove(ideaId: string, userId: string): Promise<void>

  isFollowing(ideaId: string, userId: string): Promise<boolean>

  countByIdea(ideaId: string): Promise<number>
}

export type FollowIdeaSummary = {
  readonly organizationId: string
}

/** The narrow slice of Ideas this feature needs. Excludes soft-deleted ideas, which answer `404`. */
export interface IdeaLookupPort {
  getById(ideaId: string): Promise<FollowIdeaSummary | null>
}
