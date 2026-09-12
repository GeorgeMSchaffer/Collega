// The three per-organization option catalogs - Idea Types, Business Impacts, User-Defined Fields -
// plus tag autocomplete (SPEC/20-feature-idea-type-fields.md, SPEC/20-feature-user-defined-fields.md,
// SPEC/20-feature-ideas-and-engagement.md "Tags").
//
// These four services repeat the same read/admin scope pattern independently rather than sharing
// it, which is exactly why each needs its own coverage: a divergence between four hand-written
// copies is invisible until something tests all four.

import {
  type BusinessImpact,
  createBusinessImpact,
  softDeleteBusinessImpact,
} from '@collega/domain/business-impacts'
import { FieldType, Role } from '@collega/domain/enums'
import {
  createFieldDefinition,
  type FieldDefinition,
  softDeleteFieldDefinition,
} from '@collega/domain/fields'
import { createIdeaType, type IdeaType, softDeleteIdeaType } from '@collega/domain/idea-fields'
import type { Tag } from '@collega/domain/tags'
import { describe, expect, it } from 'vitest'
import { BusinessImpactService } from '../../src/business-impacts/business-impact-service.js'
import type {
  BusinessImpactRepository,
  OrganizationExistenceLookup,
} from '../../src/business-impacts/ports.js'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import { FieldDefinitionService } from '../../src/fields/field-definition-service.js'
import type { FieldDefinitionRepository } from '../../src/fields/ports.js'
import { IdeaTypeService } from '../../src/idea-fields/idea-type-service.js'
import type { IdeaTypeRepository } from '../../src/idea-fields/ports.js'
import type { TagRepository } from '../../src/tags/ports.js'
import { TagService } from '../../src/tags/tag.service.js'
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

const ORG_LOOKUP: OrganizationExistenceLookup = {
  async existsById(id) {
    return id === ORG_A || id === ORG_B
  },
}

// Idea Types ------------------------------------------------------------------------------------

