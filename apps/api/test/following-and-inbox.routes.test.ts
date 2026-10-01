// The follow toggle and the inbox at the HTTP boundary (SPEC/contracts/following.md,
// SPEC/contracts/notifications.md "Notification Inbox Contracts"). Controllers only parse and
// delegate, so what is asserted is what only this layer decides: the paths, verbs and status codes,
// that every id reaches the service through `UuidParamPipe`, how paging values are read from the
// query string, the response shapes, and that the errors the services raise render as the contract's
// 403 and 404. The services are the real ones over in-memory ports, so no rule is restated here.
// The DI wiring is checked statically: a token a module injects but nothing provides only fails at
// boot, which no other test would see.

import { type Clock, type CurrentUserContext, NotFoundError } from '@collega/application/common'
import { FollowService, type IdeaFollowerRepository } from '@collega/application/following'
import {
  type InboxRow,
  type NotificationInboxRepository,
  NotificationInboxService,
} from '@collega/application/notifications'
import { NotificationEventType, Role, UserStatus } from '@collega/domain/enums'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { FEATURE_MODULES } from '../src/app.modules.generated.js'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { ROLES_KEY } from '../src/auth/roles.decorator.js'
import { RolesGuard } from '../src/auth/roles.guard.js'
import { CommentsModule } from '../src/comments/comments.module.js'
import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'
import { PersistenceModule } from '../src/common/persistence/persistence.module.js'
import { PORT_TOKENS } from '../src/common/tokens.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { FollowingController } from '../src/following/following.controller.js'
import { FollowingModule } from '../src/following/following.module.js'
import { IdeasModule } from '../src/ideas/ideas.module.js'
import { NotificationsController } from '../src/notifications/notifications.controller.js'
import { NotificationsModule } from '../src/notifications/notifications.module.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const OTHER_ORG = '22222222-2222-2222-2222-222222222222'
const IDEA = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const NOTIFICATION = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
const NOW = new Date('2026-09-29T12:00:00.000Z')
const CLOCK: Clock = { now: () => NOW }

/** Nest's key for a handler's parameter decorators, restated as `route-metadata.ts` explains. */
const ROUTE_ARGS_METADATA = '__routeArguments__'

function caller(overrides: Partial<CurrentUserContext> = {}): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: USER,
    organizationId: ORG,
    role: Role.User,
    isImpersonating: false,
    realUserId: USER,
    ...overrides,
  }
}

// biome-ignore lint/complexity/noBannedTypes: Reflect.getMetadata's own signature takes a Function.
const meta = (key: string, handler: Function) => Reflect.getMetadata(key, handler)

function pipesOf(type: new (...args: never[]) => unknown, handler: string): unknown[] {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, type, handler) as Record<
    string,
    { pipes: unknown[] }
  >
  return Object.values(args).flatMap((arg) => arg.pipes)
}

/** What `ProblemDetailsFilter` writes for `exception`, captured without an HTTP server. */
function render(
  exception: unknown,
  url: string,
): { status: number; body: Record<string, unknown> } {
  const captured = { status: 0, body: {} as Record<string, unknown> }
  const response = {
    status(code: number) {
      captured.status = code
      return this
    },
    setHeader() {
      return this
    },
    send(payload: string | Buffer) {
      captured.body = JSON.parse(payload.toString())
      return this
    },
  }
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url, originalUrl: url }),
    }),
  } as never
  new ProblemDetailsFilter().catch(exception, host)
  return captured
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

function followingController(currentUser: CurrentUserContext) {
  const rows = new Set<string>(['someone-else'])
  const followers: IdeaFollowerRepository = {
    add: async (list) => {
      for (const row of list) rows.add(row.userId)
    },
    remove: async (_idea, userId) => {
      rows.delete(userId)
    },
    isFollowing: async (_idea, userId) => rows.has(userId),
    countByIdea: async () => rows.size,
  }
  const service = new FollowService(
    followers,
    { getById: async (id) => (id === IDEA ? { organizationId: ORG } : null) },
    { saveChanges: async () => {} },
    currentUser,
    CLOCK,
  )
  return new FollowingController(service)
}

function inboxController(
  options: { currentUser?: CurrentUserContext; rows?: readonly InboxRow[]; found?: boolean } = {},
) {
  const calls = { list: [] as { page: number; pageSize: number }[], marked: [] as string[] }
  const repository: NotificationInboxRepository = {
    listForRecipient: async (query) => {
      calls.list.push(query.page)
      return {
        items: options.rows ?? [],
        page: query.page.page,
        pageSize: query.page.pageSize,
        totalCount: (options.rows ?? []).length,
      }
    },
    countUnread: async () => 3,
    markRead: async (id) => {
      calls.marked.push(id)
      return options.found ?? true
    },
    markAllRead: async () => {},
  }
  const service = new NotificationInboxService(repository, options.currentUser ?? caller(), CLOCK)
  return { controller: new NotificationsController(service), calls }
}

