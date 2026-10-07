// resolveEffectiveFields with fieldsets (SPEC/20-feature-idea-type-fields.md "Effective-field
// resolution", SPEC/contracts/fieldsets.md): a Curated type lists its direct fields, then each
// attached fieldset; first listing wins; a fieldset-sourced field uses the field's own required flag.

import { describe, expect, it } from 'vitest'
import { FieldType, IdeaTypeFieldMode } from '../../src/enums/index.js'
import { createFieldDefinition, type FieldDefinition } from '../../src/fields/index.js'
import {
  createFieldset,
  FIELDSET_DESCRIPTION_MAX_LENGTH,
  FIELDSET_NAME_MAX_LENGTH,
  type Fieldset,
  FieldsetDomainError,
  setFieldsetFields,
  updateFieldset,
} from '../../src/fieldsets/index.js'
import {
  createIdeaType,
  type IdeaType,
  resolveEffectiveFields,
  setIdeaTypeFieldSelection,
} from '../../src/idea-fields/index.js'

const NOW = new Date('2026-10-04T12:00:00.000Z')
const ORG = 'org-1'

function field(id: string, name: string, over: { order?: number; required?: boolean } = {}) {
  return createFieldDefinition({
    id,
    organizationId: ORG,
    name,
    description: null,
    fieldType: FieldType.Text,
    isRequired: over.required ?? false,
    displayOrder: over.order ?? 10,
    options: [],
    nowUtc: NOW,
    actorUserId: null,
  })
}

function archived(definition: FieldDefinition): FieldDefinition {
  return { ...definition, isDeleted: true }
}

function fieldset(
  id: string,
  name: string,
  members: readonly (readonly [string, number])[],
): Fieldset {
  const created = createFieldset({
    id,
    organizationId: ORG,
    name,
    description: null,
    displayOrder: 10,
    nowUtc: NOW,
    actorUserId: null,
  })
  return setFieldsetFields(
    created,
    members.map(([fieldDefinitionId, displayOrder], index) => ({
      id: `${id}-m${index}`,
      fieldDefinitionId,
      displayOrder,
    })),
    NOW,
    null,
  )
}

function curated(opts: {
  direct?: readonly (readonly [string, number, boolean])[]
  sets?: readonly (readonly [string, number])[]
}): IdeaType {
  return setIdeaTypeFieldSelection(
    createIdeaType({
      id: 't1',
      organizationId: ORG,
      name: 'Type',
      sortOrder: 10,
      nowUtc: NOW,
      actorUserId: null,
    }),
    (opts.direct ?? []).map(([fieldDefinitionId, displayOrder, isRequired], i) => ({
      id: `l${i}`,
      fieldDefinitionId,
      displayOrder,
      isRequired,
    })),
    NOW,
    null,
    (opts.sets ?? []).map(([fieldsetId, displayOrder], i) => ({
      id: `s${i}`,
      fieldsetId,
      displayOrder,
    })),
  )
}

const byId = (...sets: Fieldset[]) => new Map(sets.map((s) => [s.id, s]))
const ids = (effective: ReturnType<typeof resolveEffectiveFields>) =>
  effective.map((e) => e.field.id)

