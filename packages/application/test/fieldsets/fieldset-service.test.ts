// FieldsetService (SPEC/contracts/fieldsets.md): who may read and write, name uniqueness,
// membership replacement and the delete guard. Ports are in-memory; usage is computed from a list
// of idea types so "archived types still block a delete" is exercised for real.

import { FieldType, Role } from '@collega/domain/enums'
import { createFieldDefinition, type FieldDefinition } from '@collega/domain/fields'
import { createFieldset, type Fieldset } from '@collega/domain/fieldsets'
import {
  createIdeaType,
  type IdeaType,
  setIdeaTypeFieldSelection,
  softDeleteIdeaType,
} from '@collega/domain/idea-fields'
import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  type CurrentUserContext,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../src/common/index.js'
import type { FieldDefinitionRepository } from '../../src/fields/ports.js'
import { FieldsetService } from '../../src/fieldsets/fieldset-service.js'
import type { FieldsetRepository, FieldsetUsage } from '../../src/fieldsets/ports.js'
import {
  anonymous,
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

const SITE_ADMIN_DIRECT =
  'Site Admins cannot change organization content directly. Use View As to act as a user in that organization.'

function definition(id: string, organizationId = ORG_A, isDeleted = false): FieldDefinition {
  const created = createFieldDefinition({
    id,
    organizationId,
    name: `Field ${id}`,
    description: null,
    fieldType: FieldType.Text,
    isRequired: false,
    displayOrder: 10,
    options: [],
    nowUtc: NOW,
    actorUserId: null,
  })
  return { ...created, isDeleted }
}

function fieldset(id: string, name: string, organizationId = ORG_A, displayOrder = 10): Fieldset {
  return createFieldset({
    id,
    organizationId,
    name,
    description: null,
    displayOrder,
    nowUtc: NOW,
    actorUserId: null,
  })
}

function typeWith(id: string, fieldsetIds: readonly string[], archived = false): IdeaType {
  const base = createIdeaType({
    id,
    organizationId: ORG_A,
    name: `Type ${id}`,
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  const attached = setIdeaTypeFieldSelection(
    base,
    [],
    NOW,
    null,
    fieldsetIds.map((fieldsetId, i) => ({ id: `${id}-${i}`, fieldsetId, displayOrder: 10 })),
  )
  return archived ? softDeleteIdeaType(attached, NOW, null) : attached
}

function harness(options: {
  currentUser: CurrentUserContext
  fieldsets?: readonly Fieldset[]
  definitions?: readonly FieldDefinition[]
  ideaTypes?: readonly IdeaType[]
}) {
  const store = new Map((options.fieldsets ?? []).map((f) => [f.id, f] as const))
  const definitions = options.definitions ?? []
  const ideaTypes = options.ideaTypes ?? []
  const unitOfWork = countingUnitOfWork()
  const audit = recordingAudit()

  const fieldsets: FieldsetRepository = {
    async add(f) {
      store.set(f.id, f)
    },
    async save(f) {
      store.set(f.id, f)
    },
    async delete(id) {
      store.delete(id)
    },
    async getById(id) {
      return store.get(id) ?? null
    },
    async listByOrganization(organizationId) {
      return [...store.values()].filter((f) => f.organizationId === organizationId)
    },
    async getManyByIds(ids) {
      return ids.flatMap((id) => store.get(id) ?? [])
    },
    async existsByName(organizationId, name, excludeId) {
      const wanted = name.trim().toLowerCase()
      return [...store.values()].some(
        (f) =>
          f.organizationId === organizationId &&
          f.id !== excludeId &&
          f.name.toLowerCase() === wanted,
      )
    },
    async getUsage(ids) {
      const usage = new Map<string, FieldsetUsage>()
      for (const id of ids) {
        const using = ideaTypes.filter((t) => t.fieldsets.some((l) => l.fieldsetId === id))
        usage.set(id, { total: using.length, active: using.filter((t) => !t.isDeleted).length })
      }
      return usage
    },
  }
  const fieldDefinitions = {
    async listByOrganization(organizationId: string, includeDeleted: boolean) {
      return definitions.filter(
        (d) => d.organizationId === organizationId && (includeDeleted || !d.isDeleted),
      )
    },
  } as unknown as FieldDefinitionRepository

  const service = new FieldsetService(
    fieldsets,
    fieldDefinitions,
    { existsById: async (id) => id === ORG_A || id === ORG_B },
    unitOfWork,
    audit,
    options.currentUser,
    fixedClock(),
  )
  return { service, store, unitOfWork, audit }
}

const SAVE = { name: 'Launch kit', description: null, displayOrder: null }

function failuresOf(error: unknown): Readonly<Record<string, readonly string[]>> {
  if (error instanceof ValidationError) {
    return error.failures
  }
  throw error
}

describe('FieldsetService reads', () => {
  it.each([
    ['Org Admin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['Read Only', readOnly(ORG_A)],
  ])('lets a %s of the organization list and get its fieldsets', async (_label, currentUser) => {
    const { service } = harness({ currentUser, fieldsets: [fieldset('f1', 'Alpha')] })

    await expect(service.list(ORG_A)).resolves.toHaveLength(1)
    await expect(service.getById(ORG_A, 'f1')).resolves.toMatchObject({ fieldsetId: 'f1' })
  })

  it('lets a Site Admin read any organization', async () => {
    const { service } = harness({ currentUser: siteAdmin(), fieldsets: [fieldset('f1', 'Alpha')] })

    await expect(service.list(ORG_A)).resolves.toHaveLength(1)
  })

  it('answers 404 to a member naming another organization, for list and get', async () => {
    const { service } = harness({
      currentUser: member(ORG_B),
      fieldsets: [fieldset('f1', 'Alpha')],
    })

    await expect(service.list(ORG_A)).rejects.toThrow(NotFoundError)
    await expect(service.getById(ORG_A, 'f1')).rejects.toThrow(NotFoundError)
  })

  it('answers 401 to an anonymous caller', async () => {
    const { service } = harness({ currentUser: anonymous })

    await expect(service.list(ORG_A)).rejects.toThrow(UnauthorizedError)
  })

  it('answers 404 for a fieldset that belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f9', 'Theirs', ORG_B)],
    })

    await expect(service.getById(ORG_A, 'f9')).rejects.toThrow('Fieldset not found.')
  })

  it('lists by name ignoring case and shows each member with its active flag and the active-type count', async () => {
    const withMembers = {
      ...fieldset('f2', 'beta'),
      fields: [
        { id: 'm1', fieldsetId: 'f2', fieldDefinitionId: 'd2', displayOrder: 20 },
        { id: 'm2', fieldsetId: 'f2', fieldDefinitionId: 'd1', displayOrder: 10 },
      ],
    }
    const { service } = harness({
      currentUser: member(ORG_A),
      fieldsets: [withMembers, fieldset('f1', 'Alpha'), fieldset('f3', 'Gamma')],
      definitions: [definition('d1'), definition('d2', ORG_A, true)],
      ideaTypes: [typeWith('t1', ['f2']), typeWith('t2', ['f2'], true)],
    })

    const listed = await service.list(ORG_A)

    expect(listed.map((f) => f.name)).toEqual(['Alpha', 'beta', 'Gamma'])
    expect(listed[1]?.usedByIdeaTypeCount).toBe(1)
    expect(listed[1]?.fields.map((f) => [f.fieldDefinitionId, f.isActive])).toEqual([
      ['d1', true],
      ['d2', false],
    ])
  })
})

