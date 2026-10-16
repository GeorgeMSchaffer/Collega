// Metric types at the HTTP boundary (SPEC/contracts/metric-types.md). Part one pins the routing
// metadata and request parsing with a stand-in service. Part two puts the real MetricTypeService
// and IdeaMetricsService behind the controller over in-memory ports and renders every refusal
// through ProblemDetailsFilter, so the status and body a client sees are asserted for the role
// matrix, the check order and the field-keyed 400s. The rules themselves are the application suite's.

import {
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@collega/application/common'
import {
  type IdeaMetric,
  IdeaMetricsService,
  MetricTypeService,
} from '@collega/application/metric-types'
import { Priority, Role } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createMetricType, type MetricType } from '@collega/domain/metric-types'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { RequestValidationError } from '../src/common/errors/request-validation.error.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { MetricTypesController } from '../src/metric-types/metric-types.controller.js'
import { type RenderedProblem, renderProblem } from './problem-render.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '99999999-9999-4999-8999-999999999999'
const MT1 = '22222222-2222-4222-8222-222222222221'
const MT_OLD = '22222222-2222-4222-8222-222222222222'
const MT_FOREIGN = '22222222-2222-4222-8222-222222222229'
const IDEA = '33333333-3333-4333-8333-333333333333'
const TASK = '33333333-3333-4333-8333-333333333334'
const OTHER_IDEA = '33333333-3333-4333-8333-333333333339'
const MISSING = '33333333-3333-4333-8333-333333333399'
const AUTHOR = '44444444-4444-4444-8444-444444444444'
const URL = `/api/v1/organizations/${ORG}/metric-types`

const proto = MetricTypesController.prototype
const route = (handler: unknown) => ({
  path: Reflect.getMetadata(PATH_METADATA, handler as object) as string,
  method: Reflect.getMetadata(METHOD_METADATA, handler as object) as RequestMethod,
  code: Reflect.getMetadata(HTTP_CODE_METADATA, handler as object) as number | undefined,
})

function pipesOf(handler: string, name: string): unknown[] | undefined {
  const params = Reflect.getMetadata(
    '__routeArguments__',
    MetricTypesController,
    handler,
  ) as Record<string, { data?: string; pipes?: unknown[] }>
  return Object.values(params).find((p) => p.data === name)?.pipes
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('Metric type routing', () => {
  it.each([
    ['list', 'organizations/:organizationId/metric-types', RequestMethod.GET, undefined],
    ['create', 'organizations/:organizationId/metric-types', RequestMethod.POST, 201],
    [
      'update',
      'organizations/:organizationId/metric-types/:metricTypeId',
      RequestMethod.PUT,
      undefined,
    ],
    ['getIdeaMetrics', 'ideas/:ideaId/metrics', RequestMethod.GET, undefined],
    ['setIdeaMetrics', 'ideas/:ideaId/metrics', RequestMethod.PUT, undefined],
  ] as const)('%s is %s with the contract verb and status', (name, path, method, code) => {
    expect(route(proto[name])).toEqual({ path, method, code })
  })

  it('exposes no DELETE route: a metric type is archived, never deleted', () => {
    const methods = Object.getOwnPropertyNames(proto)
      .filter((n) => n !== 'constructor')
      .map((n) => Reflect.getMetadata(METHOD_METADATA, proto[n as keyof typeof proto] as object))

    expect(methods).not.toContain(RequestMethod.DELETE)
  })

  it('sits behind the auth guard and validates every id as a UUID', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MetricTypesController)).toContain(AuthGuard)
    for (const handler of ['list', 'create', 'update']) {
      expect(pipesOf(handler, 'organizationId')).toContain(UuidParamPipe)
    }
    expect(pipesOf('update', 'metricTypeId')).toContain(UuidParamPipe)
    for (const handler of ['getIdeaMetrics', 'setIdeaMetrics']) {
      expect(pipesOf(handler, 'ideaId')).toContain(UuidParamPipe)
    }
  })
})

