// IdeaTypeService.setFieldSelection with fieldsets (SPEC/contracts/idea-type-fields.md): the mode
// follows the selection, ids are checked against the organization, and the listed order becomes the
// attachment order. Also pins how validateFieldValues treats fieldset-sourced effective fields,
// which is the rule IdeaService create/update relies on (the Prisma adapter composes the two).

import { FieldType, IdeaTypeFieldMode } from '@collega/domain/enums'
import { createFieldDefinition, type FieldDefinition } from '@collega/domain/fields'
import { createFieldset, type Fieldset, setFieldsetFields } from '@collega/domain/fieldsets'
import {
  createIdeaType,
  type IdeaType,
  resolveEffectiveFields,
  setIdeaTypeFieldSelection,
} from '@collega/domain/idea-fields'
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/common/index.js'
import { validateFieldValues } from '../../src/fields/field-value-validator.js'
import type { FieldDefinitionRepository } from '../../src/fields/ports.js'
import type { FieldsetRepository } from '../../src/fieldsets/ports.js'
import { IdeaTypeService } from '../../src/idea-fields/idea-type-service.js'
import type { IdeaTypeRepository } from '../../src/idea-fields/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

function definition(
  id: string,
  over: { required?: boolean; organizationId?: string; type?: FieldType } = {},
): FieldDefinition {
  return createFieldDefinition({
    id,
    organizationId: over.organizationId ?? ORG_A,
    name: `Field ${id}`,
    description: null,
    fieldType: over.type ?? FieldType.Text,
    isRequired: over.required ?? false,
    displayOrder: 10,
    options: [],
    nowUtc: NOW,
    actorUserId: null,
  })
}

