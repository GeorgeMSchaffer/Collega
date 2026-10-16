// Outcomes at the HTTP boundary (SPEC/contracts/outcomes.md). Part one drives OutcomesController
// with a stand-in service to pin routing metadata and request parsing. Part two puts the real
// OutcomeService behind the controller over in-memory ports and renders every refusal through
// ProblemDetailsFilter, so the status and body a client sees are asserted for the role matrix and
// the field-keyed 400s. The rules themselves are the application suite's.

import {
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@collega/application/common'
import { OutcomeService } from '@collega/application/outcomes'
import { Priority, Role, UserStatus } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import { createOutcome, type Outcome } from '@collega/domain/outcomes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { RequestValidationError } from '../src/common/errors/request-validation.error.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { OutcomesController } from '../src/outcomes/outcomes.controller.js'
import { renderProblem } from './problem-render.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER_ORG = '99999999-9999-4999-8999-999999999999'
const O1 = '22222222-2222-4222-8222-222222222221'
const O2 = '22222222-2222-4222-8222-222222222222'
const IDEA = '33333333-3333-4333-8333-333333333333'
const OWNER = '44444444-4444-4444-8444-444444444444'
// What a non-GUID id becomes at the boundary: it matches no row, so the service answers 400/404.
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const URL = `/api/v1/organizations/${ORG}/outcomes`

const BODY = {
  name: 'Launch',
  description: 'Why',
  targetStartDate: '2026-10-01',
  targetEndDate: '2026-12-31',
  ownerUserId: OWNER,
  color: '#abcdef',
}

const proto = OutcomesController.prototype
const route = (handler: unknown) => ({
  path: Reflect.getMetadata(PATH_METADATA, handler as object) as string,
  method: Reflect.getMetadata(METHOD_METADATA, handler as object) as RequestMethod,
  code: Reflect.getMetadata(HTTP_CODE_METADATA, handler as object) as number | undefined,
})

function pipesOf(handler: string, name: string): unknown[] | undefined {
  const params = Reflect.getMetadata('__routeArguments__', OutcomesController, handler) as Record<
    string,
    { data?: string; pipes?: unknown[] }
  >
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

describe('Outcome routing', () => {
  it.each([
    ['list', `organizations/:organizationId/outcomes`, RequestMethod.GET, undefined],
    ['create', `organizations/:organizationId/outcomes`, RequestMethod.POST, 201],
    ['reorder', `organizations/:organizationId/outcomes/order`, RequestMethod.PUT, 204],
    ['roadmap', `organizations/:organizationId/roadmap`, RequestMethod.GET, undefined],
    ['getById', `organizations/:organizationId/outcomes/:outcomeId`, RequestMethod.GET, undefined],
    ['update', `organizations/:organizationId/outcomes/:outcomeId`, RequestMethod.PUT, undefined],
    ['delete', `organizations/:organizationId/outcomes/:outcomeId`, RequestMethod.DELETE, 204],
    ['setIdeaOutcome', `ideas/:ideaId/outcomes`, RequestMethod.PUT, undefined],
  ] as const)('%s is %s with the contract verb and status', (name, path, method, code) => {
    expect(route(proto[name])).toEqual({ path, method, code })
  })

  it('declares the literal order route before the :outcomeId routes', () => {
    const names = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor')
    const paths = names.map((n) => [
      n,
      Reflect.getMetadata(PATH_METADATA, proto[n as keyof typeof proto] as object) as string,
      Reflect.getMetadata(METHOD_METADATA, proto[n as keyof typeof proto] as object) as number,
    ])
    const index = (path: string, method: number) =>
      paths.findIndex(([, p, m]) => p === path && m === method)
    const order = index('organizations/:organizationId/outcomes/order', RequestMethod.PUT)
    const update = index('organizations/:organizationId/outcomes/:outcomeId', RequestMethod.PUT)

    expect(order).toBeGreaterThanOrEqual(0)
    expect(order).toBeLessThan(update)
  })

  it('sits behind the auth guard and validates every id as a UUID', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, OutcomesController)).toContain(AuthGuard)
    for (const handler of ['list', 'create', 'reorder', 'roadmap', 'getById', 'update', 'delete']) {
      expect(pipesOf(handler, 'organizationId')).toContain(UuidParamPipe)
    }
    for (const handler of ['getById', 'update', 'delete']) {
      expect(pipesOf(handler, 'outcomeId')).toContain(UuidParamPipe)
    }
    expect(pipesOf('setIdeaOutcome', 'ideaId')).toContain(UuidParamPipe)
  })
})