describe('resolveEffectiveFields with fieldsets', () => {
  const a = field('a', 'Alpha')
  const b = field('b', 'Bravo')
  const c = field('c', 'Charlie', { required: true })
  const d = field('d', 'Delta')

  it('lists direct fields first, then fieldsets by displayOrder then name, members by displayOrder then name', () => {
    const setZ = fieldset('fz', 'Zeta', [
      ['d', 20],
      ['c', 10],
    ])
    const setY = fieldset('fy', 'Yankee', [['b', 10]])
    const setX = fieldset('fx', 'Xray', [['a', 10]])
    const type = curated({
      direct: [['d', 5, false]],
      // Yankee and Xray tie on order 20, so name breaks the tie; Zeta is order 10 and goes first.
      sets: [
        ['fy', 20],
        ['fx', 20],
        ['fz', 10],
      ],
    })
    const result = resolveEffectiveFields(type, [a, b, c, d], byId(setZ, setY, setX))
    expect(ids(result)).toEqual(['d', 'c', 'a', 'b'])
  })

  it('orders members with equal displayOrder by field name, ignoring case', () => {
    const set = fieldset('f1', 'Set', [
      ['b', 10],
      ['a', 10],
    ])
    const result = resolveEffectiveFields(curated({ sets: [['f1', 10]] }), [a, b], byId(set))
    expect(ids(result)).toEqual(['a', 'b'])
  })

  it('keeps the first listing when a field is both direct and in a fieldset, with the per-type required flag', () => {
    const set = fieldset('f1', 'Set', [
      ['c', 10],
      ['d', 20],
    ])
    const type = curated({ direct: [['c', 10, false]], sets: [['f1', 10]] })
    const result = resolveEffectiveFields(type, [c, d], byId(set))
    expect(ids(result)).toEqual(['c', 'd'])
    expect(result[0]).toMatchObject({ required: false, source: { kind: 'field' } })
  })

  it('lists a field shared by two attached fieldsets once, under the earlier fieldset', () => {
    const first = fieldset('f1', 'First', [['a', 10]])
    const second = fieldset('f2', 'Second', [
      ['a', 10],
      ['b', 20],
    ])
    const result = resolveEffectiveFields(
      curated({
        sets: [
          ['f1', 10],
          ['f2', 20],
        ],
      }),
      [a, b],
      byId(first, second),
    )
    expect(ids(result)).toEqual(['a', 'b'])
    expect(result[0]?.source).toEqual({ kind: 'fieldset', fieldsetId: 'f1', fieldsetName: 'First' })
    expect(result[1]?.source).toEqual({
      kind: 'fieldset',
      fieldsetId: 'f2',
      fieldsetName: 'Second',
    })
  })

  it('uses the field definition global required flag for fieldset-sourced fields', () => {
    const set = fieldset('f1', 'Set', [
      ['c', 10],
      ['a', 20],
    ])
    const result = resolveEffectiveFields(curated({ sets: [['f1', 10]] }), [a, c], byId(set))
    expect(result.map((e) => e.required)).toEqual([true, false])
  })

  it('tags direct fields with source field and fieldset fields with the fieldset id and name', () => {
    const set = fieldset('f1', 'Set', [['b', 10]])
    const result = resolveEffectiveFields(
      curated({ direct: [['a', 10, true]], sets: [['f1', 10]] }),
      [a, b],
      byId(set),
    )
    expect(result.map((e) => e.source)).toEqual([
      { kind: 'field' },
      { kind: 'fieldset', fieldsetId: 'f1', fieldsetName: 'Set' },
    ])
  })

  it('skips archived field definitions in both direct links and fieldset members', () => {
    const set = fieldset('f1', 'Set', [
      ['b', 10],
      ['c', 20],
    ])
    const result = resolveEffectiveFields(
      curated({ direct: [['a', 10, false]], sets: [['f1', 10]] }),
      [archived(a), archived(b), c],
      byId(set),
    )
    expect(ids(result)).toEqual(['c'])
  })

  it('resolves an empty fieldset, and an attached id with no loaded fieldset, to nothing', () => {
    const empty = fieldset('f1', 'Empty', [])
    expect(resolveEffectiveFields(curated({ sets: [['f1', 10]] }), [a], byId(empty))).toEqual([])
    expect(resolveEffectiveFields(curated({ sets: [['missing', 10]] }), [a], byId())).toEqual([])
  })

  it('resolves a Curated type that has only fieldsets', () => {
    const set = fieldset('f1', 'Set', [['a', 10]])
    const type = curated({ sets: [['f1', 10]] })
    expect(type.fieldMode).toBe(IdeaTypeFieldMode.Curated)
    expect(ids(resolveEffectiveFields(type, [a, b], byId(set)))).toEqual(['a'])
  })

  it('ignores attached fieldsets for an AllActiveFields type and tags every field as direct', () => {
    const type = createIdeaType({
      id: 't',
      organizationId: ORG,
      name: 'T',
      sortOrder: 1,
      nowUtc: NOW,
      actorUserId: null,
    })
    const set = fieldset('f1', 'Set', [['a', 10]])
    const result = resolveEffectiveFields(
      { ...type, fieldsets: [{ id: 'x', ideaTypeId: 't', fieldsetId: 'f1', displayOrder: 1 }] },
      [b, a, c],
      byId(set),
    )
    expect(ids(result)).toEqual(['a', 'b', 'c'])
    expect(result.every((e) => e.source.kind === 'field')).toBe(true)
    expect(result.map((e) => e.required)).toEqual([false, false, true])
  })

  it('treats the legacy two-argument call the same as an empty fieldset map', () => {
    const type = curated({
      direct: [
        ['b', 20, true],
        ['a', 10, false],
      ],
    })
    expect(resolveEffectiveFields(type, [a, b])).toEqual(
      resolveEffectiveFields(type, [a, b], new Map()),
    )
    expect(ids(resolveEffectiveFields(type, [a, b]))).toEqual(['a', 'b'])
  })
})

