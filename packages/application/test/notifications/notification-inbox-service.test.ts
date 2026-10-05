// The inbox (SPEC/20-feature-idea-following.md rules 20-32, SPEC/contracts/notifications.md): the
// caller's own notifications, a 90-day window measured on the injected clock, paging clamped to the
// shared convention, and marking read for the caller (the target, under View As). The repository is
// faked, so what is asserted is what the service asks of it and how it shapes the answer; the
// filtering itself is the repository's and is tested against Postgres.

import { NotificationEventType, Role, UserStatus } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import {
  type CurrentUserContext,
  NotFoundError,
  UnauthorizedError,
} from '../../src/common/index.js'
import { INBOX_WINDOW_DAYS, NotificationInboxService } from '../../src/notifications/index.js'
import type { InboxRow, NotificationInboxRepository } from '../../src/notifications/ports.js'
import {
  anonymous,
  fixedClock,
  impersonating,
  member,
  NOW,
  ORG_A,
  siteAdmin,
} from '../support/fixtures.js'

const DAY_MS = 24 * 60 * 60 * 1000

function row(overrides: Partial<InboxRow> = {}): InboxRow {
  return {
    id: 'n-1',
    eventType: NotificationEventType.CommentAdded,
    ideaId: 'idea-1',
    ideaTitle: 'An idea',
    link: '/ideas/idea-1',
    actor: {
      userId: 'actor-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      status: UserStatus.Active,
    },
    statusName: null,
    boardName: 'Opportunities',
    occurredAtUtc: NOW,
    readAtUtc: null,
    ...overrides,
  }
}

function inboxHarness(options: {
  currentUser: CurrentUserContext
  rows?: readonly InboxRow[]
  markReadFound?: boolean
}) {
  const calls = {
    list: [] as Parameters<NotificationInboxRepository['listForRecipient']>[0][],
    unread: [] as [string, Date][],
    markRead: [] as [string, string, Date][],
    markAll: [] as [string, Date][],
  }
  const repository: NotificationInboxRepository = {
    async listForRecipient(query) {
      calls.list.push(query)
      return {
        items: options.rows ?? [],
        page: query.page.page,
        pageSize: query.page.pageSize,
        totalCount: (options.rows ?? []).length,
      }
    },
    async countUnread(recipientUserId, sinceUtc) {
      calls.unread.push([recipientUserId, sinceUtc])
      return 4
    },
    async markRead(notificationId, recipientUserId, readAtUtc) {
      calls.markRead.push([notificationId, recipientUserId, readAtUtc])
      return options.markReadFound ?? true
    },
    async markAllRead(recipientUserId, readAtUtc) {
      calls.markAll.push([recipientUserId, readAtUtc])
    },
  }
  return {
    service: new NotificationInboxService(repository, options.currentUser, fixedClock()),
    calls,
  }
}

const NO_PAGING = { page: null, pageSize: null }

