import { randomUUID } from 'node:crypto'
import { Role } from '@collega/domain/enums'
import { createIdeaUpvote } from '@collega/domain/upvotes'
import type { AuditEventWriter, Clock, CurrentUserContext, UnitOfWork } from '../common/index.js'
import {
  attributeAudit,
  ensureNotDirectSiteAdmin,
  NotFoundError,
  UnauthorizedError,
} from '../common/index.js'
import type { UpvoteToggleResult } from './models.js'
import type { IdeaLookupPort, IdeaUpvoteRepository } from './ports.js'

/**
 * Upvote use cases (SPEC/20-feature-ideas-and-engagement.md "Upvotes"). Toggling is the only
 * mutation: a user has at most one active upvote per idea (the database's
 * `ux_idea_upvotes_idea_id_user_id` unique index is the actual guarantee), and only the user who
 * cast an upvote can remove it - enforced here by scoping the lookup to the caller.
 */
export class UpvoteService {
  constructor(
    private readonly upvoteRepository: IdeaUpvoteRepository,
    private readonly ideas: IdeaLookupPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async toggle(ideaId: string): Promise<UpvoteToggleResult> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    // All authenticated users, including Read Only, can upvote ("Upvotes" #1).
    const userId = this.requireAuthenticatedUserId()

    const organizationId = await this.ideas.getOrganizationId(ideaId)
    if (organizationId === null) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(organizationId)

    const now = this.clock.now()
    const existing = await this.upvoteRepository.getByIdeaAndUser(ideaId, userId)

    let hasUpvoted: boolean
    if (existing === null) {
      await this.upvoteRepository.add(
        createIdeaUpvote({ id: randomUUID(), ideaId, userId, nowUtc: now }),
      )
      hasUpvoted = true
    } else {
      await this.upvoteRepository.remove(existing)
      hasUpvoted = false
    }

    await this.unitOfWork.saveChanges()

    const count = await this.upvoteRepository.countByIdea(ideaId)

    await this.auditEvents.write({
      eventType: hasUpvoted ? 'IdeaUpvoteAdded' : 'IdeaUpvoteRemoved',
      entityType: 'Idea',
      message: `Idea upvote ${hasUpvoted ? 'added' : 'removed'}.`,
      occurredAtUtc: now,
      organizationId,
      attribution: attributeAudit(this.currentUser, userId),
      entityId: ideaId,
      metadataJson: null,
    })

    return { ideaId, hasUpvoted, upvoteCount: count }
  }

  private requireAuthenticatedUserId(): string {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.userId
  }

  private ensureOrganizationScope(organizationId: string): void {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    if (this.currentUser.role === Role.SiteAdmin) {
      return
    }
    if (this.currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Idea not found.')
    }
  }
}