function fieldset(id: string, organizationId = ORG_A, members: readonly string[] = []): Fieldset {
  const created = createFieldset({
    id,
    organizationId,
    name: `Set ${id}`,
    description: null,
    displayOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  return setFieldsetFields(
    created,
    members.map((fieldDefinitionId, i) => ({
      id: `${id}-${i}`,
      fieldDefinitionId,
      displayOrder: (i + 1) * 10,
    })),
    NOW,
    null,
  )
}

function harness(options: {
  fieldsets?: readonly Fieldset[]
  definitions?: readonly FieldDefinition[]
}) {
  let current: IdeaType = createIdeaType({
    id: 't1',
    organizationId: ORG_A,
    name: 'Type',
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  const saved: IdeaType[] = []
  const ideaTypes = {
    async getById(id: string) {
      return id === current.id ? current : null
    },
    async save(t: IdeaType) {
      current = t
      saved.push(t)
    },
  } as unknown as IdeaTypeRepository
  const definitions = options.definitions ?? []
  const fieldDefinitions = {
    async listByOrganization(organizationId: string, includeDeleted: boolean) {
      return definitions.filter(
        (d) => d.organizationId === organizationId && (includeDeleted || !d.isDeleted),
      )
    },
  } as unknown as FieldDefinitionRepository
  const sets = options.fieldsets ?? []
  const fieldsets = {
    async getManyByIds(ids: readonly string[]) {
      return sets.filter((f) => ids.includes(f.id))
    },
  } as unknown as FieldsetRepository

  const service = new IdeaTypeService(
    ideaTypes,
    fieldDefinitions,
    fieldsets,
    { existsById: async () => true },
    countingUnitOfWork(),
    recordingAudit(),
    orgAdmin(ORG_A),
    fixedClock(),
  )
  return { service, saved, current: () => current }
}

const field = (fieldDefinitionId: string, displayOrder = 10, isRequired = false) => ({
  fieldDefinitionId,
  displayOrder,
  isRequired,
})

function failuresOf(error: unknown): Readonly<Record<string, readonly string[]>> {
  if (error instanceof ValidationError) {
    return error.failures
  }
  throw error
}

describe('IdeaTypeService.setFieldSelection mode derivation', () => {
  const base = { definitions: [definition('d1')], fieldsets: [fieldset('f1')] }

  it('becomes Curated for direct fields alone', async () => {
    const { service, current } = harness(base)

    await service.setFieldSelection(ORG_A, 't1', [field('d1')])

    expect(current().fieldMode).toBe(IdeaTypeFieldMode.Curated)
  })

  it('becomes Curated for fieldsets alone', async () => {
    const { service, current } = harness(base)

    await service.setFieldSelection(ORG_A, 't1', [], ['f1'])

    expect(current().fieldMode).toBe(IdeaTypeFieldMode.Curated)
    expect(current().fieldsets.map((l) => l.fieldsetId)).toEqual(['f1'])
  })

  it('returns to AllActiveFields and drops both lists when both are empty', async () => {
    const { service, current } = harness(base)
    await service.setFieldSelection(ORG_A, 't1', [field('d1')], ['f1'])

    await service.setFieldSelection(ORG_A, 't1', [], [])

    expect(current()).toMatchObject({
      fieldMode: IdeaTypeFieldMode.AllActiveFields,
      fields: [],
      fieldsets: [],
    })
  })

  it('treats an omitted fieldsetIds as none', async () => {
    const { service, current } = harness(base)
    await service.setFieldSelection(ORG_A, 't1', [], ['f1'])

    await service.setFieldSelection(ORG_A, 't1', [field('d1')])

    expect(current().fieldsets).toEqual([])
  })

  it('numbers attached fieldsets 10, 20, 30 in the listed order', async () => {
    const { service, current } = harness({
      fieldsets: [fieldset('f1'), fieldset('f2'), fieldset('f3')],
    })

    await service.setFieldSelection(ORG_A, 't1', [], ['f3', 'f1', 'f2'])

    expect(current().fieldsets.map((l) => [l.fieldsetId, l.displayOrder])).toEqual([
      ['f3', 10],
      ['f1', 20],
      ['f2', 30],
    ])
  })
})

describe('IdeaTypeService.setFieldSelection fieldset validation', () => {
  it('refuses a fieldset from another organization, keyed on fieldsetIds, and saves nothing', async () => {
    const { service, saved } = harness({ fieldsets: [fieldset('theirs', ORG_B)] })

    const error = await service.setFieldSelection(ORG_A, 't1', [], ['theirs']).catch((e) => e)

    expect(failuresOf(error)).toEqual({
      fieldsetIds: ["'theirs' is not a fieldset in this organization."],
    })
    expect(saved).toHaveLength(0)
  })

  it('refuses an unknown fieldset id', async () => {
    const { service, saved } = harness({})

    await expect(service.setFieldSelection(ORG_A, 't1', [], ['nope'])).rejects.toThrow(
      ValidationError,
    )
    expect(saved).toHaveLength(0)
  })

  it('refuses a repeated fieldset id', async () => {
    const { service, saved } = harness({ fieldsets: [fieldset('f1')] })

    const error = await service.setFieldSelection(ORG_A, 't1', [], ['f1', 'f1']).catch((e) => e)

    expect(Object.keys(failuresOf(error))).toEqual(['fieldsetIds'])
    expect(saved).toHaveLength(0)
  })

  it('does not let a valid fieldset hide an invalid direct field', async () => {
    const { service } = harness({ fieldsets: [fieldset('f1')] })

    const error = await service
      .setFieldSelection(ORG_A, 't1', [field('missing')], ['f1'])
      .catch((e) => e)

    expect(Object.keys(failuresOf(error))).toEqual(['fields'])
  })
})

describe('validateFieldValues against fieldset-sourced effective fields', () => {
  const required = definition('req', { required: true })
  const optional = definition('opt')
  const outside = definition('out')
  const set = fieldset('f1', ORG_A, ['req', 'opt'])
  const type = setIdeaTypeFieldSelection(
    createIdeaType({
      id: 't1',
      organizationId: ORG_A,
      name: 'T',
      sortOrder: 1,
      nowUtc: NOW,
      actorUserId: null,
    }),
    [],
    NOW,
    null,
    [{ id: 'l1', fieldsetId: 'f1', displayOrder: 10 }],
  )
  const effective = resolveEffectiveFields(
    type,
    [required, optional, outside],
    new Map([[set.id, set]]),
  )

  it('accepts a value for a field the fieldset supplies', () => {
    expect(
      validateFieldValues(effective, [
        { fieldDefinitionId: 'req', value: 'x' },
        { fieldDefinitionId: 'opt', value: 'y' },
      ]),
    ).toEqual([
      { fieldDefinitionId: 'req', value: 'x' },
      { fieldDefinitionId: 'opt', value: 'y' },
    ])
  })

  it('rejects a value for a field outside the effective set, keyed on fieldValues', () => {
    const error = (() => {
      try {
        validateFieldValues(effective, [
          { fieldDefinitionId: 'req', value: 'x' },
          { fieldDefinitionId: 'out', value: 'z' },
        ])
      } catch (e) {
        return e
      }
      return null
    })()

    expect(failuresOf(error)).toEqual({
      fieldValues: ["'out' is not an active custom field for this organization."],
    })
  })

  it('enforces the global required flag of a fieldset-sourced field', () => {
    const error = (() => {
      try {
        validateFieldValues(effective, [{ fieldDefinitionId: 'opt', value: 'y' }])
      } catch (e) {
        return e
      }
      return null
    })()

    expect(failuresOf(error)).toEqual({ 'Field req': ['Field req is required.'] })
  })

  it('does not require an optional fieldset-sourced field left blank', () => {
    expect(validateFieldValues(effective, [{ fieldDefinitionId: 'req', value: 'x' }])).toEqual([
      { fieldDefinitionId: 'req', value: 'x' },
    ])
  })
})
