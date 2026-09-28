// Settings → Tags at the HTTP boundary (SPEC/30-Contracts.md "Tag colour and management") and the
// single-Issue delivery read. The controller only parses: `color` absent or `null` is "no colour"
// (create draws one, update keeps the stored one), and any other non-string must reach the service
// as something it refuses keyed `color` - never be coerced into a valid colour, never crash. Status
// codes come from `ProblemDetailsFilter`, so the 400/404 cases render through it.

import type { AuditEventWriter, Clock, CurrentUserContext } from '@collega/application/common'
import { NotFoundError } from '@collega/application/common'
import {
  type OrganizationExistenceLookup,
  type TagRepository,
  TagService,
} from '@collega/application/tags'
import { Role } from '@collega/domain/enums'
import { createTag, type Tag } from '@collega/domain/tags'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { ProblemDetailsFilter } from '../src/common/errors/problem-details.filter.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { DeliveryController } from '../src/ideas/delivery.controller.js'
import { TagsController } from '../src/tags/tags.controller.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const ADMIN = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TAG = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const NOW = new Date('2026-09-28T12:00:00.000Z')

/** Nest's key for a handler's parameter decorators, restated as `route-metadata.ts` explains. */
const ROUTE_ARGS_METADATA = '__routeArguments__'

const ORG_ADMIN: CurrentUserContext = {
  isAuthenticated: true,
  userId: ADMIN,
  organizationId: ORG,
  role: Role.OrgAdmin,
  isImpersonating: false,
  realUserId: ADMIN,
}

function setup(options: { vanishOnWrite?: boolean } = {}) {
  const stored: Tag = createTag({
    id: TAG,
    organizationId: ORG,
    name: 'Backend',
    color: '#2F9E8F',
    nowUtc: NOW,
    actorUserId: ADMIN,
  })
  const written: Tag[] = []
  const vanish = async (): Promise<void> => {
    throw new NotFoundError('Tag not found.')
  }
  const tags: TagRepository = {
    listByIds: async () => [stored],
    getOrCreate: async () => [],
    searchByPrefix: async () => [],
    listByOrganization: async () => [stored],
    getById: async (id) => (id === TAG ? stored : null),
    findByNormalizedName: async (_org, name) => (name === stored.normalizedName ? stored : null),
    usageByTagIds: async () => new Map(),
    getCreatorNames: async () => new Map(),
    add: async (tag) => {
      written.push(tag)
    },
    save: options.vanishOnWrite
      ? vanish
      : async (tag) => {
          written.push(tag)
        },
    delete: options.vanishOnWrite ? vanish : async () => {},
  }
  const organizations: OrganizationExistenceLookup = { existsById: async (id) => id === ORG }
  const audit: AuditEventWriter = { write: async () => {} }
  const clock: Clock = { now: () => NOW }
  const controller = new TagsController(
    new TagService(tags, organizations, audit, ORG_ADMIN, clock, { nextInt: () => 4 }),
  )
  return { controller, written }
}

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

