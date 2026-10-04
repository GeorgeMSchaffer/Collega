// Fieldset routes at the HTTP boundary (SPEC/contracts/fieldsets.md, and the `fieldsetIds` key of
// PUT idea-types/:id/fields in SPEC/contracts/idea-type-fields.md). The controllers are driven
// directly over in-memory ports and every failure is rendered through `ProblemDetailsFilter`, so the
// status and the error envelope are what a client would see. Route wiring is read from Nest's
// decorator metadata rather than a booted server.

import type { Clock, CurrentUserContext } from '@collega/application/common'
import { type FieldsetRepository, FieldsetService } from '@collega/application/fieldsets'
import { IdeaTypeService } from '@collega/application/idea-fields'
import { FieldType, Role } from '@collega/domain/enums'
import { createFieldDefinition, type FieldDefinition } from '@collega/domain/fields'
import { createFieldset, type Fieldset } from '@collega/domain/fieldsets'
import { createIdeaType, type IdeaType } from '@collega/domain/idea-fields'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { FieldsetsController } from '../src/fieldsets/fieldsets.controller.js'
import { IdeaTypesController } from '../src/idea-types/idea-types.controller.js'
import { renderProblem } from './problem-render.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const ORG = '11111111-1111-1111-1111-111111111111'
const OTHER_ORG = '22222222-2222-2222-2222-222222222222'
const FIELDSET = 'f0000000-0000-4000-8000-000000000001'
const FOREIGN_FIELDSET = 'f0000000-0000-4000-8000-000000000002'
const TYPE = 'a0000000-0000-4000-8000-000000000001'
const FIELD_A = 'd0000000-0000-4000-8000-00000000000a'
const FIELD_B = 'd0000000-0000-4000-8000-00000000000b'
const FIELD_ARCHIVED = 'd0000000-0000-4000-8000-00000000000c'
const FIELD_FOREIGN = 'd0000000-0000-4000-8000-00000000000d'
const NOW = new Date('2026-10-04T12:00:00.000Z')
const ROUTE_ARGS_METADATA = '__routeArguments__'

function user(role: Role, organizationId: string | null = ORG): CurrentUserContext {
  return {
    isAuthenticated: true,
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    organizationId,
    role,
    isImpersonating: false,
    realUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  }
}

const ADMIN = user(Role.OrgAdmin)

function field(id: string, organizationId = ORG, isDeleted = false): FieldDefinition {
  return {
    ...createFieldDefinition({
      id,
      organizationId,
      name: `Field ${id.slice(-1)}`,
      description: null,
      fieldType: FieldType.Text,
      isRequired: false,
      displayOrder: 10,
      options: [],
      nowUtc: NOW,
      actorUserId: null,
    }),
    isDeleted,
  }
}