function ideaType(id: string, organizationId = ORG_A, name = `Type ${id}`): IdeaType {
  return createIdeaType({
    id,
    organizationId,
    name,
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function ideaTypeHarness(options: {
  currentUser: CurrentUserContext
  ideaTypes?: readonly IdeaType[]
  fieldDefinitions?: readonly FieldDefinition[]
}) {
  const all = [...(options.ideaTypes ?? [ideaType('t1'), ideaType('t2')])]
  const fields = options.fieldDefinitions ?? []
  const added: IdeaType[] = []
  const saved: IdeaType[] = []

  const ideaTypes: IdeaTypeRepository = {
    async add(t) {
      added.push(t)
    },
    async addMany() {},
    async save(t) {
      saved.push(t)
    },
    async getById(id) {
      return all.find((t) => t.id === id) ?? null
    },
    async listByOrganization(organizationId, includeDeleted) {
      return all.filter(
        (t) => t.organizationId === organizationId && (includeDeleted || !t.isDeleted),
      )
    },
    async countActiveByOrganization(organizationId) {
      return all.filter((t) => t.organizationId === organizationId && !t.isDeleted).length
    },
  }

  // IdeaTypeService only ever reads the active field list off this port.
  const fieldDefinitions = {
    async listByOrganization(organizationId: string, includeDeleted: boolean) {
      return fields.filter(
        (f) => f.organizationId === organizationId && (includeDeleted || !f.isDeleted),
      )
    },
  } as unknown as FieldDefinitionRepository

  return {
    service: new IdeaTypeService(
      ideaTypes,
      fieldDefinitions,
      ORG_LOOKUP,
      countingUnitOfWork(),
      recordingAudit(),
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
  }
}

describe('IdeaTypeService scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('lets %s read their own catalog', async (_label, currentUser) => {
    const { service } = ideaTypeHarness({ currentUser })

    await expect(service.list(ORG_A, false)).resolves.toHaveLength(2)
  })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s catalog', async (_label, currentUser) => {
    const { service } = ideaTypeHarness({ currentUser })

    await expect(service.list(ORG_B, false)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses a direct Site Admin every mutation (rule 25)', async () => {
    const { service, added, saved } = ideaTypeHarness({ currentUser: siteAdmin() })

    await expect(service.create(ORG_A, { name: 'X', sortOrder: null })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.update('t1', { name: 'X', sortOrder: null })).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.delete('t1')).rejects.toThrow(ForbiddenError)
    await expect(service.setAppearance(ORG_A, 't1', '#ABCDEF', null)).rejects.toThrow(
      ForbiddenError,
    )
    await expect(service.setFieldSelection(ORG_A, 't1', [])).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('lets that Site Admin create through View As', async () => {
    const { service, added } = ideaTypeHarness({
      currentUser: impersonating({
        targetUserId: 'target-admin',
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
    })

    await service.create(ORG_A, { name: 'Fresh Type', sortOrder: null })

    expect(added).toHaveLength(1)
  })

  it('refuses an Org Admin managing another organization’s option', async () => {
    const { service, saved } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_B),
      ideaTypes: [ideaType('t1')],
    })

    await expect(service.update('t1', { name: 'X', sortOrder: null })).rejects.toThrow(
      NotFoundError,
    )
    expect(saved).toHaveLength(0)
  })

  it('refuses a field selection naming a field from another organization', async () => {
    const foreignField = createFieldDefinition({
      id: 'field-b',
      organizationId: ORG_B,
      name: 'Beta Field',
      description: null,
      fieldType: FieldType.Text,
      isRequired: false,
      displayOrder: 0,
      options: [],
      nowUtc: NOW,
      actorUserId: 'seed',
    })
    const { service, saved } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_A),
      fieldDefinitions: [foreignField],
    })

    await expect(
      service.setFieldSelection(ORG_A, 't1', [
        { fieldDefinitionId: 'field-b', displayOrder: 0, isRequired: false },
      ]),
    ).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('refuses a field selection that repeats a field', async () => {
    const field = createFieldDefinition({
      id: 'field-a',
      organizationId: ORG_A,
      name: 'Acme Field',
      description: null,
      fieldType: FieldType.Text,
      isRequired: false,
      displayOrder: 0,
      options: [],
      nowUtc: NOW,
      actorUserId: 'seed',
    })
    const { service } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_A),
      fieldDefinitions: [field],
    })

    await expect(
      service.setFieldSelection(ORG_A, 't1', [
        { fieldDefinitionId: 'field-a', displayOrder: 0, isRequired: false },
        { fieldDefinitionId: 'field-a', displayOrder: 1, isRequired: true },
      ]),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses setting a selection on a type that belongs to another organization', async () => {
    const { service } = ideaTypeHarness({
      currentUser: siteAdmin(),
      ideaTypes: [ideaType('t1', ORG_B)],
    })

    // Refused before the id mismatch is even reachable - a direct Site Admin may not mutate.
    await expect(service.setFieldSelection(ORG_A, 't1', [])).rejects.toThrow(ForbiddenError)
  })

  it('refuses a duplicate active name, case-insensitively', async () => {
    const { service } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_A),
      ideaTypes: [ideaType('t1', ORG_A, 'Improvement')],
    })

    await expect(service.create(ORG_A, { name: 'improvement', sortOrder: null })).rejects.toThrow(
      ValidationError,
    )
  })

  it('allows a name that only a SOFT-DELETED option still holds', async () => {
    const archived = softDeleteIdeaType(ideaType('t1', ORG_A, 'Improvement'), NOW, 'seed')
    const { service, added } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_A),
      ideaTypes: [archived, ideaType('t2', ORG_A, 'Other')],
    })

    await service.create(ORG_A, { name: 'Improvement', sortOrder: null })

    expect(added).toHaveLength(1)
  })

  it('refuses deleting the last active option', async () => {
    const { service, saved } = ideaTypeHarness({
      currentUser: orgAdmin(ORG_A),
      ideaTypes: [ideaType('t1')],
    })

    await expect(service.delete('t1')).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })
})

// Business Impacts --------------------------------------------------------------------------------