describe('Metric type request parsing', () => {
  type Call = { method: string; args: unknown[] }
  function controllerOver() {
    const calls: Call[] = []
    const record =
      (method: string) =>
      async (...args: unknown[]) => {
        calls.push({ method, args })
        return { method }
      }
    const controller = new MetricTypesController(
      {
        list: record('list'),
        create: record('create'),
        update: record('update'),
      } as unknown as MetricTypeService,
      { get: record('get'), replace: record('replace') } as unknown as IdeaMetricsService,
    )
    return { controller, calls }
  }

  it('list reads includeArchived as true only for the literal true, in any casing', async () => {
    const { controller, calls } = controllerOver()

    await controller.list(ORG, {})
    await controller.list(ORG, { includeArchived: 'true' })
    await controller.list(ORG, { includeArchived: 'TRUE' })
    await controller.list(ORG, { includeArchived: 'false' })

    expect(calls.map((c) => c.args[1])).toEqual([false, true, true, false])
  })

  it('create hands over the name and unit, an absent or blank unit as null and a missing name as empty', async () => {
    const { controller, calls } = controllerOver()

    await controller.create(ORG, { name: 'Hours saved', unit: 'hours' })
    await controller.create(ORG, { name: 'x' })
    await controller.create(ORG, { name: 'x', unit: '  ' })
    await controller.create(ORG, { unit: 'h' })
    await controller.create(ORG, { name: 5 })

    expect(calls.map((c) => c.args)).toEqual([
      [ORG, { name: 'Hours saved', unit: 'hours' }],
      [ORG, { name: 'x', unit: null }],
      [ORG, { name: 'x', unit: null }],
      [ORG, { name: '', unit: 'h' }],
      [ORG, { name: '', unit: null }],
    ])
  })

  it('update hands over the path ids and the three fields', async () => {
    const { controller, calls } = controllerOver()

    await controller.update(ORG, MT1, { name: 'N', unit: null, isArchived: true })

    expect(calls[0]).toEqual({
      method: 'update',
      args: [ORG, MT1, { name: 'N', unit: null, isArchived: true }],
    })
  })

  it.each([
    ['absent', undefined],
    ['null', null],
    ['the string "true"', 'true'],
    ['a number', 1],
  ])(
    'update refuses an isArchived that is %s, keyed isArchived, before calling the service',
    async (_label, isArchived) => {
      const { controller, calls } = controllerOver()

      const error = await thrownBy(
        controller.update(ORG, MT1, { name: 'N', unit: null, isArchived }),
      )

      expect(error).toBeInstanceOf(RequestValidationError)
      expect(Object.keys(renderProblem(error, URL).body.errors as object)).toEqual(['isArchived'])
      expect(calls).toEqual([])
    },
  )

  // KNOWN DEVIATION (a): the contract makes every PUT field required ("full replacement"), so a
  // body with no `unit`, or a unit that is not a string or null, is a 400 keyed `unit`. The
  // controller reads both through `optional()` as null and succeeds. Reported to the owner.
  it.fails('update refuses a body with no unit (deviation a: accepted as null today)', async () => {
    const { controller } = controllerOver()

    const error = await thrownBy(controller.update(ORG, MT1, { name: 'N', isArchived: false }))

    expect(Object.keys(renderProblem(error, URL).body.errors as object)).toEqual(['unit'])
  })

  it.fails('update refuses a unit that is not a string (deviation a: accepted as null today)', async () => {
    const { controller } = controllerOver()

    const error = await thrownBy(
      controller.update(ORG, MT1, { name: 'N', unit: 5, isArchived: false }),
    )

    expect(Object.keys(renderProblem(error, URL).body.errors as object)).toEqual(['unit'])
  })

  it('setIdeaMetrics refuses a body without a list, keyed metrics, before calling the service', async () => {
    const { controller, calls } = controllerOver()

    for (const body of [{}, { metrics: null }, { metrics: 'x' }, { metrics: { a: 1 } }]) {
      const error = await thrownBy(controller.setIdeaMetrics(IDEA, body))
      expect(Object.keys(renderProblem(error, URL).body.errors as object)).toEqual(['metrics'])
    }
    expect(calls).toEqual([])
  })

  it('setIdeaMetrics reads numbers through, absent and null as null, anything else as NaN', async () => {
    const { controller, calls } = controllerOver()

    await controller.setIdeaMetrics(IDEA, {
      metrics: [
        { metricTypeId: MT1, projected: 1.5, realized: -2 },
        { metricTypeId: MT1, projected: null },
        { metricTypeId: MT1, projected: '5', realized: true },
      ],
    })

    const sent = calls[0]?.args[1] as { projected: number | null; realized: number | null }[]
    expect(sent[0]).toMatchObject({ projected: 1.5, realized: -2 })
    expect(sent[1]).toMatchObject({ projected: null, realized: null })
    expect(Number.isNaN(sent[2]?.projected)).toBe(true)
    expect(Number.isNaN(sent[2]?.realized)).toBe(true)
  })

  it('setIdeaMetrics turns a missing or non-string metricTypeId, and a null entry, into an id that names no type', async () => {
    const { controller, calls } = controllerOver()

    await controller.setIdeaMetrics(IDEA, {
      metrics: [{ projected: 1 }, { metricTypeId: 7, projected: 1 }, null],
    })

    const sent = calls[0]?.args[1] as { metricTypeId: string }[]
    expect(sent.map((s) => s.metricTypeId)).toEqual(['', '', ''])
  })

  it('getIdeaMetrics delegates with the path id', async () => {
    const { controller, calls } = controllerOver()

    await controller.getIdeaMetrics(IDEA)

    expect(calls).toEqual([{ method: 'get', args: [IDEA] }])
  })
})