function fieldset(id: string, name: string, organizationId = ORG): Fieldset {
  return createFieldset({
    id,
    organizationId,
    name,
    description: null,
    displayOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
}

type Options = {
  currentUser?: CurrentUserContext
  attachedTo?: readonly IdeaType[]
}

function setup(options: Options = {}) {
  const currentUser = options.currentUser ?? ADMIN
  const store = new Map<string, Fieldset>([
    [FIELDSET, fieldset(FIELDSET, 'Launch kit')],
    [FOREIGN_FIELDSET, fieldset(FOREIGN_FIELDSET, 'Theirs', OTHER_ORG)],
  ])
  const definitions = [
    field(FIELD_A),
    field(FIELD_B),
    field(FIELD_ARCHIVED, ORG, true),
    field(FIELD_FOREIGN, OTHER_ORG),
  ]
  const ideaType: IdeaType = createIdeaType({
    id: TYPE,
    organizationId: ORG,
    name: 'Bug',
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  const types = new Map<string, IdeaType>([[TYPE, ideaType]])
  const savedTypes: IdeaType[] = []
  const attached = options.attachedTo ?? []

  const fieldsets: FieldsetRepository = {
    add: async (f) => void store.set(f.id, f),
    save: async (f) => void store.set(f.id, f),
    delete: async (id) => void store.delete(id),
    getById: async (id) => store.get(id) ?? null,
    listByOrganization: async (org) => [...store.values()].filter((f) => f.organizationId === org),
    getManyByIds: async (ids) => ids.flatMap((id) => store.get(id) ?? []),
    existsByName: async (org, name, exclude) =>
      [...store.values()].some(
        (f) =>
          f.organizationId === org &&
          f.id !== exclude &&
          f.normalizedName === name.trim().toLowerCase(),
      ),
    getUsage: async (ids) =>
      new Map(
        ids.map((id) => {
          const using = attached.filter((t) => t.fieldsets.some((l) => l.fieldsetId === id))
          return [id, { total: using.length, active: using.filter((t) => !t.isDeleted).length }]
        }),
      ),
  }
  const fieldDefinitions = {
    listByOrganization: async (org: string, includeDeleted: boolean) =>
      definitions.filter((d) => d.organizationId === org && (includeDeleted || !d.isDeleted)),
  } as never
  const clock: Clock = { now: () => NOW }
  const uow = { saveChanges: async () => {} }
  const audit = { write: async () => {} }
  const organizations = { existsById: async (id: string) => id === ORG || id === OTHER_ORG }

  const fieldsetService = new FieldsetService(
    fieldsets,
    fieldDefinitions,
    organizations,
    uow,
    audit,
    currentUser,
    clock,
  )
  const ideaTypeService = new IdeaTypeService(
    {
      getById: async (id: string) => types.get(id) ?? null,
      save: async (t: IdeaType) => {
        types.set(t.id, t)
        savedTypes.push(t)
      },
    } as never,
    fieldDefinitions,
    fieldsets,
    organizations,
    uow,
    audit,
    currentUser,
    clock,
  )
  return {
    fieldsets: new FieldsetsController(fieldsetService),
    ideaTypes: new IdeaTypesController(ideaTypeService),
    store,
    savedTypes,
  }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

const URL = `/api/v1/organizations/${ORG}/fieldsets`

async function problem(promise: Promise<unknown>, url = URL) {
  return renderProblem(await thrownBy(promise), url)
}

describe('Fieldset route wiring', () => {
  // biome-ignore lint/complexity/noBannedTypes: Reflect.getMetadata's own signature takes a Function.
  const meta = (key: string, handler: Function) => Reflect.getMetadata(key, handler)
  const p = FieldsetsController.prototype

  it.each([
    ['list', 'organizations/:organizationId/fieldsets', RequestMethod.GET, undefined],
    ['get', 'organizations/:organizationId/fieldsets/:id', RequestMethod.GET, undefined],
    ['create', 'organizations/:organizationId/fieldsets', RequestMethod.POST, 201],
    ['update', 'organizations/:organizationId/fieldsets/:id', RequestMethod.PUT, undefined],
    [
      'setFields',
      'organizations/:organizationId/fieldsets/:id/fields',
      RequestMethod.PUT,
      undefined,
    ],
    ['delete', 'organizations/:organizationId/fieldsets/:id', RequestMethod.DELETE, 204],
  ] as const)('%s is at its contract path, method and status', (name, path, method, code) => {
    expect([meta(PATH_METADATA, p[name]), meta(METHOD_METADATA, p[name])]).toEqual([path, method])
    expect(meta(HTTP_CODE_METADATA, p[name])).toBe(code)
  })

  it('requires sign-in on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, FieldsetsController)).toEqual([AuthGuard])
  })

  it.each(['list', 'get', 'create', 'update', 'setFields', 'delete'] as const)(
    '%s reads its path ids through UuidParamPipe, so a malformed id is a 404',
    (name) => {
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, FieldsetsController, name) as Record<
        string,
        { pipes: unknown[] }
      >
      const pipes = Object.values(args).flatMap((arg) => arg.pipes)
      expect(pipes).toContain(UuidParamPipe)
    },
  )
})

describe('Fieldset reads', () => {
  it('lists and gets the item shape for a member of the organization', async () => {
    const { fieldsets } = setup({ currentUser: user(Role.ReadOnly) })

    const listed = await fieldsets.list(ORG)
    const one = await fieldsets.get(ORG, FIELDSET)

    expect(listed).toHaveLength(1)
    expect(one).toEqual({
      fieldsetId: FIELDSET,
      organizationId: ORG,
      name: 'Launch kit',
      description: null,
      displayOrder: 10,
      usedByIdeaTypeCount: 0,
      fields: [],
    })
  })

  it('answers 404 Organization not found to a member naming another organization', async () => {
    const { fieldsets } = setup({ currentUser: user(Role.User) })

    const rendered = await problem(fieldsets.list(OTHER_ORG))

    expect(rendered.status).toBe(404)
    expect(rendered.body.detail).toBe('Organization not found.')
  })

  it('answers 404 Fieldset not found for another organization’s fieldset', async () => {
    const { fieldsets } = setup()

    const rendered = await problem(fieldsets.get(ORG, FOREIGN_FIELDSET))

    expect(rendered.status).toBe(404)
    expect(rendered.body.detail).toBe('Fieldset not found.')
  })

  it('answers 401 when the caller is not signed in', async () => {
    const { fieldsets } = setup({
      currentUser: {
        isAuthenticated: false,
        userId: null,
        organizationId: null,
        role: null,
        isImpersonating: false,
        realUserId: null,
      },
    })

    expect((await problem(fieldsets.list(ORG))).status).toBe(401)
  })
})

describe('Fieldset writes: roles', () => {
  const writes = [
    ['create', (c: FieldsetsController) => c.create(ORG, { name: 'New' })],
    ['update', (c: FieldsetsController) => c.update(ORG, FIELDSET, { name: 'New' })],
    [
      'setFields',
      (c: FieldsetsController) => c.setFields(ORG, FIELDSET, { fieldDefinitionIds: [] }),
    ],
    ['delete', (c: FieldsetsController) => c.delete(ORG, FIELDSET)],
  ] as const

  it.each(writes)('%s answers 403 to a User and a Read Only member', async (_name, call) => {
    for (const role of [Role.User, Role.ReadOnly]) {
      const { fieldsets, store } = setup({ currentUser: user(role) })
      const before = store.size

      const rendered = await problem(call(fieldsets))

      expect(rendered.status).toBe(403)
      expect(rendered.body.detail).toBe(
        'You are not allowed to manage fieldsets in this organization.',
      )
      expect(store.size).toBe(before)
    }
  })

  it.each(writes)('%s answers 403 to a Site Admin acting directly', async (_name, call) => {
    const { fieldsets } = setup({ currentUser: user(Role.SiteAdmin, null) })

    const rendered = await problem(call(fieldsets))

    expect(rendered.status).toBe(403)
    expect(rendered.body.detail).toBe(
      'Site Admins cannot change organization content directly. Use View As to act as a user in that organization.',
    )
  })

  it.each(writes)('%s answers 404 to an Org Admin of another organization', async (_name, call) => {
    const { fieldsets } = setup({ currentUser: user(Role.OrgAdmin, OTHER_ORG) })

    const rendered = await problem(call(fieldsets))

    expect(rendered.status).toBe(404)
    expect(rendered.body.detail).toBe('Organization not found.')
  })
})

describe('Fieldset create and update bodies', () => {
  it.each([
    ['absent', {}, 'Name is required.'],
    ['a number', { name: 7 as unknown as string }, 'Name is required.'],
    ['blank', { name: '   ' }, 'Name is required.'],
    ['over 100 characters', { name: 'x'.repeat(101) }, 'Name must be 100 characters or fewer.'],
  ])('answers the request-shape 400 keyed name when the name is %s', async (_l, body, message) => {
    const { fieldsets, store } = setup()
    const before = store.size

    const rendered = await problem(fieldsets.create(ORG, body))

    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({ name: [message] })
    expect(rendered.body.traceId).toBeUndefined()
    expect(store.size).toBe(before)
  })

  it('answers 400 keyed description when it is over 500 characters', async () => {
    const { fieldsets } = setup()

    const rendered = await problem(
      fieldsets.update(ORG, FIELDSET, { name: 'Ok', description: 'x'.repeat(501) }),
    )

    expect(rendered.body.errors).toEqual({
      description: ['Description must be 500 characters or fewer.'],
    })
  })

  it('checks the request shape before the role, so a User with a bad body still gets 400', async () => {
    const { fieldsets } = setup({ currentUser: user(Role.User) })

    expect((await problem(fieldsets.create(ORG, {}))).status).toBe(400)
  })

  it('answers a duplicate name 400 with a traceId and the contract message, case-insensitively', async () => {
    const { fieldsets } = setup()

    const rendered = await problem(fieldsets.create(ORG, { name: 'LAUNCH KIT' }))

    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({
      name: ["A fieldset named 'LAUNCH KIT' already exists in this organization."],
    })
    expect(rendered.body.traceId).toBeDefined()
  })

  it('creates with 10-step ordering, ignoring a non-number displayOrder', async () => {
    const { fieldsets } = setup()

    const created = await fieldsets.create(ORG, {
      name: '  Second  ',
      description: '   ',
      displayOrder: 'soon',
    })

    expect(created).toMatchObject({
      name: 'Second',
      description: null,
      displayOrder: 20,
      usedByIdeaTypeCount: 0,
      fields: [],
    })
  })

  it('updates the name and keeps the stored order when displayOrder is omitted', async () => {
    const { fieldsets } = setup()

    await expect(fieldsets.update(ORG, FIELDSET, { name: 'Renamed' })).resolves.toMatchObject({
      name: 'Renamed',
      displayOrder: 10,
    })
  })
})

describe('PUT fieldsets/:id/fields body', () => {
  it.each([
    ['absent', {}],
    ['null', { fieldDefinitionIds: null }],
    ['a string', { fieldDefinitionIds: FIELD_A }],
    ['an object', { fieldDefinitionIds: { 0: FIELD_A } }],
  ])(
    'answers the request-shape 400 when fieldDefinitionIds is %s, changing nothing',
    async (_l, body) => {
      const { fieldsets, store } = setup()

      const rendered = await problem(fieldsets.setFields(ORG, FIELDSET, body))

      expect(rendered.status).toBe(400)
      expect(rendered.body.errors).toEqual({
        fieldDefinitionIds: ['Field Definition Ids is required.'],
      })
      expect(rendered.body.traceId).toBeUndefined()
      expect(store.get(FIELDSET)?.fields).toEqual([])
    },
  )

  it('replaces the members with an empty list and in the listed order', async () => {
    const { fieldsets } = setup()

    const ordered = await fieldsets.setFields(ORG, FIELDSET, {
      fieldDefinitionIds: [FIELD_B, FIELD_A],
    })
    expect(ordered.fields.map((f) => [f.fieldDefinitionId, f.displayOrder])).toEqual([
      [FIELD_B, 10],
      [FIELD_A, 20],
    ])

    await expect(
      fieldsets.setFields(ORG, FIELDSET, { fieldDefinitionIds: [] }),
    ).resolves.toMatchObject({ fields: [] })
  })

  it.each([
    ['a repeated id', [FIELD_A, FIELD_A], 'A field may appear at most once in a fieldset.'],
    [
      'an archived field',
      [FIELD_ARCHIVED],
      `'${FIELD_ARCHIVED}' is not an active custom field in this organization.`,
    ],
    [
      'another organization’s field',
      [FIELD_FOREIGN],
      `'${FIELD_FOREIGN}' is not an active custom field in this organization.`,
    ],
    [
      'a malformed id (read as unknown)',
      ['not-a-guid'],
      "'00000000-0000-0000-0000-000000000000' is not an active custom field in this organization.",
    ],
    [
      'a non-string member (read as unknown)',
      [42],
      "'00000000-0000-0000-0000-000000000000' is not an active custom field in this organization.",
    ],
  ])('answers 400 keyed fieldDefinitionIds for %s', async (_l, ids, message) => {
    const { fieldsets, store } = setup()

    const rendered = await problem(
      fieldsets.setFields(ORG, FIELDSET, { fieldDefinitionIds: ids as unknown[] }),
    )

    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({ fieldDefinitionIds: [message] })
    expect(store.get(FIELDSET)?.fields).toEqual([])
  })

  it('answers 404 Fieldset not found for an unknown fieldset', async () => {
    const { fieldsets } = setup()

    const rendered = await problem(
      fieldsets.setFields(ORG, 'f0000000-0000-4000-8000-0000000000ff', { fieldDefinitionIds: [] }),
    )

    expect(rendered.status).toBe(404)
    expect(rendered.body.detail).toBe('Fieldset not found.')
  })
})

describe('DELETE fieldsets/:id', () => {
  it('deletes a detached fieldset (the controller returns nothing; the route’s status is 204)', async () => {
    const { fieldsets, store } = setup()

    await expect(fieldsets.delete(ORG, FIELDSET)).resolves.toBeUndefined()
    expect(store.has(FIELDSET)).toBe(false)
  })

  it('answers 409 with the contract message while an idea type, archived or not, has it attached', async () => {
    const archivedType = {
      ...createIdeaType({
        id: 'b0000000-0000-4000-8000-000000000009',
        organizationId: ORG,
        name: 'Old',
        sortOrder: 1,
        nowUtc: NOW,
        actorUserId: null,
      }),
      isDeleted: true,
      fieldsets: [
        {
          id: 'l1',
          ideaTypeId: 'b0000000-0000-4000-8000-000000000009',
          fieldsetId: FIELDSET,
          displayOrder: 10,
        },
      ],
    } satisfies IdeaType
    const { fieldsets, store } = setup({ attachedTo: [archivedType] })

    const rendered = await problem(fieldsets.delete(ORG, FIELDSET))

    expect(rendered.status).toBe(409)
    expect(rendered.body.detail).toBe(
      'This fieldset is used by 1 idea type(s). Remove it from them first.',
    )
    expect(store.has(FIELDSET)).toBe(true)
  })

  it('answers 404 for another organization’s fieldset', async () => {
    const { fieldsets } = setup()

    const rendered = await problem(fieldsets.delete(ORG, FOREIGN_FIELDSET))

    expect(rendered.status).toBe(404)
    expect(rendered.body.detail).toBe('Fieldset not found.')
  })
})

describe('PUT idea-types/:id/fields fieldsetIds parsing', () => {
  const URL_FIELDS = `/api/v1/organizations/${ORG}/idea-types/${TYPE}/fields`

  it.each([
    ['omitted', {}],
    ['null', { fieldsetIds: null }],
    ['an empty list', { fieldsetIds: [] }],
  ])('treats fieldsetIds %s as none, clearing the type to AllActiveFields', async (_l, body) => {
    const { ideaTypes, savedTypes } = setup()

    await expect(ideaTypes.setFields(ORG, TYPE, body)).resolves.toBeUndefined()

    expect(savedTypes.at(-1)).toMatchObject({ fieldMode: 'AllActiveFields', fieldsets: [] })
  })

  it('attaches the listed fieldsets in order and makes the type Curated', async () => {
    const { ideaTypes, savedTypes } = setup()

    await ideaTypes.setFields(ORG, TYPE, { fieldsetIds: [FIELDSET] })

    expect(savedTypes.at(-1)).toMatchObject({ fieldMode: 'Curated' })
    expect(savedTypes.at(-1)?.fieldsets.map((l) => l.fieldsetId)).toEqual([FIELDSET])
  })

  it.each([
    ['a string', 'launch'],
    ['an object', { 0: FIELDSET }],
    ['a number', 7],
    ['a boolean', true],
  ])(
    'answers the request-shape 400 when fieldsetIds is %s, not "none"',
    async (_l, fieldsetIds) => {
      const { ideaTypes, savedTypes } = setup()

      const rendered = await problem(ideaTypes.setFields(ORG, TYPE, { fieldsetIds }), URL_FIELDS)

      expect(rendered.status).toBe(400)
      expect(rendered.body.errors).toEqual({
        fieldsetIds: ['Fieldset Ids must be a list of GUIDs.'],
      })
      expect(rendered.body.traceId).toBeUndefined()
      expect(savedTypes).toEqual([])
    },
  )

  it.each([
    [
      'an unknown id',
      ['f0000000-0000-4000-8000-0000000000ee'],
      "'f0000000-0000-4000-8000-0000000000ee' is not a fieldset in this organization.",
    ],
    [
      'another organization’s fieldset',
      [FOREIGN_FIELDSET],
      `'${FOREIGN_FIELDSET}' is not a fieldset in this organization.`,
    ],
    [
      'a malformed id (read as unknown)',
      ['not-a-guid'],
      "'00000000-0000-0000-0000-000000000000' is not a fieldset in this organization.",
    ],
    ['a repeated id', [FIELDSET, FIELDSET], 'A fieldset may appear at most once in the selection.'],
  ])('answers 400 keyed fieldsetIds for %s, saving nothing', async (_l, fieldsetIds, message) => {
    const { ideaTypes, savedTypes } = setup()

    const rendered = await problem(ideaTypes.setFields(ORG, TYPE, { fieldsetIds }), URL_FIELDS)

    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({ fieldsetIds: [message] })
    expect(savedTypes).toEqual([])
  })

  it('answers 404 for an idea type that does not exist in the organization', async () => {
    const { ideaTypes } = setup()

    const rendered = await problem(
      ideaTypes.setFields(ORG, 'a0000000-0000-4000-8000-0000000000ff', { fieldsetIds: [FIELDSET] }),
      URL_FIELDS,
    )

    expect(rendered.status).toBe(404)
  })
})