function businessImpact(id: string, organizationId = ORG_A, name = `Impact ${id}`): BusinessImpact {
  return createBusinessImpact({
    id,
    organizationId,
    name,
    color: '#112233',
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function businessImpactHarness(options: {
  currentUser: CurrentUserContext
  impacts?: readonly BusinessImpact[]
}) {
  const all = [...(options.impacts ?? [businessImpact('b1'), businessImpact('b2')])]
  const added: BusinessImpact[] = []
  const saved: BusinessImpact[] = []

  const impacts: BusinessImpactRepository = {
    async add(b) {
      added.push(b)
    },
    async addMany() {},
    async save(b) {
      saved.push(b)
    },
    async getById(id) {
      return all.find((b) => b.id === id) ?? null
    },
    async listByOrganization(organizationId, includeDeleted) {
      return all.filter(
        (b) => b.organizationId === organizationId && (includeDeleted || !b.isDeleted),
      )
    },
    async countActiveByOrganization(organizationId) {
      return all.filter((b) => b.organizationId === organizationId && !b.isDeleted).length
    },
  }

  return {
    service: new BusinessImpactService(
      impacts,
      ORG_LOOKUP,
      countingUnitOfWork(),
      recordingAudit(),
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
  }
}

describe('BusinessImpactService scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('lets %s read their own catalog and refuses another’s', async (_label, currentUser) => {
    const { service } = businessImpactHarness({ currentUser })

    await expect(service.list(ORG_A, false)).resolves.toHaveLength(2)
    await expect(service.list(ORG_B, false)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses a direct Site Admin every mutation (rule 25)', async () => {
    const { service, added, saved } = businessImpactHarness({ currentUser: siteAdmin() })

    await expect(
      service.create(ORG_A, { name: 'X', color: '#111111', sortOrder: null }),
    ).rejects.toThrow(ForbiddenError)
    await expect(service.delete('b1')).rejects.toThrow(ForbiddenError)

    expect(added).toHaveLength(0)
    expect(saved).toHaveLength(0)
  })

  it('refuses an Org Admin managing another organization’s option', async () => {
    const { service } = businessImpactHarness({
      currentUser: orgAdmin(ORG_B),
      impacts: [businessImpact('b1')],
    })

    await expect(
      service.update('b1', { name: 'X', color: '#111111', sortOrder: null }),
    ).rejects.toThrow(NotFoundError)
  })

  it('refuses deleting the last active option', async () => {
    const { service, saved } = businessImpactHarness({
      currentUser: orgAdmin(ORG_A),
      impacts: [businessImpact('b1')],
    })

    await expect(service.delete('b1')).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('keeps a soft-deleted option readable but out of the active list', async () => {
    const archived = softDeleteBusinessImpact(businessImpact('b1'), NOW, 'seed')
    const { service } = businessImpactHarness({
      currentUser: orgAdmin(ORG_A),
      impacts: [archived, businessImpact('b2')],
    })

    await expect(service.list(ORG_A, false)).resolves.toHaveLength(1)
    await expect(service.list(ORG_A, true)).resolves.toHaveLength(2)
  })
})

// User-Defined Fields -----------------------------------------------------------------------------

function fieldDefinition(
  id: string,
  organizationId = ORG_A,
  name = `Field ${id}`,
): FieldDefinition {
  return createFieldDefinition({
    id,
    organizationId,
    name,
    description: null,
    fieldType: FieldType.Text,
    isRequired: false,
    displayOrder: 0,
    options: [],
    nowUtc: NOW,
    actorUserId: 'seed',
  })
}

function fieldHarness(options: {
  currentUser: CurrentUserContext
  definitions?: readonly FieldDefinition[]
}) {
  const all = [...(options.definitions ?? [fieldDefinition('f1'), fieldDefinition('f2')])]
  const added: FieldDefinition[] = []
  const saved: FieldDefinition[] = []

  const fieldDefinitions: FieldDefinitionRepository = {
    async add(d) {
      added.push(d)
    },
    async save(d) {
      saved.push(d)
    },
    async getById(id) {
      return all.find((d) => d.id === id) ?? null
    },
    async listByOrganization(organizationId, includeDeleted) {
      return all.filter(
        (d) => d.organizationId === organizationId && (includeDeleted || !d.isDeleted),
      )
    },
    async listActiveByOrganization(organizationId) {
      return all.filter((d) => d.organizationId === organizationId && !d.isDeleted)
    },
    async existsActiveByName(organizationId, name, excludeId) {
      return all.some(
        (d) =>
          d.organizationId === organizationId &&
          !d.isDeleted &&
          d.id !== excludeId &&
          d.name.toLowerCase() === name.trim().toLowerCase(),
      )
    },
  }

  return {
    service: new FieldDefinitionService(
      fieldDefinitions,
      ORG_LOOKUP,
      countingUnitOfWork(),
      recordingAudit(),
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
  }
}

describe('FieldDefinitionService scope', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s field schema', async (_label, currentUser) => {
    const { service } = fieldHarness({ currentUser })

    await expect(service.list(ORG_B, false)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses reading a field by id through a mismatched organization in the route', async () => {
    const { service } = fieldHarness({
      currentUser: siteAdmin(),
      definitions: [fieldDefinition('f1', ORG_B)],
    })

    await expect(service.getById(ORG_A, 'f1')).rejects.toThrow(NotFoundError)
  })

  it('hides archived definitions from a non-admin even when asked for', async () => {
    const archived = softDeleteFieldDefinition(fieldDefinition('f1'), NOW, 'seed')
    const asMember = fieldHarness({
      currentUser: member(ORG_A),
      definitions: [archived, fieldDefinition('f2')],
    })
    const asAdmin = fieldHarness({
      currentUser: orgAdmin(ORG_A),
      definitions: [archived, fieldDefinition('f2')],
    })

    await expect(asMember.service.list(ORG_A, true)).resolves.toHaveLength(1)
    await expect(asAdmin.service.list(ORG_A, true)).resolves.toHaveLength(2)
  })

  it('refuses a direct Site Admin every mutation (rule 25)', async () => {
    const { service, added } = fieldHarness({ currentUser: siteAdmin() })

    await expect(
      service.create(ORG_A, {
        name: 'X',
        description: null,
        fieldType: FieldType.Text,
        isRequired: false,
        displayOrder: null,
        options: [],
      }),
    ).rejects.toThrow(ForbiddenError)
    await expect(service.delete(ORG_A, 'f1')).rejects.toThrow(ForbiddenError)
    expect(added).toHaveLength(0)
  })

  it('refuses an Org Admin updating a field in another organization', async () => {
    const { service, saved } = fieldHarness({
      currentUser: orgAdmin(ORG_A),
      definitions: [fieldDefinition('f1', ORG_B)],
    })

    await expect(
      service.update(ORG_B, 'f1', {
        name: 'X',
        description: null,
        fieldType: FieldType.Text,
        isRequired: false,
        displayOrder: null,
        options: [],
      }),
    ).rejects.toThrow(NotFoundError)
    expect(saved).toHaveLength(0)
  })

  it('refuses changing a field’s type after creation', async () => {
    const { service } = fieldHarness({ currentUser: orgAdmin(ORG_A) })

    await expect(
      service.update(ORG_A, 'f1', {
        name: 'Field f1',
        description: null,
        fieldType: FieldType.Number,
        isRequired: false,
        displayOrder: null,
        options: [],
      }),
    ).rejects.toThrow(ValidationError)
  })

  it('refuses a duplicate active name but allows reusing an archived one', async () => {
    const duplicate = fieldHarness({ currentUser: orgAdmin(ORG_A) })
    await expect(
      duplicate.service.create(ORG_A, {
        name: 'field f1',
        description: null,
        fieldType: FieldType.Text,
        isRequired: false,
        displayOrder: null,
        options: [],
      }),
    ).rejects.toThrow(ValidationError)

    const archived = softDeleteFieldDefinition(fieldDefinition('f1'), NOW, 'seed')
    const reuse = fieldHarness({ currentUser: orgAdmin(ORG_A), definitions: [archived] })
    await reuse.service.create(ORG_A, {
      name: 'Field f1',
      description: null,
      fieldType: FieldType.Text,
      isRequired: false,
      displayOrder: null,
      options: [],
    })
    expect(reuse.added).toHaveLength(1)
  })
})

// Tags --------------------------------------------------------------------------------------------

function tagHarness(options: { currentUser: CurrentUserContext }) {
  const calls: { organizationId: string; prefix: string; limit: number }[] = []

  const tags: TagRepository = {
    async listByIds() {
      return [] as readonly Tag[]
    },
    async getOrCreate() {
      return [] as readonly Tag[]
    },
    async searchByPrefix(organizationId, normalizedPrefix, limit) {
      calls.push({ organizationId, prefix: normalizedPrefix, limit })
      return ['backlog', 'billing']
    },
  }

  return { service: new TagService(tags, options.currentUser), calls }
}

describe('TagService', () => {
  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s another organization’s tag vocabulary', async (_label, currentUser) => {
    const { service, calls } = tagHarness({ currentUser })

    await expect(service.suggest(ORG_B, 'ba', null)).rejects.toBeInstanceOf(NotFoundError)
    expect(calls).toHaveLength(0)
  })

  it('lets a Site Admin suggest against any organization', async () => {
    const { service, calls } = tagHarness({ currentUser: siteAdmin() })

    await expect(service.suggest(ORG_B, 'ba', null)).resolves.toEqual(['backlog', 'billing'])
    expect(calls[0]?.organizationId).toBe(ORG_B)
  })

  it('returns nothing before the two-character minimum, without touching the store', async () => {
    const { service, calls } = tagHarness({ currentUser: member(ORG_A) })

    await expect(service.suggest(ORG_A, 'b', null)).resolves.toEqual([])
    await expect(service.suggest(ORG_A, '  ', null)).resolves.toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('clamps the limit to the allowed range', async () => {
    const { service, calls } = tagHarness({ currentUser: member(ORG_A) })

    await service.suggest(ORG_A, 'ba', 500)
    await service.suggest(ORG_A, 'ba', 0)
    await service.suggest(ORG_A, 'ba', null)

    expect(calls.map((c) => c.limit)).toEqual([50, 1, 10])
  })

  it('searches on the normalized prefix, not the raw input', async () => {
    const { service, calls } = tagHarness({ currentUser: member(ORG_A) })

    await service.suggest(ORG_A, '  BackLog ', null)

    expect(calls[0]?.prefix).toBe('backlog')
  })
})
