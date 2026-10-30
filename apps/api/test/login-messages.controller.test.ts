// Sign-in messages at the HTTP boundary (SPEC/contracts/login-messages.md). The controller only
// parses: an unparseable date must reach the domain as an invalid Date and answer 400 keyed by its
// field, `endsAtUtc: null` is an open end, and `showAgain` raises the revision only when it is the
// literal `true`. Status codes come from the route decorators and `ProblemDetailsFilter`.

import type { Clock, CurrentUserContext } from '@collega/application/common'
import type { LoginMessageRepository } from '@collega/application/login-messages'
import { LoginMessageService } from '@collega/application/login-messages'
import { Role } from '@collega/domain/enums'
import type { LoginMessage } from '@collega/domain/login-messages'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { LoginMessagesController } from '../src/login-messages/login-messages.controller.js'
import { renderProblem } from './problem-render.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const NOW = new Date('2026-11-02T12:00:00.000Z')
const ROUTE_ARGS_METADATA = '__routeArguments__'

const SITE_ADMIN: CurrentUserContext = {
  isAuthenticated: true,
  userId: ADMIN,
  organizationId: null,
  role: Role.SiteAdmin,
  isImpersonating: false,
  realUserId: ADMIN,
}

const VALID = {
  title: 'Planned maintenance',
  body: 'Read-only on Saturday.',
  display: 'Modal',
  dismissalMode: 'EveryLogin',
  startsAtUtc: '2026-11-01T00:00:00Z',
  endsAtUtc: '2026-11-08T00:00:00Z',
}

