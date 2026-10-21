// What IdeaTypeService hands back about fieldsets (SPEC/contracts/idea-type-fields.md): the
// additive `fieldsetIds` and `fieldsets` keys in attach order, and `effectiveFields` resolved
// through the attached fieldsets with a `source` on every item. The idea-type picker and the idea
// form both read this shape, so a list that resolved without fieldsets would hide their fields.

import { FieldType } from '@collega/domain/enums'
import { createFieldDefinition, type FieldDefinition } from '@collega/domain/fields'
import { createFieldset, type Fieldset, setFieldsetFields } from '@collega/domain/fieldsets'
import {
  createIdeaType,
  type IdeaType,
  setIdeaTypeFieldSelection,
} from '@collega/domain/idea-fields'
import { describe, expect, it } from 'vitest'
import type { FieldDefinitionRepository } from '../../src/fields/ports.js'
import type { FieldsetRepository } from '../../src/fieldsets/ports.js'
import { IdeaTypeService } from '../../src/idea-fields/idea-type-service.js'
import type { IdeaTypeRepository } from '../../src/idea-fields/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  member,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  recordingAudit,
} from '../support/fixtures.js'

function definition(id: string, name: string, required = false): FieldDefinition {
  return createFieldDefinition({
    id,
    organizationId: ORG_A,
    name,
    description: null,
    fieldType: FieldType.Text,
    isRequired: required,
    displayOrder: 10,
    options: [],
    nowUtc: NOW,
    actorUserId: null,
  })
}

function fieldset(
  id: string,
  name: string,
  members: readonly string[],
  organizationId = ORG_A,
): Fieldset {
  return setFieldsetFields(
    createFieldset({
      id,
      organizationId,
      name,
      description: null,
      displayOrder: 10,
      nowUtc: NOW,
      actorUserId: null,
    }),
    members.map((fieldDefinitionId, i) => ({
      id: `${id}-m${i}`,
      fieldDefinitionId,
      displayOrder: (i + 1) * 10,
    })),
    NOW,
    null,
  )
}

/** A type with the given direct fields and fieldset attachments (`[fieldsetId, displayOrder]`). */
function curatedType(
  id: string,
  direct: readonly string[],
  attached: readonly (readonly [string, number])[],
): IdeaType {
  const created = createIdeaType({
    id,
    organizationId: ORG_A,
    name: `Type ${id}`,
    sortOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  return setIdeaTypeFieldSelection(
    created,
    direct.map((fieldDefinitionId, i) => ({
      id: `${id}-f${i}`,
      fieldDefinitionId,
      displayOrder: (i + 1) * 10,
      isRequired: false,
    })),
    NOW,
    null,
    attached.map(([fieldsetId, displayOrder]) => ({
      id: `${id}-s${fieldsetId}`,
      fieldsetId,
      displayOrder,
    })),
  )
}

function harness(options: {
  types: readonly IdeaType[]
  definitions: readonly FieldDefinition[]
  fieldsets: readonly Fieldset[]
  as?: ReturnType<typeof member>
}) {
  const types = new Map(options.types.map((t) => [t.id, t] as const))
  const ideaTypes = {
    async listByOrganization(organizationId: string) {
      return [...types.values()].filter((t) => t.organizationId === organizationId)
    },
    async getById(id: string) {
      return types.get(id) ?? null
    },
    async save(t: IdeaType) {
      types.set(t.id, t)
    },
  } as unknown as IdeaTypeRepository
  const fieldDefinitions = {
    async listByOrganization(organizationId: string, includeDeleted: boolean) {
      return options.definitions.filter(
        (d) => d.organizationId === organizationId && (includeDeleted || !d.isDeleted),
      )
    },
  } as unknown as FieldDefinitionRepository
  const fieldsets = {
    async listByOrganization(organizationId: string) {
      return options.fieldsets.filter((f) => f.organizationId === organizationId)
    },
    async getManyByIds(ids: readonly string[]) {
      return options.fieldsets.filter((f) => ids.includes(f.id))
    },
  } as unknown as FieldsetRepository

  return new IdeaTypeService(
    ideaTypes,
    fieldDefinitions,
    fieldsets,
    { existsById: async () => true },
    countingUnitOfWork(),
    recordingAudit(),
    options.as ?? orgAdmin(ORG_A),
    fixedClock(),
  )
}

const definitions = [
  definition('d-impact', 'Impact'),
  definition('d-effort', 'Effort', true),
  definition('d-owner', 'Owner'),
  definition('d-due', 'Due'),
]
const sizing = fieldset('s-sizing', 'Sizing', ['d-effort', 'd-impact'])
const delivery = fieldset('s-delivery', 'Delivery', ['d-due'])

describe('IdeaTypeService read model with fieldsets', () => {
  it('lists attached fieldsets by attach order, not by storage order, in both keys', async () => {
    const service = harness({
      types: [
        curatedType(
          't1',
          [],
          [
            ['s-delivery', 20],
            ['s-sizing', 10],
          ],
        ),
      ],
      definitions,
      fieldsets: [delivery, sizing],
      as: member(ORG_A),
    })

    const [item] = await service.list(ORG_A, false)

    expect(item?.fieldsetIds).toEqual(['s-sizing', 's-delivery'])
    expect(item?.fieldsets).toEqual([
      { id: 's-sizing', name: 'Sizing' },
      { id: 's-delivery', name: 'Delivery' },
    ])
  })

  it('resolves effective fields through the fieldsets, direct first, each tagged with its source', async () => {
    const service = harness({
      types: [curatedType('t1', ['d-owner', 'd-impact'], [['s-sizing', 10]])],
      definitions,
      fieldsets: [sizing],
    })

    const [item] = await service.list(ORG_A, false)

    expect(item?.effectiveFields.map((f) => [f.name, f.isRequired, f.source])).toEqual([
      ['Owner', false, { kind: 'field' }],
      // Direct as well as in Sizing: listed once, as direct, with the per-type flag.
      ['Impact', false, { kind: 'field' }],
      ['Effort', true, { kind: 'fieldset', fieldsetId: 's-sizing', fieldsetName: 'Sizing' }],
    ])
  })

  it('drops an attachment whose fieldset the organization no longer has from every key', async () => {
    const service = harness({
      types: [
        curatedType(
          't1',
          [],
          [
            ['s-sizing', 10],
            ['s-gone', 20],
          ],
        ),
      ],
      definitions,
      // A fieldset with the same id in another organization must not be picked up either.
      fieldsets: [sizing, fieldset('s-gone', 'Elsewhere', ['d-due'], ORG_B)],
    })

    const [item] = await service.list(ORG_A, false)

    expect(item?.fieldsetIds).toEqual(['s-sizing'])
    expect(item?.fieldsets).toEqual([{ id: 's-sizing', name: 'Sizing' }])
    expect(item?.effectiveFields.map((f) => f.name)).toEqual(['Effort', 'Impact'])
  })

  it('answers an update with the fieldsets and their fields still resolved', async () => {
    const service = harness({
      types: [curatedType('t1', [], [['s-delivery', 10]])],
      definitions,
      fieldsets: [delivery],
    })

    const item = await service.update('t1', { name: 'Renamed', sortOrder: null })

    expect(item.fieldsetIds).toEqual(['s-delivery'])
    expect(item.effectiveFields.map((f) => [f.name, f.source.kind])).toEqual([['Due', 'fieldset']])
  })
})