// ---- the real services behind the controller ----

const NOW = new Date('2026-10-16T09:00:00.000Z')
const clock: Clock = { now: () => NOW }

function user(
  role: Role | null,
  organizationId: string | null = ORG,
  userId = 'u-1',
): CurrentUserContext {
  return {
    isAuthenticated: role !== null,
    userId: role === null ? null : userId,
    organizationId,
    role,
    isImpersonating: false,
    realUserId: role === null ? null : userId,
  }
}

function metricType(id: string, minute: number, overrides: Partial<MetricType> = {}): MetricType {
  return {
    ...createMetricType({
      id,
      organizationId: ORG,
      name: `Type ${minute}`,
      unit: '$',
      nowUtc: new Date(Date.UTC(2026, 9, 1, 0, minute)),
      actorUserId: null,
    }),
    ...overrides,
  }
}

function item(id: string, overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id,
      organizationId: ORG,
      boardId: null,
      statusId: 's',
      title: 'Idea',
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'b',
      dueDate: null,
      authorUserId: AUTHOR,
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...overrides,
  }
}

function wired(currentUser: CurrentUserContext) {
  const types = new Map(
    [
      metricType(MT1, 1),
      metricType(MT_OLD, 2, { isArchived: true }),
      metricType(MT_FOREIGN, 3, { organizationId: OTHER_ORG }),
    ].map((t) => [t.id, t]),
  )
  const ideas = new Map(
    [
      item(IDEA),
      item(TASK, { parentIdeaId: IDEA }),
      item(OTHER_IDEA, { organizationId: OTHER_ORG }),
    ].map((i) => [i.id, i]),
  )
  const values = new Map<
    string,
    Map<string, { projected: number | null; realized: number | null }>
  >()
  const repository = {
    getById: async (id: string) => types.get(id) ?? null,
    listByOrganization: async (org: string, includeArchived: boolean) =>
      [...types.values()]
        .filter((t) => t.organizationId === org && (includeArchived || !t.isArchived))
        .sort((a, b) => a.createdAtUtc.getTime() - b.createdAtUtc.getTime()),
    add: async (t: MetricType) => void types.set(t.id, t),
    save: async (t: MetricType) => void types.set(t.id, t),
  }
  const listByIdea = async (ideaId: string): Promise<readonly IdeaMetric[]> =>
    [...types.values()]
      .sort((a, b) => a.createdAtUtc.getTime() - b.createdAtUtc.getTime())
      .flatMap((t) => {
        const v = values.get(ideaId)?.get(t.id)
        return v
          ? [{ metricTypeId: t.id, name: t.name, unit: t.unit, isArchived: t.isArchived, ...v }]
          : []
      })
  const unitOfWork = { saveChanges: async () => undefined }
  const audit = { write: async () => undefined }
  return new MetricTypesController(
    new MetricTypeService(repository, unitOfWork, audit, currentUser, clock),
    new IdeaMetricsService(
      { getById: async (id) => ideas.get(id) ?? null },
      repository,
      {
        listByIdea,
        apply: async (ideaId, upserts, cleared) => {
          const byType = values.get(ideaId) ?? new Map()
          for (const id of cleared) byType.delete(id)
          for (const u of upserts) {
            byType.set(u.metricTypeId, { projected: u.projected, realized: u.realized })
          }
          values.set(ideaId, byType)
        },
      },
      unitOfWork,
      audit,
      currentUser,
      clock,
    ),
  )
}