describe('FieldsetService write authorization', () => {
  const writes: readonly [string, (s: FieldsetService) => Promise<unknown>][] = [
    ['create', (s) => s.create(ORG_A, SAVE)],
    ['update', (s) => s.update(ORG_A, 'f1', SAVE)],
    ['setFields', (s) => s.setFields(ORG_A, 'f1', { fieldDefinitionIds: [] })],
    ['delete', (s) => s.delete(ORG_A, 'f1')],
  ]

  it.each(writes)('refuses a User and a Read Only member on %s with 403', async (_n, run) => {
    for (const currentUser of [member(ORG_A), readOnly(ORG_A)]) {
      const { service, unitOfWork } = harness({ currentUser, fieldsets: [fieldset('f1', 'A')] })

      const error = await run(service).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(ForbiddenError)
      expect((error as Error).message).toBe(
        'You are not allowed to manage fieldsets in this organization.',
      )
      expect(unitOfWork.saves).toBe(0)
    }
  })

  it.each(writes)('refuses a Site Admin acting directly on %s with 403', async (_n, run) => {
    const { service, unitOfWork } = harness({
      currentUser: siteAdmin(),
      fieldsets: [fieldset('f1', 'A')],
    })

    const error = await run(service).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ForbiddenError)
    expect((error as Error).message).toBe(SITE_ADMIN_DIRECT)
    expect(unitOfWork.saves).toBe(0)
  })

  it.each(writes)(
    'answers 404 to an Org Admin naming another organization on %s',
    async (_n, run) => {
      const { service } = harness({
        currentUser: orgAdmin(ORG_B),
        fieldsets: [fieldset('f1', 'A')],
      })

      await expect(run(service)).rejects.toThrow('Organization not found.')
    },
  )

  it('lets a Site Admin acting through View As as an Org Admin write', async () => {
    const { service } = harness({
      currentUser: impersonating({
        targetUserId: 'u1',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })

    await expect(service.create(ORG_A, SAVE)).resolves.toMatchObject({ name: 'Launch kit' })
  })
})

describe('FieldsetService create and update', () => {
  it('creates an empty fieldset placed last, audits it and commits once', async () => {
    const { service, unitOfWork, audit } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A', ORG_A, 30), fieldset('f2', 'B', ORG_A, 10)],
    })

    const created = await service.create(ORG_A, { ...SAVE, name: '  Launch kit  ' })

    expect(created).toMatchObject({
      name: 'Launch kit',
      displayOrder: 40,
      usedByIdeaTypeCount: 0,
      fields: [],
    })
    expect(unitOfWork.saves).toBe(1)
    expect(audit.events.map((e) => e.eventType)).toEqual(['FieldsetCreated'])
  })

  it('gives the first fieldset display order 10 and honours an explicit one', async () => {
    const first = await harness({ currentUser: orgAdmin(ORG_A) }).service.create(ORG_A, SAVE)
    const explicit = await harness({ currentUser: orgAdmin(ORG_A) }).service.create(ORG_A, {
      ...SAVE,
      displayOrder: 0,
    })

    expect(first.displayOrder).toBe(10)
    expect(explicit.displayOrder).toBe(0)
  })

  it('refuses a duplicate name case-insensitively with the name-keyed message', async () => {
    const { service, unitOfWork } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'Launch Kit')],
    })

    const error = await service.create(ORG_A, { ...SAVE, name: 'launch KIT' }).catch((e) => e)

    expect(failuresOf(error)).toEqual({
      name: ["A fieldset named 'launch KIT' already exists in this organization."],
    })
    expect(unitOfWork.saves).toBe(0)
  })

  it('allows the same name in another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f9', 'Launch kit', ORG_B)],
    })

    await expect(service.create(ORG_A, SAVE)).resolves.toMatchObject({ name: 'Launch kit' })
  })

  it('lets an update keep its own name but refuses another fieldset’s', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'Alpha'), fieldset('f2', 'Beta')],
    })

    await expect(service.update(ORG_A, 'f1', { ...SAVE, name: 'ALPHA' })).resolves.toMatchObject({
      name: 'ALPHA',
    })
    await expect(service.update(ORG_A, 'f1', { ...SAVE, name: 'beta' })).rejects.toThrow(
      ValidationError,
    )
  })

  it('keeps the stored display order when an update omits it', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'Alpha', ORG_A, 70)],
    })

    await expect(service.update(ORG_A, 'f1', SAVE)).resolves.toMatchObject({ displayOrder: 70 })
  })

  it('keys a blank name to the name field', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A) })

    const error = await service.create(ORG_A, { ...SAVE, name: '  ' }).catch((e) => e)

    expect(failuresOf(error)).toEqual({ name: ['Name is required.'] })
  })

  it('answers 404 when updating a fieldset of another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f9', 'Theirs', ORG_B)],
    })

    await expect(service.update(ORG_A, 'f9', SAVE)).rejects.toThrow('Fieldset not found.')
  })
})

