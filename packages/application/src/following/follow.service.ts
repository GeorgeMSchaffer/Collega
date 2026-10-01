import { randomUUID } from 'node:crypto'
import { createIdeaFollower } from '@collega/domain/followers'
import type { Clock, CurrentUserContext, UnitOfWork } from '../common/index.js'
import { ensureNotDirectSiteAdmin, NotFoundError, UnauthorizedError } from '../common/index.js'
import type { FollowResult } from './models.js'
import type { IdeaFollowerRepository, IdeaLookupPort } from './ports.js'

/**
 * Following and unfollowing an idea, for the caller only (SPEC/20-feature-idea-following.md rules
 * 1-8, SPEC/contracts/following.md). No route names another user.
 *
 * Following is a read: it is open to Read Only, allowed on an archived board and on a promoted
 * Issue, writes no audit event and no notification, and leaves the idea's `updated_at_utc` alone.
 * A Site Admin acting as themselves is refused like an upvote (rule 8); through View As the caller
 * is the target and follows as them.
 */
export class FollowService {
  constructor(
    private readonly followers: IdeaFollowerRepository,
    private readonly ideas: IdeaLookupPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async follow(ideaId: string): Promise<FollowResult> {
    const userId = await this.authorize(ideaId)
    if (!(await this.followers.isFollowing(ideaId, userId))) {
      await this.followers.add([
        createIdeaFollower({ id: randomUUID(), ideaId, userId, nowUtc: this.clock.now() }),
      ])
      await this.unitOfWork.saveChanges()
    }
    return { ideaId, isFollowing: true, followerCount: await this.followers.countByIdea(ideaId) }
  }

  async unfollow(ideaId: string): Promise<FollowResult> {
    const userId = await this.authorize(ideaId)
    if (await this.followers.isFollowing(ideaId, userId)) {
      await this.followers.remove(ideaId, userId)
      await this.unitOfWork.saveChanges()
    }
    return { ideaId, isFollowing: false, followerCount: await this.followers.countByIdea(ideaId) }
  }

  /** The caller's id, once the idea is known to exist in their organization. */
  private async authorize(ideaId: string): Promise<string> {
    ensureNotDirectSiteAdmin(this.currentUser)
    if (
      !this.currentUser.isAuthenticated ||
      this.currentUser.userId === null ||
      this.currentUser.role === null
    ) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }

    const idea = await this.ideas.getById(ideaId)
    // A Site Admin cannot reach here (refused above), so every caller is an organization member.
    if (idea === null || this.currentUser.organizationId !== idea.organizationId) {
      throw new NotFoundError('Idea not found.')
    }
    return this.currentUser.userId
  }
}