async function status(promise: Promise<unknown>, url = URL): Promise<'ok' | RenderedProblem> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  return error === null ? 'ok' : renderProblem(error, url)
}

const errorKeys = (rendered: 'ok' | RenderedProblem) =>
  Object.keys((rendered === 'ok' ? {} : rendered.body.errors) as object)

describe('Metric type responses through the filter', () => {
  const typeWrites = (c: MetricTypesController) =>
    [
      ['create', () => c.create(ORG, { name: 'Savings', unit: '$' })],
      ['update', () => c.update(ORG, MT1, { name: 'Renamed', unit: '$', isArchived: false })],
    ] as const
  const typeReads = (c: MetricTypesController) => [['list', () => c.list(ORG, {})]] as const
  const ideaReads = (c: MetricTypesController) =>
    [['getIdeaMetrics', () => c.getIdeaMetrics(IDEA)]] as const
  const ideaWrites = (c: MetricTypesController) =>
    [
      [
        'setIdeaMetrics',
        () =>
          c.setIdeaMetrics(IDEA, { metrics: [{ metricTypeId: MT1, projected: 1, realized: 2 }] }),
      ],
    ] as const

  it('answers 403 to a User and to Read Only on every type write, and allows their reads', async () => {
    for (const role of [Role.User, Role.ReadOnly]) {
      const c = wired(user(role))
      for (const [, call] of typeWrites(c)) {
        expect(await status(call())).toMatchObject({ status: 403 })
      }
      for (const [, call] of [...typeReads(c), ...ideaReads(c)]) {
        expect(await status(call())).toBe('ok')
      }
    }
  })

  it('answers 403 to a Read Only user on the value write, and lets a User who is not the author be refused too', async () => {
    expect(await status(ideaWrites(wired(user(Role.ReadOnly)))[0][1]())).toMatchObject({
      status: 403,
    })
    expect(
      await status(ideaWrites(wired(user(Role.User, ORG, 'not-the-author')))[0][1]()),
    ).toMatchObject({
      status: 403,
    })
  })

  it('lets the author write values, and an Org Admin who is not the author', async () => {
    expect(await status(ideaWrites(wired(user(Role.User, ORG, AUTHOR)))[0][1]())).toBe('ok')
    expect(await status(ideaWrites(wired(user(Role.OrgAdmin)))[0][1]())).toBe('ok')
  })

  it('answers 403 to a direct Site Admin on every route, reads included', async () => {
    const c = wired(user(Role.SiteAdmin, null))
    for (const [, call] of [...typeWrites(c), ...typeReads(c), ...ideaReads(c), ...ideaWrites(c)]) {
      expect(await status(call())).toMatchObject({ status: 403 })
    }
  })

  it('lets an Org Admin do every route', async () => {
    const c = wired(user(Role.OrgAdmin))
    for (const [name, call] of [
      ...typeWrites(c),
      ...typeReads(c),
      ...ideaReads(c),
      ...ideaWrites(c),
    ]) {
      expect(await status(call()), name).toBe('ok')
    }
  })

  it('answers 401 to an anonymous caller on every route', async () => {
    const c = wired(user(null, null))
    for (const [, call] of [...typeWrites(c), ...typeReads(c), ...ideaReads(c), ...ideaWrites(c)]) {
      expect(await status(call())).toMatchObject({ status: 401 })
    }
  })

  it('answers 404 for an organization outside scope, a type of another organization and an idea of another organization', async () => {
    const c = wired(user(Role.OrgAdmin))

    expect(await status(c.list(OTHER_ORG, {}))).toMatchObject({ status: 404 })
    expect(await status(c.create(OTHER_ORG, { name: 'x' }))).toMatchObject({ status: 404 })
    expect(
      await status(c.update(ORG, MT_FOREIGN, { name: 'x', unit: null, isArchived: false })),
    ).toMatchObject({ status: 404 })
    expect(
      await status(c.update(ORG, MISSING, { name: 'x', unit: null, isArchived: false })),
    ).toMatchObject({
      status: 404,
    })
    expect(await status(c.getIdeaMetrics(OTHER_IDEA))).toMatchObject({ status: 404 })
    expect(await status(c.setIdeaMetrics(OTHER_IDEA, { metrics: [] }))).toMatchObject({
      status: 404,
    })
    expect(await status(c.getIdeaMetrics(MISSING))).toMatchObject({ status: 404 })
  })

  it('returns the created item and the listed items with the contract fields', async () => {
    const c = wired(user(Role.OrgAdmin))

    const created = await c.create(ORG, { name: ' Hours ', unit: '' })
    const listed = await c.list(ORG, {})

    expect(created).toMatchObject({
      organizationId: ORG,
      name: 'Hours',
      unit: null,
      isArchived: false,
    })
    expect(listed.map((t) => t.name)).toEqual(['Type 1', 'Hours'])
    expect(Object.keys(listed[0] ?? {}).sort()).toEqual(
      [
        'createdAt',
        'isArchived',
        'metricTypeId',
        'name',
        'organizationId',
        'unit',
        'updatedAt',
      ].sort(),
    )
  })

  it('lists archived types only on request', async () => {
    const c = wired(user(Role.User))
    expect((await c.list(ORG, {})).map((t) => t.metricTypeId)).toEqual([MT1])
    expect((await c.list(ORG, { includeArchived: 'true' })).map((t) => t.metricTypeId)).toEqual([
      MT1,
      MT_OLD,
    ])
  })

  it.each([
    ['name', { name: '', unit: null }, 'Name is required.'],
    ['name', { name: 'n'.repeat(81), unit: null }, 'Name must be 80 characters or fewer.'],
    ['unit', { name: 'x', unit: 'u'.repeat(21) }, 'Unit must be 20 characters or fewer.'],
  ])('renders a bad %s on create as 400 with that key and message', async (key, body, message) => {
    const rendered = await status(wired(user(Role.OrgAdmin)).create(ORG, body))

    expect(rendered).toMatchObject({ status: 400 })
    expect(errorKeys(rendered)).toEqual([key])
    expect(
      rendered === 'ok' ? [] : (rendered.body.errors as Record<string, string[]>)[key],
    ).toEqual([message])
  })

  it('renders a bad name on update as 400 keyed name, but a missing type as 404 first', async () => {
    const c = wired(user(Role.OrgAdmin))

    expect(
      await status(c.update(ORG, MT1, { name: '', unit: null, isArchived: false })),
    ).toMatchObject({
      status: 400,
    })
    expect(
      await status(c.update(ORG, MISSING, { name: '', unit: null, isArchived: false })),
    ).toMatchObject({ status: 404 })
  })

  it('renders update with a missing isArchived as 400 keyed isArchived', async () => {
    const rendered = await status(
      wired(user(Role.OrgAdmin)).update(ORG, MT1, { name: 'x', unit: null }),
    )

    expect(rendered).toMatchObject({ status: 400 })
    expect(errorKeys(rendered)).toEqual(['isArchived'])
  })

  it('archives and restores through update, and an archived type leaves the default list', async () => {
    const c = wired(user(Role.OrgAdmin))

    const archived = await c.update(ORG, MT1, { name: 'Type 1', unit: '$', isArchived: true })
    expect(archived.isArchived).toBe(true)
    expect(await c.list(ORG, {})).toEqual([])

    const restored = await c.update(ORG, MT1, { name: 'Type 1', unit: '$', isArchived: false })
    expect(restored.isArchived).toBe(false)
    expect(await c.list(ORG, {})).toHaveLength(1)
  })

  it.each([
    ['an unknown type', MISSING],
    ['an archived type', MT_OLD],
    ["another organization's type", MT_FOREIGN],
  ])(
    'renders %s in the value body as 400 keyed metrics, never 404',
    async (_label, metricTypeId) => {
      const rendered = await status(
        wired(user(Role.OrgAdmin)).setIdeaMetrics(IDEA, {
          metrics: [{ metricTypeId, projected: 1 }],
        }),
        `/api/v1/ideas/${IDEA}/metrics`,
      )

      expect(rendered).toMatchObject({ status: 400 })
      expect(errorKeys(rendered)).toEqual(['metrics'])
      expect(
        rendered === 'ok' ? [] : (rendered.body.errors as Record<string, string[]>).metrics,
      ).toEqual(['Metric type not found.'])
    },
  )

  it('renders a repeated type, an out-of-range number and an over-precise number as 400 keyed metrics', async () => {
    const c = wired(user(Role.OrgAdmin))
    for (const metrics of [
      [
        { metricTypeId: MT1, projected: 1 },
        { metricTypeId: MT1, projected: 2 },
      ],
      [{ metricTypeId: MT1, projected: 1e15 }],
      [{ metricTypeId: MT1, realized: -1e15 }],
      [{ metricTypeId: MT1, projected: 1.234 }],
      [{ metricTypeId: MT1, projected: 'ten' }],
    ]) {
      const rendered = await status(c.setIdeaMetrics(IDEA, { metrics }))

      expect(rendered).toMatchObject({ status: 400 })
      expect(errorKeys(rendered)).toEqual(['metrics'])
    }
  })

  it('renders a card with a parent as 422 with the code taskCannotCarryMetrics as the detail', async () => {
    const rendered = await status(
      wired(user(Role.OrgAdmin)).setIdeaMetrics(TASK, { metrics: [] }),
      `/api/v1/ideas/${TASK}/metrics`,
    )

    expect(rendered).toMatchObject({ status: 422 })
    expect(rendered === 'ok' ? '' : rendered.body.detail).toBe('taskCannotCarryMetrics')
  })

  it('checks 404 before 422 before 400 on the value write', async () => {
    const c = wired(user(Role.OrgAdmin))
    const bad = { metrics: [{ metricTypeId: MISSING, projected: 1 }] }

    expect(await status(c.setIdeaMetrics(MISSING, bad))).toMatchObject({ status: 404 })
    expect(await status(c.setIdeaMetrics(TASK, bad))).toMatchObject({ status: 422 })
    expect(await status(c.setIdeaMetrics(IDEA, bad))).toMatchObject({ status: 400 })
  })

  it('reads a card with a parent as an empty array', async () => {
    expect(await wired(user(Role.OrgAdmin)).getIdeaMetrics(TASK)).toEqual([])
  })

  it('returns the written values from the write and the same array from the read', async () => {
    const c = wired(user(Role.OrgAdmin))

    const written = await c.setIdeaMetrics(IDEA, {
      metrics: [{ metricTypeId: MT1, projected: 12.5, realized: null }],
    })

    expect(written).toEqual([
      {
        metricTypeId: MT1,
        name: 'Type 1',
        unit: '$',
        isArchived: false,
        projected: 12.5,
        realized: null,
      },
    ])
    expect(await c.getIdeaMetrics(IDEA)).toEqual(written)
  })

  it('maps the kernel refusals the contract names to their statuses', () => {
    expect(renderProblem(new ForbiddenError('x'), URL).status).toBe(403)
    expect(renderProblem(new NotFoundError('Metric type not found.'), URL).status).toBe(404)
    expect(renderProblem(new UnprocessableError('taskCannotCarryMetrics', 'x'), URL).status).toBe(
      422,
    )
  })
})
