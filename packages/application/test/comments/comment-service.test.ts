// Comments and upvotes (SPEC/20-feature-ideas-and-engagement.md "Comments"/"Upvotes").
//
// The interesting role here is Read Only: it is the one place in the product where that role
// WRITES. It may comment and upvote and may not edit an idea, so a guard that lumps "write" into
// one permission breaks the feature, and a guard that lumps "engagement" in with editing opens it.

import { type Comment, createComment } from '@collega/domain/comments'
import { NotificationEventType, Role, UserStatus } from '@collega/domain/enums'
import { createIdeaUpvote, type IdeaUpvote } from '@collega/domain/upvotes'
import { describe, expect, it } from 'vitest'
import { CommentService } from '../../src/comments/comment.service.js'
import type { CommentListQuery } from '../../src/comments/models.js'
import type {
  CommentRepository,
  IdeaLookupPort,
  IdeaSummary,
  UserSummary,
  UsersPort,
} from '../../src/comments/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import type { NotificationInput } from '../../src/notifications/models.js'
import type {
  IdeaUpvoteRepository,
  IdeaLookupPort as UpvoteIdeaLookupPort,
} from '../../src/upvotes/ports.js'
import { UpvoteService } from '../../src/upvotes/upvote.service.js'
import {
  countingUnitOfWork,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const IDEA_A = 'idea-a'
const IDEA_B = 'idea-b'
const AUTHOR = 'author-1'

function ideaSummary(overrides: Partial<IdeaSummary> = {}): IdeaSummary {
  return {
    id: IDEA_A,
    organizationId: ORG_A,
    boardId: 'board-a',
    title: 'An idea',
    authorUserId: AUTHOR,
    assigneeUserIds: [],
    ...overrides,
  }
}

function userSummary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: AUTHOR,
    firstName: 'Ann',
    lastName: 'Author',
    organizationId: ORG_A,
    role: Role.User,
    status: UserStatus.Active,
    portraitPng: null,
    ...overrides,
  }
}

function comment(overrides: Partial<Comment> = {}): Comment {
  const base = createComment({
    id: 'comment-1',
    ideaId: IDEA_A,
    authorUserId: AUTHOR,
    body: 'A remark',
    mentionedUserIds: [],
    nowUtc: NOW,
  })
  return { ...base, ...overrides }
}

const LIST_QUERY: CommentListQuery = { page: null, pageSize: null, sortDirection: null }

type Emails = Record<string, UserSummary>