describe('Follow routes', () => {
  const p = FollowingController.prototype

  it('wire PUT and DELETE ideas/{ideaId}/follow, behind AuthGuard only', () => {
    expect(Reflect.getMetadata(PATH_METADATA, FollowingController)).toBe('ideas/:ideaId/follow')
    expect(meta(METHOD_METADATA, p.follow)).toBe(RequestMethod.PUT)
    expect(meta(METHOD_METADATA, p.unfollow)).toBe(RequestMethod.DELETE)
    expect(Reflect.getMetadata(GUARDS_METADATA, FollowingController)).toEqual([AuthGuard])
  })

  it('open to every role: no role gate on the controller or either handler', () => {
    for (const target of [FollowingController, p.follow, p.unfollow]) {
      expect(Reflect.getMetadata(ROLES_KEY, target)).toBeUndefined()
    }
    expect(Reflect.getMetadata(GUARDS_METADATA, FollowingController)).not.toContain(RolesGuard)
  })

  it('answer 200 with a body, not 204: no status override on either handler', () => {
    expect(meta(HTTP_CODE_METADATA, p.follow)).toBeUndefined()
    expect(meta(HTTP_CODE_METADATA, p.unfollow)).toBeUndefined()
  })

  it.each(['follow', 'unfollow'] as const)('%s reads ideaId through UuidParamPipe', (name) => {
    expect(pipesOf(FollowingController, name)).toContain(UuidParamPipe)
  })

  it('PUT answers exactly ideaId, isFollowing and followerCount', async () => {
    const controller = followingController(caller())

    expect(await controller.follow(IDEA)).toEqual({
      ideaId: IDEA,
      isFollowing: true,
      followerCount: 2,
    })
  })

  it('DELETE answers the same shape with isFollowing false and the count after the change', async () => {
    const controller = followingController(caller())
    await controller.follow(IDEA)

    expect(await controller.unfollow(IDEA)).toEqual({
      ideaId: IDEA,
      isFollowing: false,
      followerCount: 1,
    })
  })

  it('renders a Site Admin acting as themselves as 403', async () => {
    const controller = followingController(caller({ role: Role.SiteAdmin, organizationId: null }))

    const error = await thrownBy(controller.follow(IDEA))

    expect(render(error, `/api/v1/ideas/${IDEA}/follow`).status).toBe(403)
  })

  it.each([
    ['an idea that does not exist', '33333333-3333-3333-3333-333333333333', ORG],
    ['an idea in another organization', IDEA, OTHER_ORG],
  ])('renders %s as 404', async (_label, ideaId, organizationId) => {
    const controller = followingController(caller({ organizationId }))

    for (const call of [controller.follow(ideaId), controller.unfollow(ideaId)]) {
      expect(render(await thrownBy(call), `/api/v1/ideas/${ideaId}/follow`).status).toBe(404)
    }
  })
})