describe('Outcome request parsing', () => {
  type Call = { method: string; args: unknown[] }
  function controllerOver() {
    const calls: Call[] = []
    const record =
      (method: string) =>
      async (...args: unknown[]) => {
        calls.push({ method, args })
        return { method }
      }
    const service = {
      list: record('list'),
      create: record('create'),
      update: record('update'),
      reorder: record('reorder'),
      roadmap: record('roadmap'),
      get: record('get'),
      delete: record('delete'),
      setIdeaOutcome: record('setIdeaOutcome'),
    } as unknown as OutcomeService
    return { controller: new OutcomesController(service), calls }
  }

  it('passes page and pageSize through only when present', async () => {
    const { controller, calls } = controllerOver()

    await controller.list(ORG, {})
    await controller.list(ORG, { page: '2', pageSize: '50' })
    await controller.list(ORG, { page: 'abc' })

    expect(calls.map((c) => c.args[1])).toEqual([{}, { page: 2, pageSize: 50 }, {}])
  })

  it('create hands over the parsed fields, blank optionals as null and a missing name as empty', async () => {
    const { controller, calls } = controllerOver()

    await controller.create(ORG, BODY)
    await controller.create(ORG, { description: ' ', ownerUserId: '' })

    expect(calls[0]?.args).toEqual([
      ORG,
      {
        name: 'Launch',
        description: 'Why',
        targetStartDate: '2026-10-01',
        targetEndDate: '2026-12-31',
        ownerUserId: OWNER,
        color: '#abcdef',
      },
    ])
    expect(calls[1]?.args[1]).toEqual({
      name: '',
      description: null,
      targetStartDate: '',
      targetEndDate: '',
      ownerUserId: null,
      color: null,
    })
  })

  it('create reads an absent or null colour as null, and a non-text colour as text that fails validation', async () => {
    const { controller, calls } = controllerOver()

    await controller.create(ORG, { ...BODY, color: undefined })
    await controller.create(ORG, { ...BODY, color: null })
    await controller.create(ORG, { ...BODY, color: 12 })

    expect(calls.map((c) => (c.args[1] as { color: unknown }).color)).toEqual([null, null, ''])
  })

  it('update tells an absent colour (undefined) from an explicit null', async () => {
    const { controller, calls } = controllerOver()
    const { color: _omitted, ...withoutColor } = BODY

    await controller.update(ORG, O1, withoutColor)
    await controller.update(ORG, O1, { ...BODY, color: null })
    await controller.update(ORG, O1, { ...BODY, color: '#112233' })

    expect(calls.map((c) => (c.args[2] as { color: unknown }).color)).toEqual([
      undefined,
      null,
      '#112233',
    ])
    expect(calls[0]?.args.slice(0, 2)).toEqual([ORG, O1])
  })

  it('reorder passes the id list, null when absent, and refuses a non-list with 400 keyed orderedIds', async () => {
    const { controller, calls } = controllerOver()

    await controller.reorder(ORG, { orderedIds: [O1, O2] })
    await controller.reorder(ORG, {})
    await controller.reorder(ORG, { orderedIds: null })

    expect(calls.map((c) => c.args[1])).toEqual([[O1, O2], null, null])

    const error = await thrownBy(controller.reorder(ORG, { orderedIds: 'nope' }))
    expect(error).toBeInstanceOf(RequestValidationError)
    const rendered = renderProblem(error, `${URL}/order`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['orderedIds'])
    expect(calls).toHaveLength(3)
  })

  it('reorder turns a non-string element into an empty id so the service refuses it', async () => {
    const { controller, calls } = controllerOver()
    await controller.reorder(ORG, { orderedIds: [O1, 7] })
    expect(calls[0]?.args[1]).toEqual([O1, ''])
  })

  it('grouping passes null for null or absent and a GUID through; a non-GUID becomes the empty GUID', async () => {
    const { controller, calls } = controllerOver()

    await controller.setIdeaOutcome(IDEA, { outcomeId: O1 })
    await controller.setIdeaOutcome(IDEA, { outcomeId: null })
    await controller.setIdeaOutcome(IDEA, {})
    await controller.setIdeaOutcome(IDEA, { outcomeId: 'not-a-guid' })

    expect(calls.map((c) => c.args)).toEqual([
      [IDEA, O1],
      [IDEA, null],
      [IDEA, null],
      [IDEA, EMPTY_GUID],
    ])
  })

  it('get, delete and roadmap delegate with the path ids', async () => {
    const { controller, calls } = controllerOver()

    await controller.getById(ORG, O1)
    await controller.delete(ORG, O1)
    await controller.roadmap(ORG)

    expect(calls).toEqual([
      { method: 'get', args: [ORG, O1] },
      { method: 'delete', args: [ORG, O1] },
      { method: 'roadmap', args: [ORG] },
    ])
  })
})

