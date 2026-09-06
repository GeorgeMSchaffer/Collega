import { Role } from '@collega/domain/enums'
import { createIdeaUpvote } from '@collega/domain/upvotes'
import type { AuditEventWriter, Clock, CurrentUserContext } from '../common/index.js'
import {
  attributeAudit,
  ensureNotDirectSiteAdmin,
  NotFoundError,
  UnauthorizedError,
} from '../common/index.js'
import type { UpvoteToggleResult } from './models.js'
import type { IdeaLookupPort, IdeaUpvoteRepository } from './ports.js'

export type UpvoteServiceDeps = {
  readonly upvoteRepository: IdeaUpvoteRepository
  readonly ideas: IdeaLookupPort
  readonly auditEvents: AuditEventWriter
  readonly clock: Clock
  readonly currentUser: CurrentUserContext
}

/**
 * Upvote use cases (SPEC/20-feature-ideas-and-engagement.md "Upvotes"). Toggling is the only
 * mutation: a user has at most one active upvote per idea (the database's
 * `ux_idea_upvotes_idea_id_user_id` unique index is the actual guarantee), and only the user who
 * cast an upvote can remove it - enforced here by scoping the lookup to the caller.
 */
export class UpvoteService {
  readonly #deps: UpvoteServiceDeps

  constructor(deps: UpvoteServiceDeps) {
    this.#deps = deps
  }

  async toggle(ideaId: string): Promise<UpvoteToggleResult> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.#deps.currentUser)
    // All authenticated users, including Read Only, can upvote ("Upvotes" #1).
    const userId = this.requireAuthenticatedUserId()

    const organizationId = await this.#deps.ideas.getOrganizationId(ideaId)
    if (organizationId === null) {
      throw new NotFoundError('Idea not found.')
    }
    this.ensureOrganizationScope(organizationId)

    const now = this.#deps.clock.now()
    const existing = await this.#deps.upvoteRepository.getByIdeaAndUser(ideaId, userId)

    let hasUpvoted: boolean
    if (existing === null) {
      await this.#deps.upvoteRepository.add(
        createIdeaUpvote({ id: crypto.randomUUID(), ideaId, userId, nowUtc: now }),
      )
      hasUpvoted = true
    } else {
      await this.#deps.upvoteRepository.remove(existing)
      hasUpvoted = false
    }

    const count = await this.#deps.upvoteRepository.countByIdea(ideaId)

    await this.#deps.auditEvents.write({
      eventType: hasUpvoted ? 'IdeaUpvoteAdded' : 'IdeaUpvoteRemoved',
      entityType: 'Idea',
      message: `Idea upvote ${hasUpvoted ? 'added' : 'removed'}.`,
      occurredAtUtc: now,
      organizationId,
      attribution: attributeAudit(this.#deps.currentUser, userId),
      entityId: ideaId,
      metadataJson: null,
    })

    return { ideaId, hasUpvoted, upvoteCount: count }
  }

  private requireAuthenticatedUserId(): string {
    const currentUser = this.#deps.currentUser
    if (!currentUser.isAuthenticated || currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return currentUser.userId
  }

  private ensureOrganizationScope(organizationId: string): void {
    const currentUser = this.#deps.currentUser
    if (!currentUser.isAuthenticated || currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    if (currentUser.role === Role.SiteAdmin) {
      return
    }
    if (currentUser.organizationId !== organizationId) {
      throw new NotFoundError('Idea not found.')
    }
  }
}