describe('Tag routes', () => {
  // biome-ignore lint/complexity/noBannedTypes: Reflect.getMetadata's own signature takes a Function.
  const meta = (key: string, handler: Function) => Reflect.getMetadata(key, handler)
  const p = TagsController.prototype

  it('wire the catalog and the Org Admin routes at their contract paths and codes', () => {
    expect([meta(PATH_METADATA, p.catalog), meta(METHOD_METADATA, p.catalog)]).toEqual([
      'organizations/:organizationId/tags/catalog',
      RequestMethod.GET,
    ])
    expect([meta(PATH_METADATA, p.create), meta(METHOD_METADATA, p.create)]).toEqual([
      'organizations/:organizationId/tags',
      RequestMethod.POST,
    ])
    expect(meta(HTTP_CODE_METADATA, p.create)).toBe(201)
    expect([meta(PATH_METADATA, p.update), meta(METHOD_METADATA, p.update)]).toEqual([
      'tags/:tagId',
      RequestMethod.PUT,
    ])
    expect([meta(PATH_METADATA, p.delete), meta(METHOD_METADATA, p.delete)]).toEqual([
      'tags/:tagId',
      RequestMethod.DELETE,
    ])
    expect(meta(HTTP_CODE_METADATA, p.delete)).toBe(204)
    expect(Reflect.getMetadata(GUARDS_METADATA, TagsController)).toEqual([AuthGuard])
  })

  it.each([
    [TagsController, 'catalog'],
    [TagsController, 'create'],
    [TagsController, 'update'],
    [TagsController, 'delete'],
    [DeliveryController, 'getDelivery'],
  ] as const)(
    '%o.%s reads its id through UuidParamPipe, so a malformed id is a 404',
    (type, name) => {
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, type, name) as Record<
        string,
        { pipes: unknown[] }
      >
      const pipes = Object.values(args).flatMap((arg) => arg.pipes)
      expect(pipes).toContain(UuidParamPipe)
    },
  )

  it('wires the single-Issue read at GET ideas/:ideaId/delivery', () => {
    const handler = DeliveryController.prototype.getDelivery
    expect([meta(PATH_METADATA, handler), meta(METHOD_METADATA, handler)]).toEqual([
      'ideas/:ideaId/delivery',
      RequestMethod.GET,
    ])
    expect(Reflect.getMetadata(GUARDS_METADATA, DeliveryController)).toEqual([AuthGuard])
  })
})

describe('Tag body parsing', () => {
  it.each([
    ['absent', {}],
    ['null', { color: null }],
  ])('creates with a random palette colour when color is %s', async (_label, extra) => {
    const { controller } = setup()
    const item = await controller.create(ORG, { name: 'Fresh', ...extra })
    expect(item.color).toBe('#5CC8E0')
  })

  it.each([
    ['absent', {}],
    ['null', { color: null }],
  ])('keeps the stored colour on PUT when color is %s', async (_label, extra) => {
    const { controller } = setup()
    const item = await controller.update(TAG, { name: 'Backend', ...extra })
    expect(item.color).toBe('#2F9E8F')
  })

  it('stores a lower-case colour upper case', async () => {
    const { controller } = setup()
    expect((await controller.update(TAG, { name: 'Backend', color: '#abcdef' })).color).toBe(
      '#ABCDEF',
    )
  })

  it.each([
    ['a number', 0x112233],
    ['an array holding a colour', ['#112233']],
    ['an object', { hex: '#112233' }],
    ['a boolean', true],
  ])('answers 400 keyed color for %s, writing nothing', async (_label, color) => {
    const { controller, written } = setup()

    const error = await thrownBy(controller.create(ORG, { name: 'Fresh', color }))

    const rendered = render(error, `/api/v1/organizations/${ORG}/tags`)
    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({ color: ['Color must be a valid #RRGGBB color.'] })
    expect(written).toEqual([])
  })

  it.each([
    ['absent', {}],
    ['a number', { name: 7 }],
    ['blank', { name: '   ' }],
  ])('answers 400 keyed name when the name is %s', async (_label, body) => {
    const { controller } = setup()
    const rendered = render(
      await thrownBy(controller.create(ORG, body)),
      `/api/v1/organizations/${ORG}/tags`,
    )
    expect(rendered).toMatchObject({
      status: 400,
      body: { errors: { name: ['Tag name is required.'] } },
    })
  })

  it('answers a duplicate name 400 keyed name with the contract message', async () => {
    const { controller } = setup()
    const rendered = render(
      await thrownBy(controller.create(ORG, { name: ' BACKEND ' })),
      `/api/v1/organizations/${ORG}/tags`,
    )
    expect(rendered).toMatchObject({
      status: 400,
      body: { errors: { name: ['A tag with this name already exists.'] } },
    })
  })

  it('answers 404, not 500, when the tag vanishes between the read and the write', async () => {
    const { controller } = setup({ vanishOnWrite: true })
    expect(
      render(await thrownBy(controller.update(TAG, { name: 'Renamed' })), `/api/v1/tags/${TAG}`)
        .status,
    ).toBe(404)
    expect(render(await thrownBy(controller.delete(TAG)), `/api/v1/tags/${TAG}`).status).toBe(404)
  })
})