describe('FieldsetService setFields', () => {
  const defs = [
    definition('d1'),
    definition('d2'),
    definition('d3'),
    definition('gone', ORG_A, true),
  ]

  it('replaces the members, numbering them 10, 20, 30 in the listed order', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: defs,
    })

    const result = await service.setFields(ORG_A, 'f1', { fieldDefinitionIds: ['d3', 'd1', 'd2'] })

    expect(result.fields.map((f) => [f.fieldDefinitionId, f.displayOrder])).toEqual([
      ['d3', 10],
      ['d1', 20],
      ['d2', 30],
    ])
    expect(store.get('f1')?.fields).toHaveLength(3)
  })

  it('keeps the row id of a member that is reordered and drops one left out', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: defs,
    })
    await service.setFields(ORG_A, 'f1', { fieldDefinitionIds: ['d1', 'd2'] })
    const d1Row = store.get('f1')?.fields.find((f) => f.fieldDefinitionId === 'd1')?.id

    await service.setFields(ORG_A, 'f1', { fieldDefinitionIds: ['d3', 'd1'] })

    const after = store.get('f1')?.fields ?? []
    expect(after.map((f) => f.fieldDefinitionId)).toEqual(['d3', 'd1'])
    expect(after.find((f) => f.fieldDefinitionId === 'd1')?.id).toBe(d1Row)
  })

  it('empties the fieldset with an empty list', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: defs,
    })
    await service.setFields(ORG_A, 'f1', { fieldDefinitionIds: ['d1'] })

    await expect(service.setFields(ORG_A, 'f1', { fieldDefinitionIds: [] })).resolves.toMatchObject(
      {
        fields: [],
      },
    )
  })

  it('refuses a repeated id with the contract detail', async () => {
    const { service, unitOfWork } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: defs,
    })

    const error = await service
      .setFields(ORG_A, 'f1', { fieldDefinitionIds: ['d1', 'd1'] })
      .catch((e) => e)

    expect(failuresOf(error)).toEqual({
      fieldDefinitionIds: ['A field may appear at most once in a fieldset.'],
    })
    expect(unitOfWork.saves).toBe(0)
  })

  it.each([
    ['an archived field', 'gone'],
    ['an unknown field', 'nope'],
  ])('refuses %s', async (_label, id) => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: defs,
    })

    const error = await service.setFields(ORG_A, 'f1', { fieldDefinitionIds: [id] }).catch((e) => e)

    expect(failuresOf(error)).toEqual({
      fieldDefinitionIds: [`'${id}' is not an active custom field in this organization.`],
    })
  })

  it('refuses a field that belongs to another organization', async () => {
    const { service } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      definitions: [definition('theirs', ORG_B)],
    })

    await expect(
      service.setFields(ORG_A, 'f1', { fieldDefinitionIds: ['theirs'] }),
    ).rejects.toThrow(ValidationError)
  })

  it('answers 404 for an unknown fieldset', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_A), definitions: defs })

    await expect(service.setFields(ORG_A, 'zzz', { fieldDefinitionIds: [] })).rejects.toThrow(
      'Fieldset not found.',
    )
  })
})