// ---- the real service behind the controller ----

const NOW = new Date('2026-10-15T09:00:00.000Z')
const clock: Clock = { now: () => NOW }

function user(role: Role | null, organizationId: string | null = ORG): CurrentUserContext {
  return {
    isAuthenticated: role !== null,
    userId: role === null ? null : 'u-1',
    organizationId,
    role,
    isImpersonating: false,
    realUserId: role === null ? null : 'u-1',
  }
}

function outcome(id: string, overrides: Partial<Outcome> = {}): Outcome {
  return {
    ...createOutcome({
      id,
      organizationId: ORG,
      name: `Outcome ${id.slice(-1)}`,
      description: null,
      targetStartDate: '2026-10-01',
      targetEndDate: '2026-12-31',
      ownerUserId: null,
      sortOrder: Number(id.slice(-1)),
      color: '#112233',
      nowUtc: NOW,
      actorUserId: null,
    }),
    ...overrides,
  }
}

function item(overrides: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id: IDEA,
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
      authorUserId: 'a',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...overrides,
  }
}

function wired(currentUser: CurrentUserContext, ideas: Idea[] = [item()]) {
  const store = new Map<string, Outcome>(
    [
      outcome(O1),
      outcome(O2),
      outcome('22222222-2222-4222-8222-222222222229', { organizationId: OTHER_ORG }),
    ].map((o) => [o.id, o]),
  )
  const ideaStore = new Map(ideas.map((i) => [i.id, i]))
  const service = new OutcomeService(
    {
      getById: async (id) => store.get(id) ?? null,
      listByOrganization: async (org) =>
        [...store.values()]
          .filter((o) => o.organizationId === org && !o.isDeleted)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      add: async (o) => void store.set(o.id, o),
      save: async (o) => void store.set(o.id, o),
      ungroupIdeas: async () => undefined,
    },
    {
      rollupsByOutcomeIds: async (ids) =>
        new Map(
          ids.map((id) => [
            id,
            {
              ideaCount: 0,
              doneIdeaCount: 0,
              taskCount: 0,
              doneTaskCount: 0,
              sprintStart: null,
              sprintEnd: null,
            },
          ]),
        ),
      ideasByOutcomeIds: async () => new Map(),
      listUngroupedIdeas: async () => [],
    },
    {
      getById: async (id) => ideaStore.get(id) ?? null,
      update: async (i) => void ideaStore.set(i.id, i),
    },
    {
      listByIds: async (ids) =>
        ids.includes(OWNER) ? [{ id: OWNER, organizationId: ORG, status: UserStatus.Active }] : [],
    },
    { saveChanges: async () => undefined },
    { write: async () => undefined },
    currentUser,
    clock,
    { nextInt: () => 0 },
  )
  return new OutcomesController(service)
}

async function status(promise: Promise<unknown>, url = URL) {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  return error === null ? 'ok' : renderProblem(error, url)
}