function setup() {
  const store = new Map<string, LoginMessage>()
  const repository: LoginMessageRepository = {
    getById: async (id) => store.get(id) ?? null,
    list: async (organizationId, page) => {
      const items = [...store.values()].filter((m) => m.organizationId === organizationId)
      return { items: items.slice(0, page.pageSize), totalCount: items.length }
    },
    listLive: async () => [],
    add: async (m) => {
      store.set(m.id, m)
    },
    save: async (m) => {
      store.set(m.id, m)
    },
    remove: async (id) => {
      store.delete(id)
    },
    listReceipts: async () => [],
    saveReceipt: async () => {},
    countAudience: async () => 0,
    countAcknowledged: async () => new Map(),
    listAcknowledgements: async () => ({ items: [], totalCount: 0 }),
  }
  const clock: Clock = { now: () => NOW }
  const service = new LoginMessageService(
    repository,
    { saveChanges: async () => {} },
    { write: async () => {} },
    SITE_ADMIN,
    clock,
  )
  return { controller: new LoginMessagesController(service), store }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('Login message routes', () => {
  // biome-ignore lint/complexity/noBannedTypes: Reflect.getMetadata's own signature takes a Function.
  const meta = (key: string, handler: Function) => Reflect.getMetadata(key, handler)
  const p = LoginMessagesController.prototype
  const route = (handler: Parameters<typeof meta>[1]) => [
    meta(METHOD_METADATA, handler),
    meta(PATH_METADATA, handler),
  ]

  it('wires every route at its contract path and method', () => {
    expect(route(p.listSystem)).toEqual([RequestMethod.GET, 'login-messages/system'])
    expect(route(p.createSystem)).toEqual([RequestMethod.POST, 'login-messages/system'])
    expect(route(p.visible)).toEqual([RequestMethod.GET, 'login-messages/visible'])
    expect(route(p.listForOrganization)).toEqual([
      RequestMethod.GET,
      'organizations/:organizationId/login-messages',
    ])
    expect(route(p.createForOrganization)).toEqual([
      RequestMethod.POST,
      'organizations/:organizationId/login-messages',
    ])
    expect(route(p.get)).toEqual([RequestMethod.GET, 'login-messages/:messageId'])
    expect(route(p.update)).toEqual([RequestMethod.PUT, 'login-messages/:messageId'])
    expect(route(p.delete)).toEqual([RequestMethod.DELETE, 'login-messages/:messageId'])
    expect(route(p.acknowledgements)).toEqual([
      RequestMethod.GET,
      'login-messages/:messageId/acknowledgements',
    ])
    expect(route(p.close)).toEqual([RequestMethod.POST, 'login-messages/:messageId/close'])
    expect(route(p.acknowledge)).toEqual([
      RequestMethod.POST,
      'login-messages/:messageId/acknowledge',
    ])
  })

  it('answers 201 on both creates and 204 on delete, close and acknowledge', () => {
    expect(meta(HTTP_CODE_METADATA, p.createSystem)).toBe(201)
    expect(meta(HTTP_CODE_METADATA, p.createForOrganization)).toBe(201)
    expect(meta(HTTP_CODE_METADATA, p.delete)).toBe(204)
    expect(meta(HTTP_CODE_METADATA, p.close)).toBe(204)
    expect(meta(HTTP_CODE_METADATA, p.acknowledge)).toBe(204)
  })

  it('leaves reads and PUT on the default 200', () => {
    for (const handler of [p.listSystem, p.visible, p.get, p.update, p.acknowledgements]) {
      expect(meta(HTTP_CODE_METADATA, handler)).toBeUndefined()
    }
  })

  it('guards the whole controller with AuthGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LoginMessagesController)).toEqual([AuthGuard])
  })

  it.each([
    'listForOrganization',
    'createForOrganization',
    'get',
    'update',
    'delete',
    'acknowledgements',
    'close',
    'acknowledge',
  ] as const)('%s reads its id through UuidParamPipe, so a malformed id is a 404', (name) => {
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, LoginMessagesController, name) as Record<
      string,
      { pipes: unknown[] }
    >
    expect(Object.values(args).flatMap((arg) => arg.pipes)).toContain(UuidParamPipe)
  })

  it('declares the fixed paths before the :messageId route so they are not swallowed', () => {
    // Nest registers routes in the order the methods are declared on the class.
    const paths = Object.getOwnPropertyNames(p)
      .filter((name) => name !== 'constructor')
      .map(
        (name) =>
          [
            name,
            meta(METHOD_METADATA, p[name as keyof typeof p] as never),
            meta(PATH_METADATA, p[name as keyof typeof p] as never),
          ] as const,
      )
      .filter(([, method]) => method === RequestMethod.GET)
      .map(([, , path]) => path as string)
    const param = paths.indexOf('login-messages/:messageId')
    expect(paths.indexOf('login-messages/system')).toBeLessThan(param)
    expect(paths.indexOf('login-messages/visible')).toBeLessThan(param)
  })

  it('matches /login-messages/system and /visible to the fixed handlers, not :messageId', () => {
    const pattern = (path: string) => new RegExp(`^/${path.replace(/:[A-Za-z]+/g, '[^/]+')}$`)
    const get = Object.getOwnPropertyNames(p)
      .filter((name) => name !== 'constructor')
      .map((name) => p[name as keyof typeof p] as never)
      .filter((handler) => meta(METHOD_METADATA, handler) === RequestMethod.GET)
      .map((handler) => meta(PATH_METADATA, handler) as string)
    for (const url of ['/login-messages/system', '/login-messages/visible']) {
      const first = get.find((path) => pattern(path).test(url))
      expect(first).toBe(url.slice(1))
    }
  })
})

