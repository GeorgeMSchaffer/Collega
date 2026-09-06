// Comment use cases (SPEC/20-feature-ideas-and-engagement.md "Comments", SPEC/30-Contracts.md
// "Comment Contracts"). All authenticated users of the idea's organization, including Read Only,
// can comment; authors edit and delete their own; in-scope admins can delete any.

import { randomUUID } from 'node:crypto'
import {
  type Comment,
  CommentDomainError,
  createComment,
  editComment,
} from '@collega/domain/comments'
import { NotificationEventType, Role, UserStatus } from '@collega/domain/enums'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  normalizePageRequest,
  type PageRequest,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type { NotificationWriter } from '../notifications/index.js'
import type {
  CommentListItem,
  CommentListQuery,
  CommentListResult,
  CreateCommentCommand,
  CreateCommentResult,
  UpdateCommentCommand,
} from './models.js'
import type { CommentRepository, IdeaLookupPort, IdeaSummary, UsersPort } from './ports.js'

const VALIDATION_TITLE = 'One or more fields are invalid.'
const MENTION_FIELD = 'mentionEmails'

// `exactOptionalPropertyTypes` refuses `{ page: number | undefined }` for an optional `page?:
// number` - the key must be absent, not present-with-undefined. Mirrors users/user-service.ts.
function toPageRequestInput(page: number | null, pageSize: number | null): Partial<PageRequest> {
  return {
    ...(page !== null ? { page } : {}),
    ...(pageSize !== null ? { pageSize } : {}),
  }
}