describe('Inbox routes', () => {
  const p = NotificationsController.prototype

  it('wire the four routes at their contract paths, verbs and codes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, NotificationsController)).toBe('notifications')
    expect([meta(PATH_METADATA, p.list), meta(METHOD_METADATA, p.list)]).toEqual([
      '/',
      RequestMethod.GET,
    ])
    expect([meta(PATH_METADATA, p.unreadCount), meta(METHOD_METADATA, p.unreadCount)]).toEqual([
      'unread-count',
      RequestMethod.GET,
    ])
    expect([meta(PATH_METADATA, p.markAllRead), meta(METHOD_METADATA, p.markAllRead)]).toEqual([
      'read-all',
      RequestMethod.POST,
    ])
    expect(meta(HTTP_CODE_METADATA, p.markAllRead)).toBe(204)
    expect([meta(PATH_METADATA, p.markRead), meta(METHOD_METADATA, p.markRead)]).toEqual([
      ':notificationId/read',
      RequestMethod.POST,
    ])
    expect(meta(HTTP_CODE_METADATA, p.markRead)).toBe(204)
  })

  it('answer the reads with the default 200', () => {
    expect(meta(HTTP_CODE_METADATA, p.list)).toBeUndefined()
    expect(meta(HTTP_CODE_METADATA, p.unreadCount)).toBeUndefined()
  })

  it('sit behind AuthGuard with no role gate, so any authenticated role may call them', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, NotificationsController)).toEqual([AuthGuard])
    for (const target of [
      NotificationsController,
      p.list,
      p.unreadCount,
      p.markRead,
      p.markAllRead,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, target)).toBeUndefined()
    }
  })

  it('reads the notification id through UuidParamPipe, so a malformed id is a 404', () => {
    expect(pipesOf(NotificationsController, 'markRead')).toContain(UuidParamPipe)
  })

  it('has no route that takes a user id', () => {
    const paths = ['list', 'unreadCount', 'markAllRead', 'markRead'].map((name) =>
      String(meta(PATH_METADATA, p[name as keyof typeof p] as () => unknown)),
    )
    expect(paths.some((path) => /user/i.test(path))).toBe(false)
  })

  describe('GET /notifications paging', () => {
    it.each([
      [{}, { page: 1, pageSize: 20 }],
      [
        { page: '3', pageSize: '25' },
        { page: 3, pageSize: 25 },
      ],
      [
        { page: '2', pageSize: '500' },
        { page: 2, pageSize: 100 },
      ],
      [
        { page: '0', pageSize: '0' },
        { page: 1, pageSize: 1 },
      ],
      [
        { page: '-4', pageSize: '-1' },
        { page: 1, pageSize: 1 },
      ],
      [
        { page: 'abc', pageSize: 'xyz' },
        { page: 1, pageSize: 20 },
      ],
      [
        { page: '', pageSize: '' },
        { page: 1, pageSize: 20 },
      ],
      [
        { page: ['2', '3'], pageSize: ['5', '6'] },
        { page: 1, pageSize: 20 },
      ],
    ])('reads query %j as %j', async (query, expected) => {
      const { controller, calls } = inboxController()

      await controller.list(query)

      expect(calls.list).toEqual([expected])
    })
  })

  it('answers the contract’s paged shape with each item’s fields', async () => {
    const at = new Date('2026-09-28T08:00:00.000Z')
    const { controller } = inboxController({
      rows: [
        {
          id: NOTIFICATION,
          eventType: NotificationEventType.IdeaStatusChanged,
          ideaId: IDEA,
          ideaTitle: 'An idea',
          link: `/ideas/${IDEA}`,
          actor: {
            userId: USER,
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: UserStatus.Active,
          },
          statusName: 'In Review',
          boardName: 'Opportunities',
          occurredAtUtc: at,
          readAtUtc: null,
        },
      ],
    })

    const page = await controller.list({})

    expect(page).toEqual({
      items: [
        {
          notificationId: NOTIFICATION,
          eventType: 'IdeaStatusChanged',
          ideaId: IDEA,
          ideaTitle: 'An idea',
          link: `/ideas/${IDEA}`,
          actor: {
            userId: USER,
            firstName: 'Ada',
            lastName: 'Lovelace',
            displayName: 'Ada Lovelace',
            isActive: true,
          },
          statusName: 'In Review',
          boardName: 'Opportunities',
          occurredAtUtc: at,
          readAtUtc: null,
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      sortBy: 'occurredAt',
      sortDirection: 'desc',
    })
  })

  it('answers the unread count as { unreadCount }', async () => {
    expect(await inboxController().controller.unreadCount()).toEqual({ unreadCount: 3 })
  })

  it('answers an empty page for a Site Admin acting as themselves, not an error', async () => {
    const { controller } = inboxController({
      currentUser: caller({ role: Role.SiteAdmin, organizationId: null }),
    })

    expect(await controller.list({})).toMatchObject({ items: [], totalCount: 0 })
  })

  it('marks one read and answers nothing', async () => {
    const { controller, calls } = inboxController()

    expect(await controller.markRead(NOTIFICATION)).toBeUndefined()
    expect(calls.marked).toEqual([NOTIFICATION])
  })

  it('renders a notification that is missing or someone else’s as 404', async () => {
    const { controller } = inboxController({ found: false })

    const error = await thrownBy(controller.markRead(NOTIFICATION))

    expect(render(error, `/api/v1/notifications/${NOTIFICATION}/read`).status).toBe(404)
    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('marks all read and answers nothing', async () => {
    expect(await inboxController().controller.markAllRead()).toBeUndefined()
  })
})

describe('DI wiring of the following and inbox modules', () => {
  const providedTokens = (module: unknown): Set<unknown> => {
    const providers = (Reflect.getMetadata('providers', module as object) ?? []) as {
      provide?: unknown
    }[]
    return new Set(providers.map((p) => p.provide).filter((token) => token !== undefined))
  }

  /** String tokens, plus any that came out undefined (a mistyped `PORT_TOKENS.x`). */
  const injectedTokens = (module: unknown): unknown[] => {
    const providers = (Reflect.getMetadata('providers', module as object) ?? []) as {
      inject?: unknown[]
    }[]
    return providers.flatMap((p) => (p.inject ?? []).filter((t) => typeof t !== 'function'))
  }

  it.each([
    ['FollowingModule', FollowingModule],
    ['NotificationsModule', NotificationsModule],
    ['IdeasModule', IdeasModule],
    ['CommentsModule', CommentsModule],
  ])('%s injects only tokens the persistence module provides', (_name, module) => {
    const provided = providedTokens(PersistenceModule)
    const missing = injectedTokens(module).filter((token) => !provided.has(token))

    expect(missing).toEqual([])
  })

  it('binds the follower and inbox port tokens the new services need', () => {
    const provided = providedTokens(PersistenceModule)

    for (const token of [
      PORT_TOKENS.IdeaFollowerRepository,
      PORT_TOKENS.IdeaFollowersPort,
      PORT_TOKENS.NotificationInboxRepository,
      PORT_TOKENS.NotificationRecipientsPort,
    ]) {
      expect(provided.has(token)).toBe(true)
    }
  })

  it('registers the following and notifications modules with the host', () => {
    expect(FEATURE_MODULES).toContain(FollowingModule)
    expect(FEATURE_MODULES).toContain(NotificationsModule)
  })
})