function commentHarness(options: {
  currentUser: CurrentUserContext
  ideas?: readonly IdeaSummary[]
  comments?: readonly Comment[]
  usersByEmail?: Emails
}) {
  const ideasById = new Map((options.ideas ?? [ideaSummary()]).map((i) => [i.id, i]))
  const commentsById = new Map((options.comments ?? []).map((c) => [c.id, c]))
  const added: Comment[] = []
  const updated: Comment[] = []
  const removed: Comment[] = []
  const notifications: NotificationInput[] = []

  const comments: CommentRepository = {
    async getById(id) {
      return commentsById.get(id) ?? null
    },
    async add(c) {
      added.push(c)
    },
    async update(c) {
      updated.push(c)
    },
    async remove(c) {
      removed.push(c)
    },
    async listByIdea(filter) {
      const items = [...commentsById.values()].filter((c) => c.ideaId === filter.ideaId)
      return {
        items,
        page: filter.page.page,
        pageSize: filter.page.pageSize,
        totalCount: items.length,
        sortBy: null,
        sortDirection: filter.sortDirection ?? 'asc',
      }
    },
    async countByIdea() {
      return commentsById.size
    },
    async countByIdeaIds() {
      return new Map()
    },
  }

  const ideas: IdeaLookupPort = {
    async getById(id) {
      return ideasById.get(id) ?? null
    },
  }

  const byEmail = options.usersByEmail ?? {}
  const users: UsersPort = {
    async listByIds(ids) {
      return ids.map((id) => userSummary({ id }))
    },
    async findByNormalizedEmail(email) {
      return byEmail[email] ?? null
    },
  }

  const audit = recordingAudit()

  return {
    service: new CommentService(
      comments,
      ideas,
      users,
      {
        async notify(input) {
          notifications.push(input)
        },
      },
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    updated,
    removed,
    notifications,
    audit,
  }
}

describe('CommentService cross-organization isolation', () => {
  const foreign = ideaSummary({ id: IDEA_B, organizationId: ORG_B })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s the comment thread of another organization’s idea', async (_l, currentUser) => {
    const { service } = commentHarness({ currentUser, ideas: [foreign] })

    await expect(service.listByIdea(IDEA_B, LIST_QUERY)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses commenting on another organization’s idea', async () => {
    const { service, added } = commentHarness({
      currentUser: member(ORG_A),
      ideas: [foreign],
    })

    await expect(service.create(IDEA_B, { body: 'Hi', mentionEmails: null })).rejects.toThrow(
      NotFoundError,
    )
    expect(added).toHaveLength(0)
  })

  it('refuses deleting a comment on another organization’s idea, reached by comment id', async () => {
    // The comment id is the route parameter; the scope check has to come from the parent idea.
    const { service, removed } = commentHarness({
      currentUser: orgAdmin(ORG_A),
      ideas: [foreign],
      comments: [comment({ ideaId: IDEA_B })],
    })

    await expect(service.delete('comment-1')).rejects.toThrow(NotFoundError)
    expect(removed).toHaveLength(0)
  })

  it('refuses a mention of a user in another organization', async () => {
    const { service } = commentHarness({
      currentUser: member(ORG_A),
      usersByEmail: { 'out@beta.test': userSummary({ id: 'outsider', organizationId: ORG_B }) },
    })

    await expect(
      service.create(IDEA_A, { body: 'Hi', mentionEmails: ['out@beta.test'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses a mention of an inactive user, and of a Site Admin', async () => {
    const { service } = commentHarness({
      currentUser: member(ORG_A),
      usersByEmail: {
        'gone@acme.test': userSummary({ id: 'gone', status: UserStatus.Inactive }),
        'sa@collega.test': userSummary({ id: 'sa', role: Role.SiteAdmin, organizationId: null }),
      },
    })

    await expect(
      service.create(IDEA_A, { body: 'Hi', mentionEmails: ['gone@acme.test'] }),
    ).rejects.toThrow(ValidationError)
    await expect(
      service.create(IDEA_A, { body: 'Hi', mentionEmails: ['sa@collega.test'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('lets a Site Admin read any organization’s thread', async () => {
    const { service } = commentHarness({ currentUser: siteAdmin(), ideas: [foreign] })

    await expect(service.listByIdea(IDEA_B, LIST_QUERY)).resolves.toMatchObject({ totalCount: 0 })
  })
})

describe('CommentService role matrix', () => {
  it('lets Read Only comment - the one place that role writes', async () => {
    const { service, added } = commentHarness({ currentUser: readOnly(ORG_A) })

    await service.create(IDEA_A, { body: 'A read-only remark', mentionEmails: null })

    expect(added).toHaveLength(1)
  })

  it('refuses a direct Site Admin commenting (rule 25)', async () => {
    const { service, added } = commentHarness({ currentUser: siteAdmin() })

    await expect(service.create(IDEA_A, { body: 'Hi', mentionEmails: null })).rejects.toThrow(
      ForbiddenError,
    )
    expect(added).toHaveLength(0)
  })

  it('lets that Site Admin comment through View As', async () => {
    const { service, added, audit } = commentHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.create(IDEA_A, { body: 'Hi', mentionEmails: null })

    expect(added[0]?.authorUserId).toBe('target-1')
    expect(audit.events[0]?.attribution.actorUserId).toBe('sa-9')
    expect(audit.events[0]?.attribution.onBehalfOfUserId).toBe('target-1')
  })

  it('lets only the author edit their own comment - an admin may delete, not edit', async () => {
    const stranger = commentHarness({
      currentUser: orgAdmin(ORG_A),
      comments: [comment()],
    })
    await expect(
      stranger.service.update('comment-1', { body: 'Rewritten', mentionEmails: null }),
    ).rejects.toThrow(ForbiddenError)

    const author = commentHarness({
      currentUser: member(ORG_A, AUTHOR),
      comments: [comment()],
    })
    await author.service.update('comment-1', { body: 'Rewritten', mentionEmails: null })
    expect(author.updated[0]?.body).toBe('Rewritten')
  })

  it('lets the author or an in-scope admin delete, and refuses a bystander', async () => {
    const author = commentHarness({ currentUser: member(ORG_A, AUTHOR), comments: [comment()] })
    await author.service.delete('comment-1')
    expect(author.removed).toHaveLength(1)

    const admin = commentHarness({ currentUser: orgAdmin(ORG_A), comments: [comment()] })
    await admin.service.delete('comment-1')
    expect(admin.removed).toHaveLength(1)

    const bystander = commentHarness({
      currentUser: member(ORG_A, 'someone-else'),
      comments: [comment()],
    })
    await expect(bystander.service.delete('comment-1')).rejects.toThrow(ForbiddenError)
    expect(bystander.removed).toHaveLength(0)
  })

  it('refuses an Org Admin of another organization the delete, because the admin check is org-scoped', async () => {
    const { service, removed } = commentHarness({
      currentUser: orgAdmin(ORG_B, 'admin-b'),
      ideas: [ideaSummary()],
      comments: [comment()],
    })

    // The scope check on the parent idea fires first; either way nothing is removed.
    await expect(service.delete('comment-1')).rejects.toThrow()
    expect(removed).toHaveLength(0)
  })
})

describe('CommentService notifications', () => {
  it('notifies mentioned users and the idea followers, and never the actor', async () => {
    const { service, notifications } = commentHarness({
      currentUser: member(ORG_A, 'commenter-1'),
      ideas: [ideaSummary({ assigneeUserIds: ['assignee-1', 'commenter-1'] })],
      usersByEmail: { 'mentioned@acme.test': userSummary({ id: 'mentioned-1' }) },
    })

    await service.create(IDEA_A, { body: 'Hi', mentionEmails: ['mentioned@acme.test'] })

    expect(notifications.map((n) => [n.eventType, n.recipientUserId])).toEqual([
      [NotificationEventType.CommentMention, 'mentioned-1'],
      [NotificationEventType.CommentAdded, AUTHOR],
      [NotificationEventType.CommentAdded, 'assignee-1'],
    ])
  })

  it('sends both a mention and a follower notification to someone who is both', async () => {
    const { service, notifications } = commentHarness({
      currentUser: member(ORG_A, 'commenter-1'),
      usersByEmail: { 'ann@acme.test': userSummary({ id: AUTHOR }) },
    })

    await service.create(IDEA_A, { body: 'Hi', mentionEmails: ['ann@acme.test'] })

    expect(notifications.filter((n) => n.recipientUserId === AUTHOR)).toHaveLength(2)
  })

  it('does not notify the commenter when they are the idea author', async () => {
    const { service, notifications } = commentHarness({ currentUser: member(ORG_A, AUTHOR) })

    await service.create(IDEA_A, { body: 'Hi', mentionEmails: null })

    expect(notifications).toHaveLength(0)
  })
})

// Upvotes -------------------------------------------------------------------------------------

function upvoteHarness(options: {
  currentUser: CurrentUserContext
  organizationIdByIdea?: Record<string, string>
  existing?: IdeaUpvote | null
}) {
  const byIdea = options.organizationIdByIdea ?? { [IDEA_A]: ORG_A }
  const added: IdeaUpvote[] = []
  const removed: IdeaUpvote[] = []
  let count = 4

  const upvoteRepository: IdeaUpvoteRepository = {
    async getByIdeaAndUser() {
      return options.existing ?? null
    },
    async add(u) {
      added.push(u)
      count++
    },
    async remove(u) {
      removed.push(u)
      count--
    },
    async countByIdea() {
      return count
    },
  }

  const ideas: UpvoteIdeaLookupPort = {
    async getOrganizationId(ideaId) {
      return byIdea[ideaId] ?? null
    },
  }

  const audit = recordingAudit()

  return {
    service: new UpvoteService(
      upvoteRepository,
      ideas,
      countingUnitOfWork(),
      audit,
      options.currentUser,
      fixedClock(),
    ),
    added,
    removed,
    audit,
  }
}

describe('UpvoteService', () => {
  it('lets Read Only upvote', async () => {
    const { service, added } = upvoteHarness({ currentUser: readOnly(ORG_A) })

    const result = await service.toggle(IDEA_A)

    expect(result.hasUpvoted).toBe(true)
    expect(added).toHaveLength(1)
  })

  it('toggles an existing upvote off', async () => {
    const existing = createIdeaUpvote({
      id: 'upvote-1',
      ideaId: IDEA_A,
      userId: 'user-1',
      nowUtc: NOW,
    })
    const { service, removed } = upvoteHarness({ currentUser: member(ORG_A), existing })

    const result = await service.toggle(IDEA_A)

    expect(result.hasUpvoted).toBe(false)
    expect(removed).toHaveLength(1)
  })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s upvoting another organization’s idea', async (_label, currentUser) => {
    const { service, added } = upvoteHarness({
      currentUser,
      organizationIdByIdea: { [IDEA_B]: ORG_B },
    })

    await expect(service.toggle(IDEA_B)).rejects.toBeInstanceOf(NotFoundError)
    expect(added).toHaveLength(0)
  })

  it('refuses a direct Site Admin (rule 25)', async () => {
    const { service, added } = upvoteHarness({ currentUser: siteAdmin() })

    await expect(service.toggle(IDEA_A)).rejects.toThrow(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it('reports a nonexistent idea as not-found', async () => {
    const { service } = upvoteHarness({ currentUser: member(ORG_A) })

    await expect(service.toggle('no-such-idea')).rejects.toThrow(NotFoundError)
  })

  it('attributes the upvote audit to the administrator during View As', async () => {
    const { service, audit } = upvoteHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.ReadOnly,
        targetOrganizationId: ORG_A,
        realUserId: 'sa-9',
      }),
    })

    await service.toggle(IDEA_A)

    expect(audit.events[0]?.eventType).toBe('IdeaUpvoteAdded')
    expect(audit.events[0]?.attribution.actorUserId).toBe('sa-9')
    expect(audit.events[0]?.attribution.onBehalfOfUserId).toBe('target-1')
  })
})