export class CommentService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly ideas: IdeaLookupPort,
    private readonly users: UsersPort,
    private readonly notifications: NotificationWriter,
    private readonly unitOfWork: UnitOfWork,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async listByIdea(ideaId: string, query: CommentListQuery): Promise<CommentListResult> {
    const idea = await this.loadIdeaInScope(ideaId)

    const page = await this.comments.listByIdea({
      ideaId: idea.id,
      page: normalizePageRequest(toPageRequestInput(query.page, query.pageSize)),
      sortDirection: query.sortDirection,
    })

    return {
      items: page.items.map(toListItem),
      page: page.page,
      pageSize: page.pageSize,
      totalCount: page.totalCount,
      sortBy: page.sortBy,
      sortDirection: page.sortDirection,
    }
  }

  async create(ideaId: string, command: CreateCommentCommand): Promise<CreateCommentResult> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    // All authenticated users, including Read Only, can comment ("Comments" #1).
    const idea = await this.loadIdeaInScope(ideaId)

    const now = this.clock.now()
    const authorId = this.requireAuthenticatedUserId()
    const mentionedUserIds = await this.resolveMentions(idea.organizationId, command.mentionEmails)

    const comment = runDomain(createComment, {
      id: randomUUID(),
      ideaId: idea.id,
      authorUserId: authorId,
      body: command.body ?? '',
      mentionedUserIds,
      nowUtc: now,
    })
    await this.comments.add(comment)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'CommentCreated',
      idea.organizationId,
      comment.id,
      'Comment added to idea.',
      now,
      idea.id,
    )

    // Notify mentioned users (trigger #2) and the idea author + assignees (trigger #3). Persisted
    // only, never delivered (SPEC/20-feature-notifications.md).
    await this.notifyComment(idea, mentionedUserIds, authorId)

    return { commentId: comment.id, ideaId: idea.id }
  }

  async update(commentId: string, command: UpdateCommentCommand): Promise<CommentListItem> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    const comment = await this.comments.getById(commentId)
    if (comment === null) {
      throw new NotFoundError('Comment not found.')
    }
    const idea = await this.loadIdeaInScope(comment.ideaId)

    const actorId = this.requireAuthenticatedUserId()

    // Only the author can edit their own comment ("Comments" #3). Admins may delete, not edit.
    if (comment.authorUserId !== actorId) {
      throw new ForbiddenError('You can only edit your own comments.')
    }

    const now = this.clock.now()
    const mentionedUserIds = await this.resolveMentions(idea.organizationId, command.mentionEmails)

    const updated = runDomain(
      editComment,
      comment,
      command.body ?? '',
      mentionedUserIds,
      now,
      actorId,
    )
    await this.comments.update(updated)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'CommentUpdated',
      idea.organizationId,
      updated.id,
      'Comment edited.',
      now,
      idea.id,
    )

    return toListItem(updated)
  }

  async delete(commentId: string): Promise<void> {
    // Rule 25: org content is mutated through View As, not directly as a Site Admin.
    ensureNotDirectSiteAdmin(this.currentUser)
    const comment = await this.comments.getById(commentId)
    if (comment === null) {
      throw new NotFoundError('Comment not found.')
    }
    const idea = await this.loadIdeaInScope(comment.ideaId)

    const actorId = this.requireAuthenticatedUserId()

    // The author, an in-scope Org Admin, or Site Admin can delete ("Comments" #3-4).
    if (comment.authorUserId !== actorId && !this.canAdministerOrganization(idea.organizationId)) {
      throw new ForbiddenError('You are not allowed to delete this comment.')
    }

    const now = this.clock.now()
    await this.comments.remove(comment)
    await this.unitOfWork.saveChanges()

    await this.audit(
      'CommentDeleted',
      idea.organizationId,
      comment.id,
      'Comment deleted.',
      now,
      idea.id,
    )
  }

  private async loadIdeaInScope(ideaId: string): Promise<IdeaSummary> {
    const idea = await this.ideas.getById(ideaId)
    if (idea === null) {
      throw new NotFoundError('Idea not found.')
    }

    const role = this.requireAuthenticatedRole()
    if (role !== Role.SiteAdmin && this.currentUser.organizationId !== idea.organizationId) {
      throw new NotFoundError('Idea not found.')
    }

    return idea
  }

  private canAdministerOrganization(organizationId: string): boolean {
    const role = this.requireAuthenticatedRole()
    return (
      role === Role.SiteAdmin ||
      (role === Role.OrgAdmin && this.currentUser.organizationId === organizationId)
    )
  }

  private requireAuthenticatedUserId(): string {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.userId
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private async audit(
    eventType: string,
    organizationId: string,
    commentId: string,
    message: string,
    occurredAtUtc: Date,
    ideaId: string,
  ): Promise<void> {
    // Rule 14: while acting as someone, the real administrator is the actor and the target moves
    // to onBehalfOfUserId - an audit row must never read as though the target did it.
    const attribution = attributeAudit(this.currentUser, this.currentUser.userId)
    await this.auditEvents.write({
      eventType,
      entityType: 'Comment',
      message,
      occurredAtUtc,
      organizationId,
      attribution,
      entityId: commentId,
      metadataJson: JSON.stringify({ Id: ideaId, CommentId: commentId }),
    })
  }

  /**
   * Emits notification events for a new comment: one `CommentMention` per mentioned user, and one
   * `CommentAdded` per idea author or assignee. The two triggers are independent, so a user who is
   * both mentioned and a follower may receive both (SPEC/20-feature-notifications.md
   * "Recipients"). Self- and duplicate-recipient suppression is applied here and defensively
   * again by `NotificationWriter`.
   */
  private async notifyComment(
    idea: IdeaSummary,
    mentionedUserIds: readonly string[],
    actorId: string,
  ): Promise<void> {
    const mentionRecipients = new Set(
      mentionedUserIds.filter((id) => id.length > 0 && id !== actorId),
    )
    for (const recipientId of mentionRecipients) {
      await this.notifications.notify({
        eventType: NotificationEventType.CommentMention,
        organizationId: idea.organizationId,
        boardId: idea.boardId,
        ideaId: idea.id,
        ideaTitle: idea.title,
        actorUserId: actorId,
        recipientUserId: recipientId,
      })
    }

    const followers = new Set([idea.authorUserId, ...idea.assigneeUserIds])
    for (const recipientId of followers) {
      if (recipientId.length === 0 || recipientId === actorId) {
        continue
      }
      await this.notifications.notify({
        eventType: NotificationEventType.CommentAdded,
        organizationId: idea.organizationId,
        boardId: idea.boardId,
        ideaId: idea.id,
        ideaTitle: idea.title,
        actorUserId: actorId,
        recipientUserId: recipientId,
      })
    }
  }

  /**
   * Resolves raw @-mention email strings to same-organization active user ids. Mirrors .NET's
   * `MentionResolver`, kept local since Comments does not depend on Users' `UserRepository` (see
   * ports.ts) - the identical logic is duplicated in Ideas' own `idea.service.ts` for the same
   * reason.
   */
  private async resolveMentions(
    organizationId: string,
    mentionEmails: readonly string[] | null,
  ): Promise<readonly string[]> {
    if (!mentionEmails || mentionEmails.length === 0) {
      return []
    }

    const resolved: string[] = []
    const errors: string[] = []
    const seen = new Set<string>()

    for (const raw of mentionEmails) {
      const trimmed = raw?.trim()
      if (!trimmed) {
        continue
      }

      const normalized = trimmed.toLowerCase()
      if (seen.has(normalized)) {
        continue
      }
      seen.add(normalized)

      const user = await this.users.findByNormalizedEmail(normalized)
      if (
        !user ||
        user.organizationId !== organizationId ||
        user.role === Role.SiteAdmin ||
        user.status !== UserStatus.Active
      ) {
        errors.push(`Mention '${trimmed}' could not be resolved to a user in your organization.`)
        continue
      }

      resolved.push(user.id)
    }

    if (errors.length > 0) {
      throw new ValidationError(VALIDATION_TITLE, { [MENTION_FIELD]: errors })
    }

    return resolved
  }
}

function toListItem(comment: Comment): CommentListItem {
  return {
    commentId: comment.id,
    ideaId: comment.ideaId,
    authorUserId: comment.authorUserId,
    body: comment.body,
    createdAtUtc: comment.createdAtUtc,
    updatedAtUtc: comment.updatedAtUtc,
  }
}

/**
 * Wraps a domain transition so a `CommentDomainError` (a plain-Error invariant violation -
 * packages/domain imports nothing, so it cannot throw the kernel's `ValidationError` itself)
 * surfaces as a proper field-level 400, mirroring how .NET's request-DTO validation attributes
 * (`CreateCommentRequest.Body`) turned a blank/oversized body into this same shape before the
 * domain was ever reached (ideas/idea.service.ts's `runDomain` is the reference for this pattern).
 */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof CommentDomainError) {
      throw new ValidationError(VALIDATION_TITLE, { [error.field]: [error.message] })
    }
    throw error
  }
}