describe('Login message body parsing', () => {
  it('creates a system message from a valid body', async () => {
    const { controller, store } = setup()
    const item = await controller.createSystem(VALID)
    expect(item).toMatchObject({
      organizationId: null,
      title: 'Planned maintenance',
      display: 'Modal',
      dismissalMode: 'EveryLogin',
      revision: 1,
      state: 'Live',
    })
    expect(item.startsAtUtc).toEqual(new Date('2026-11-01T00:00:00Z'))
    expect(item.endsAtUtc).toEqual(new Date('2026-11-08T00:00:00Z'))
    expect(store.size).toBe(1)
  })

  it.each([
    ['null', { endsAtUtc: null }],
    ['absent', { endsAtUtc: undefined }],
  ])('accepts an open end when endsAtUtc is %s', async (_label, extra) => {
    const { controller } = setup()
    const item = await controller.createSystem({ ...VALID, ...extra })
    expect(item.endsAtUtc).toBeNull()
  })

  it.each([
    ['not a date', 'tomorrow'],
    ['empty', ''],
    ['a number', 1_700_000_000_000],
    ['an object', { at: '2026-11-01T00:00:00Z' }],
  ])(
    'answers 400 keyed startsAtUtc when the start is %s, writing nothing',
    async (_label, startsAtUtc) => {
      const { controller, store } = setup()
      const rendered = renderProblem(
        await thrownBy(controller.createSystem({ ...VALID, startsAtUtc })),
      )
      expect(rendered.status).toBe(400)
      expect(Object.keys(rendered.body.errors as object)).toEqual(['startsAtUtc'])
      expect(store.size).toBe(0)
    },
  )

  it('answers 400 keyed startsAtUtc when the start is absent', async () => {
    const { controller } = setup()
    const { startsAtUtc: _omitted, ...rest } = VALID
    const rendered = renderProblem(await thrownBy(controller.createSystem(rest)))
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['startsAtUtc'])
  })

  it('answers 400 keyed endsAtUtc for an invalid end date', async () => {
    const { controller } = setup()
    const rendered = renderProblem(
      await thrownBy(controller.createSystem({ ...VALID, endsAtUtc: 'soon' })),
    )
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['endsAtUtc'])
  })

  it('answers 400 keyed endsAtUtc when the end is not after the start', async () => {
    const { controller } = setup()
    const rendered = renderProblem(
      await thrownBy(controller.createSystem({ ...VALID, endsAtUtc: VALID.startsAtUtc })),
    )
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['endsAtUtc'])
  })

  it.each([
    ['title absent', { title: undefined }, 'title'],
    ['title a number', { title: 7 }, 'title'],
    ['body blank', { body: '   ' }, 'body'],
    ['display unknown', { display: 'Popup' }, 'display'],
    ['display a number', { display: 1 }, 'display'],
    ['dismissalMode absent', { dismissalMode: undefined }, 'dismissalMode'],
  ])('answers 400 keyed by field when %s', async (_label, overrides, field) => {
    const { controller } = setup()
    const rendered = renderProblem(
      await thrownBy(controller.createSystem({ ...VALID, ...overrides })),
    )
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual([field])
  })

  it('answers 400 on PUT for an invalid date and leaves the stored message alone', async () => {
    const { controller, store } = setup()
    const created = await controller.createSystem(VALID)
    const rendered = renderProblem(
      await thrownBy(
        controller.update(created.id, { ...VALID, startsAtUtc: 'nope', showAgain: true }),
      ),
    )
    expect(rendered.status).toBe(400)
    expect(store.get(created.id)?.revision).toBe(1)
  })

  it('raises the revision on PUT only when showAgain is literally true', async () => {
    const { controller } = setup()
    const created = await controller.createSystem(VALID)
    for (const showAgain of [undefined, false, 'true', 1, 'yes', null]) {
      const item = await controller.update(created.id, { ...VALID, showAgain })
      expect(item.revision).toBe(1)
    }
    expect((await controller.update(created.id, { ...VALID, showAgain: true })).revision).toBe(2)
  })

  it('deletes through the route handler and then answers 404 for the message', async () => {
    const { controller } = setup()
    const created = await controller.createSystem(VALID)
    await expect(controller.delete(created.id)).resolves.toBeUndefined()
    const rendered = renderProblem(await thrownBy(controller.get(created.id)))
    expect(rendered.status).toBe(404)
  })

  it('wraps the visible set in an items envelope', async () => {
    const { controller } = setup()
    // The site admin of setup() reads an empty live set.
    await expect(controller.visible()).resolves.toEqual({ items: [] })
  })

  it('passes page and pageSize query values through and ignores junk', async () => {
    const { controller } = setup()
    await controller.createSystem(VALID)
    expect(await controller.listSystem({ page: '1', pageSize: '5' })).toMatchObject({
      page: 1,
      pageSize: 5,
      totalCount: 1,
    })
    expect(await controller.listSystem({ page: 'x', pageSize: [] })).toMatchObject({
      totalCount: 1,
    })
  })
})