describe('NotificationInboxService.list', () => {
  it('asks only for the caller notifications', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    await h.service.list(NO_PAGING)

    expect(h.calls.list.map((q) => q.recipientUserId)).toEqual(['me'])
  })

  it('windows the list to 90 days before the injected now', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    await h.service.list(NO_PAGING)

    expect(INBOX_WINDOW_DAYS).toBe(90)
    expect(h.calls.list[0]?.sinceUtc).toEqual(new Date(NOW.getTime() - 90 * DAY_MS))
  })

  it('defaults to page 1 of 20', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    const page = await h.service.list(NO_PAGING)

    expect(h.calls.list[0]?.page).toEqual({ page: 1, pageSize: 20 })
    expect(page).toMatchObject({ page: 1, pageSize: 20 })
  })

  it.each([
    [
      { page: 0, pageSize: 0 },
      { page: 1, pageSize: 1 },
    ],
    [
      { page: -3, pageSize: -5 },
      { page: 1, pageSize: 1 },
    ],
    [
      { page: 2, pageSize: 1000 },
      { page: 2, pageSize: 100 },
    ],
    [
      { page: 3, pageSize: 25 },
      { page: 3, pageSize: 25 },
    ],
    [
      { page: 1, pageSize: 100 },
      { page: 1, pageSize: 100 },
    ],
  ])('clamps paging %j to %j', async (requested, expected) => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    await h.service.list(requested)

    expect(h.calls.list[0]?.page).toEqual(expected)
  })

  it('reports the order it is in: occurredAt, newest first', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    const page = await h.service.list(NO_PAGING)

    expect(page.sortBy).toBe('occurredAt')
    expect(page.sortDirection).toBe('desc')
  })

  it('shapes an item with the actor display name, activity and the stored status name', async () => {
    const at = new Date('2026-09-01T10:00:00.000Z')
    const h = inboxHarness({
      currentUser: member(ORG_A, 'me'),
      rows: [
        row({
          id: 'n-9',
          eventType: NotificationEventType.IdeaStatusChanged,
          statusName: 'In Review',
          occurredAtUtc: at,
          readAtUtc: NOW,
        }),
      ],
    })

    const page = await h.service.list(NO_PAGING)

    expect(page.items).toEqual([
      {
        notificationId: 'n-9',
        eventType: 'IdeaStatusChanged',
        ideaId: 'idea-1',
        ideaTitle: 'An idea',
        link: '/ideas/idea-1',
        actor: {
          userId: 'actor-1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          displayName: 'Ada Lovelace',
          isActive: true,
        },
        statusName: 'In Review',
        boardName: 'Opportunities',
        occurredAtUtc: at,
        readAtUtc: NOW,
      },
    ])
  })

  it('marks an inactive actor, and tolerates an actor with no user row', async () => {
    const h = inboxHarness({
      currentUser: member(ORG_A, 'me'),
      rows: [
        row({
          id: 'n-1',
          actor: { userId: 'gone', firstName: 'Gus', lastName: '', status: UserStatus.Inactive },
        }),
        row({ id: 'n-2', actor: null }),
      ],
    })

    const page = await h.service.list(NO_PAGING)

    expect(page.items[0]?.actor).toMatchObject({ displayName: 'Gus', isActive: false })
    expect(page.items[1]?.actor).toBeNull()
  })

  it('reads the target inbox under View As', async () => {
    const h = inboxHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await h.service.list(NO_PAGING)

    expect(h.calls.list.map((q) => q.recipientUserId)).toEqual(['target-1'])
  })

  it('asks for the Site Admin own id when acting as themselves, who is never a recipient', async () => {
    const h = inboxHarness({ currentUser: siteAdmin('sa-1') })

    const page = await h.service.list(NO_PAGING)

    expect(h.calls.list.map((q) => q.recipientUserId)).toEqual(['sa-1'])
    expect(page.items).toEqual([])
  })

  it('refuses an unauthenticated caller', async () => {
    const h = inboxHarness({ currentUser: anonymous })

    await expect(h.service.list(NO_PAGING)).rejects.toBeInstanceOf(UnauthorizedError)
    expect(h.calls.list).toEqual([])
  })
})

describe('NotificationInboxService.unreadCount', () => {
  it('counts the caller unread notifications in the same 90-day window as the list', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    const result = await h.service.unreadCount()
    await h.service.list(NO_PAGING)

    expect(result).toEqual({ unreadCount: 4 })
    expect(h.calls.unread).toEqual([['me', new Date(NOW.getTime() - 90 * DAY_MS)]])
    expect(h.calls.unread[0]?.[1]).toEqual(h.calls.list[0]?.sinceUtc)
  })

  it('counts the target under View As', async () => {
    const h = inboxHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await h.service.unreadCount()

    expect(h.calls.unread[0]?.[0]).toBe('target-1')
  })

  it('refuses an unauthenticated caller', async () => {
    const h = inboxHarness({ currentUser: anonymous })

    await expect(h.service.unreadCount()).rejects.toBeInstanceOf(UnauthorizedError)
  })
})

describe('NotificationInboxService.markRead', () => {
  it('marks the notification for the caller at the injected now', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    await h.service.markRead('n-1')

    expect(h.calls.markRead).toEqual([['n-1', 'me', NOW]])
  })

  it('answers 404 when the repository finds no such notification for the caller', async () => {
    // Someone else's notification and a missing one look the same: the caller cannot tell.
    const h = inboxHarness({ currentUser: member(ORG_A, 'me'), markReadFound: false })

    await expect(h.service.markRead('someone-elses')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('marks the target notification under View As', async () => {
    const h = inboxHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.ReadOnly,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    })

    await h.service.markRead('n-1')

    expect(h.calls.markRead[0]?.[1]).toBe('target-1')
  })

  it('refuses an unauthenticated caller before touching the repository', async () => {
    const h = inboxHarness({ currentUser: anonymous })

    await expect(h.service.markRead('n-1')).rejects.toBeInstanceOf(UnauthorizedError)
    expect(h.calls.markRead).toEqual([])
  })
})

describe('NotificationInboxService.markAllRead', () => {
  it('marks every unread notification of the caller at the injected now', async () => {
    const h = inboxHarness({ currentUser: member(ORG_A, 'me') })

    await h.service.markAllRead()

    expect(h.calls.markAll).toEqual([['me', NOW]])
  })

  it('marks the target inbox under View As', async () => {
    const h = inboxHarness({
      currentUser: impersonating({
        targetUserId: 'target-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
      }),
    })

    await h.service.markAllRead()

    expect(h.calls.markAll.map((c) => c[0])).toEqual(['target-1'])
  })

  it('refuses an unauthenticated caller', async () => {
    const h = inboxHarness({ currentUser: anonymous })

    await expect(h.service.markAllRead()).rejects.toBeInstanceOf(UnauthorizedError)
  })
})
