import { UpvoteDomainError } from './errors.js'

export type RestoreIdeaUpvoteProps = {
  readonly id: string
  readonly ideaId: string
  readonly userId: string
  readonly createdAtUtc: Date
}

/**
 * A single user's active upvote on an idea (SPEC/20-feature-ideas-and-engagement.md "Upvotes").
 * Upvoting is a toggle: a user has at most one active upvote per idea, enforced by the database's
 * `ux_idea_upvotes_idea_id_user_id` unique index rather than re-checked here, and only the user who
 * cast an upvote can remove it (an Application-layer concern - the lookup is scoped to the caller).
 */
export class IdeaUpvote {
  #id: string
  #ideaId: string
  #userId: string
  #createdAtUtc: Date

  private constructor(id: string, ideaId: string, userId: string, createdAtUtc: Date) {
    this.#id = id
    this.#ideaId = ideaId
    this.#userId = userId
    this.#createdAtUtc = createdAtUtc
  }

  static create(ideaId: string, userId: string, nowUtc: Date): IdeaUpvote {
    if (!ideaId || ideaId.trim().length === 0) {
      throw new UpvoteDomainError('ideaId', 'Idea id is required.')
    }
    if (!userId || userId.trim().length === 0) {
      throw new UpvoteDomainError('userId', 'User id is required.')
    }
    return new IdeaUpvote(crypto.randomUUID(), ideaId, userId, nowUtc)
  }

  static restore(props: RestoreIdeaUpvoteProps): IdeaUpvote {
    return new IdeaUpvote(props.id, props.ideaId, props.userId, props.createdAtUtc)
  }

  get id(): string {
    return this.#id
  }

  get ideaId(): string {
    return this.#ideaId
  }

  get userId(): string {
    return this.#userId
  }

  get createdAtUtc(): Date {
    return this.#createdAtUtc
  }
}