describe('FieldsetService delete', () => {
  it('answers 409 naming the count while an active idea type has it attached', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      ideaTypes: [typeWith('t1', ['f1'])],
    })

    await expect(service.delete(ORG_A, 'f1')).rejects.toThrow(ConflictError)
    await expect(service.delete(ORG_A, 'f1')).rejects.toThrow(
      'This fieldset is used by 1 idea type(s). Remove it from them first.',
    )
    expect(store.has('f1')).toBe(true)
  })

  it('counts archived idea types toward the block', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A')],
      ideaTypes: [typeWith('t1', ['f1'], true), typeWith('t2', ['f1'], true)],
    })

    await expect(service.delete(ORG_A, 'f1')).rejects.toThrow('used by 2 idea type(s)')
    expect(store.has('f1')).toBe(true)
  })

  it('deletes a detached fieldset, audits it and leaves others alone', async () => {
    const { service, store, audit, unitOfWork } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f1', 'A'), fieldset('f2', 'B')],
      ideaTypes: [typeWith('t1', ['f2'])],
    })

    await service.delete(ORG_A, 'f1')

    expect([...store.keys()]).toEqual(['f2'])
    expect(unitOfWork.saves).toBe(1)
    expect(audit.events.map((e) => e.eventType)).toEqual(['FieldsetDeleted'])
  })

  it('answers 404 for a fieldset of another organization', async () => {
    const { service, store } = harness({
      currentUser: orgAdmin(ORG_A),
      fieldsets: [fieldset('f9', 'Theirs', ORG_B)],
    })

    await expect(service.delete(ORG_A, 'f9')).rejects.toThrow('Fieldset not found.')
    expect(store.has('f9')).toBe(true)
  })
})