describe('Outcome responses through the filter', () => {
  const writes = (c: OutcomesController) =>
    [
      ['create', () => c.create(ORG, BODY)],
      ['update', () => c.update(ORG, O1, BODY)],
      ['reorder', () => c.reorder(ORG, { orderedIds: [O1] })],
      ['delete', () => c.delete(ORG, O1)],
      ['group', () => c.setIdeaOutcome(IDEA, { outcomeId: O1 })],
    ] as const
  const reads = (c: OutcomesController) =>
    [
      ['list', () => c.list(ORG, {})],
      ['get', () => c.getById(ORG, O1)],
      ['roadmap', () => c.roadmap(ORG)],
    ] as const

  it('answers 403 to a User and to Read Only on every write, and allows their reads', async () => {
    for (const role of [Role.User, Role.ReadOnly]) {
      const c = wired(user(role))
      for (const [, call] of writes(c)) {
        expect(await status(call())).toMatchObject({ status: 403 })
      }
      for (const [, call] of reads(c)) {
        expect(await status(call())).toBe('ok')
      }
    }
  })

  it('answers 403 to a direct Site Admin on every route, reads included', async () => {
    const c = wired(user(Role.SiteAdmin, null))
    for (const [, call] of [...writes(c), ...reads(c)]) {
      expect(await status(call())).toMatchObject({ status: 403 })
    }
  })

  it('lets an Org Admin do every route', async () => {
    const count =
      reads(wired(user(Role.OrgAdmin))).length + writes(wired(user(Role.OrgAdmin))).length
    for (let index = 0; index < count; index++) {
      // A fresh controller per route: delete removes O1 for the routes after it.
      const c = wired(user(Role.OrgAdmin))
      const [name, call] = [...reads(c), ...writes(c)][index] as readonly [
        string,
        () => Promise<unknown>,
      ]
      expect(await status(call()), name).toBe('ok')
    }
  })

  it('answers 401 to an anonymous caller', async () => {
    const c = wired(user(null, null))
    expect(await status(c.list(ORG, {}))).toMatchObject({ status: 401 })
    expect(await status(c.create(ORG, BODY))).toMatchObject({ status: 401 })
  })

  it('answers 404 for an organization outside scope and for another organization Outcome', async () => {
    const c = wired(user(Role.OrgAdmin))
    expect(await status(c.list(OTHER_ORG, {}))).toMatchObject({ status: 404 })
    expect(await status(c.roadmap(OTHER_ORG))).toMatchObject({ status: 404 })
    expect(await status(c.getById(ORG, '22222222-2222-4222-8222-222222222229'))).toMatchObject({
      status: 404,
    })
    expect(await status(c.delete(ORG, '22222222-2222-4222-8222-222222222229'))).toMatchObject({
      status: 404,
    })
  })

  it('renders create validation as a 400 whose errors are keyed by camelCase field', async () => {
    const c = wired(user(Role.OrgAdmin))

    const rendered = await status(
      c.create(ORG, {
        name: '',
        description: 'x'.repeat(1001),
        targetStartDate: 'nope',
        targetEndDate: '',
        ownerUserId: 'not-a-guid',
        color: 'red',
      }),
    )

    expect(rendered).toMatchObject({ status: 400 })
    const first = rendered === 'ok' ? {} : rendered.body.errors
    expect(Object.keys(first as object).length).toBeGreaterThan(0)
  })

  it.each([
    ['name', { name: '' }, 'Name is required.'],
    ['color', { color: 'red' }, 'Color must be a valid #RRGGBB color.'],
    ['targetEndDate', { targetEndDate: '2026-01-01' }, 'End date must be on or after start date.'],
    ['ownerUserId', { ownerUserId: 'not-a-guid' }, undefined],
  ])('renders a bad %s as 400 with that key', async (key, patch, message) => {
    const c = wired(user(Role.OrgAdmin))

    const rendered = await status(c.create(ORG, { ...BODY, ...patch }))

    expect(rendered).toMatchObject({ status: 400 })
    const errors = (rendered === 'ok' ? {} : rendered.body.errors) as Record<string, string[]>
    expect(Object.keys(errors)).toEqual([key])
    if (message) expect(errors[key]).toEqual([message])
  })

  it('renders update null colour as 400 keyed color, and an absent colour as success', async () => {
    const c = wired(user(Role.OrgAdmin))
    const { color: _omitted, ...withoutColor } = BODY

    const refused = await status(c.update(ORG, O1, { ...BODY, color: null }))
    expect(refused).toMatchObject({ status: 400 })
    expect(Object.keys((refused === 'ok' ? {} : refused.body.errors) as object)).toEqual(['color'])
    expect(await status(c.update(ORG, O1, withoutColor))).toBe('ok')
  })

  it.each([
    ['an empty list', []],
    ['an absent list', undefined],
    ['a duplicate', [O1, O1]],
    ['an unknown id', [O1, '22222222-2222-4222-8222-2222222222aa']],
    ['another organization id', ['22222222-2222-4222-8222-222222222229']],
  ])('renders reorder with %s as 400 keyed orderedIds', async (_l, ids) => {
    const c = wired(user(Role.OrgAdmin))

    const rendered = await status(c.reorder(ORG, ids === undefined ? {} : { orderedIds: ids }))

    expect(rendered).toMatchObject({ status: 400 })
    expect(Object.keys((rendered === 'ok' ? {} : rendered.body.errors) as object)).toEqual([
      'orderedIds',
    ])
  })

  it('returns nothing from reorder and delete (204 bodies are empty), and the item from create', async () => {
    const c = wired(user(Role.OrgAdmin))

    await expect(c.reorder(ORG, { orderedIds: [O2, O1] })).resolves.toBeUndefined()
    await expect(c.delete(ORG, O1)).resolves.toBeUndefined()
    await expect(c.delete(ORG, O1)).resolves.toBeUndefined()
    await expect(c.create(ORG, BODY)).resolves.toMatchObject({
      color: '#ABCDEF',
      ideaCount: 0,
      sprintStart: null,
    })
  })

  it('answers GET and PUT of a deleted Outcome with 404', async () => {
    const c = wired(user(Role.OrgAdmin))
    await c.delete(ORG, O1)

    expect(await status(c.getById(ORG, O1))).toMatchObject({ status: 404 })
    expect(await status(c.update(ORG, O1, BODY))).toMatchObject({ status: 404 })
  })

  it('renders grouping: 404 unknown idea first, 400 keyed outcomeId, 422 taskCannotBeGrouped, 200 body', async () => {
    const c = wired(user(Role.OrgAdmin), [
      item(),
      item({ id: O2.replace('2222', '5555'), parentIdeaId: IDEA }),
    ])
    const taskId = O2.replace('2222', '5555')
    const unknownIdea = '33333333-3333-4333-8333-333333333399'

    expect(await status(c.setIdeaOutcome(unknownIdea, { outcomeId: 'nope' }), '/x')).toMatchObject({
      status: 404,
    })

    const badOutcome = await status(c.setIdeaOutcome(IDEA, { outcomeId: unknownIdea }), '/x')
    expect(badOutcome).toMatchObject({ status: 400 })
    expect(Object.keys((badOutcome === 'ok' ? {} : badOutcome.body.errors) as object)).toEqual([
      'outcomeId',
    ])

    const task = await status(c.setIdeaOutcome(taskId, { outcomeId: O1 }), '/x')
    expect(task).toMatchObject({ status: 422 })
    expect(task === 'ok' ? '' : task.body.detail).toBe('taskCannotBeGrouped')

    await expect(c.setIdeaOutcome(IDEA, { outcomeId: O1 })).resolves.toEqual({
      ideaId: IDEA,
      outcomeId: O1,
    })
    await expect(c.setIdeaOutcome(IDEA, { outcomeId: null })).resolves.toEqual({
      ideaId: IDEA,
      outcomeId: null,
    })
  })

  it('maps the kernel refusals the contract names to their statuses', () => {
    expect(renderProblem(new ForbiddenError('x'), URL).status).toBe(403)
    expect(renderProblem(new NotFoundError('Outcome not found.'), URL).status).toBe(404)
    expect(renderProblem(new UnprocessableError('taskCannotBeGrouped', 'x'), URL).status).toBe(422)
  })
})