describe('fieldset validation', () => {
  const make = (over: Partial<{ name: string; description: string | null }> = {}) =>
    createFieldset({
      id: 'f',
      organizationId: ORG,
      name: over.name ?? 'Name',
      description: over.description ?? null,
      displayOrder: 10,
      nowUtc: NOW,
      actorUserId: null,
    })

  function fieldOf(action: () => unknown): string {
    try {
      action()
    } catch (error) {
      expect(error).toBeInstanceOf(FieldsetDomainError)
      return (error as FieldsetDomainError).field
    }
    throw new Error('expected a FieldsetDomainError')
  }

  it('trims the name and stores a lower-cased normalized name', () => {
    const created = make({ name: '  Launch Kit  ' })
    expect(created.name).toBe('Launch Kit')
    expect(created.normalizedName).toBe('launch kit')
  })

  it('refuses a blank name and one over the limit, accepting exactly the limit', () => {
    expect(fieldOf(() => make({ name: '   ' }))).toBe('name')
    expect(fieldOf(() => make({ name: 'x'.repeat(FIELDSET_NAME_MAX_LENGTH + 1) }))).toBe('name')
    expect(make({ name: 'x'.repeat(FIELDSET_NAME_MAX_LENGTH) }).name).toHaveLength(
      FIELDSET_NAME_MAX_LENGTH,
    )
  })

  it('stores a blank description as null and refuses one over the limit', () => {
    expect(make({ description: '   ' }).description).toBeNull()
    expect(
      fieldOf(() => make({ description: 'x'.repeat(FIELDSET_DESCRIPTION_MAX_LENGTH + 1) })),
    ).toBe('description')
  })

  it('re-normalizes the name on update and leaves the members alone', () => {
    const set = fieldset('f1', 'Old', [['a', 10]])
    const next = updateFieldset(
      set,
      { name: ' New ', description: null, displayOrder: 30 },
      NOW,
      null,
    )
    expect(next).toMatchObject({ name: 'New', normalizedName: 'new', displayOrder: 30 })
    expect(next.fields).toEqual(set.fields)
  })

  it('refuses a repeated member and replaces members wholesale otherwise', () => {
    expect(
      fieldOf(() =>
        setFieldsetFields(
          make(),
          [
            { id: '1', fieldDefinitionId: 'a', displayOrder: 10 },
            { id: '2', fieldDefinitionId: 'a', displayOrder: 20 },
          ],
          NOW,
          null,
        ),
      ),
    ).toBe('fieldDefinitionIds')
    const replaced = setFieldsetFields(
      fieldset('f1', 'S', [['a', 10]]),
      [{ id: '9', fieldDefinitionId: 'b', displayOrder: 10 }],
      NOW,
      null,
    )
    expect(replaced.fields.map((m) => m.fieldDefinitionId)).toEqual(['b'])
  })
})

describe('setIdeaTypeFieldSelection with fieldsets', () => {
  const base = createIdeaType({
    id: 't',
    organizationId: ORG,
    name: 'T',
    sortOrder: 1,
    nowUtc: NOW,
    actorUserId: null,
  })

  it('becomes Curated for fieldsets alone and returns to AllActiveFields when both are empty', () => {
    const withSet = setIdeaTypeFieldSelection(base, [], NOW, null, [
      { id: '1', fieldsetId: 'f', displayOrder: 10 },
    ])
    expect(withSet.fieldMode).toBe(IdeaTypeFieldMode.Curated)
    const cleared = setIdeaTypeFieldSelection(withSet, [], NOW, null, [])
    expect(cleared.fieldMode).toBe(IdeaTypeFieldMode.AllActiveFields)
    expect(cleared.fieldsets).toEqual([])
  })

  it('refuses a repeated fieldset id', () => {
    expect(() =>
      setIdeaTypeFieldSelection(base, [], NOW, null, [
        { id: '1', fieldsetId: 'f', displayOrder: 10 },
        { id: '2', fieldsetId: 'f', displayOrder: 20 },
      ]),
    ).toThrow(/more than once/)
  })
})
