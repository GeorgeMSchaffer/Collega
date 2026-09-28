// An edit may keep an option the idea already stores after the field stops offering it, but may
// not add one (SPEC/20-feature-user-defined-fields.md).

import { FieldType } from '@collega/domain/enums'
import { createFieldDefinition } from '@collega/domain/fields'
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/common/index.js'
import { validateFieldValues } from '../../src/fields/field-value-validator.js'

const FIELD_ID = '00000000-0000-4000-8000-000000000001'
const WELD = '00000000-0000-4000-8000-00000000000a'
const PAINT = '00000000-0000-4000-8000-00000000000b'
const REMOVED = '00000000-0000-4000-8000-00000000000c'
const UNKNOWN = '00000000-0000-4000-8000-00000000000d'

function effective(fieldType: FieldType) {
  const field = createFieldDefinition({
    id: FIELD_ID,
    organizationId: 'org-1',
    name: 'Areas',
    description: null,
    fieldType,
    isRequired: false,
    displayOrder: 0,
    options: [
      { id: WELD, label: 'Welding, cutting', displayOrder: 0 },
      { id: PAINT, label: 'Paint', displayOrder: 1 },
    ],
    nowUtc: new Date('2026-09-27T00:00:00Z'),
    actorUserId: null,
  })
  return [{ field, required: false }]
}

const submit = (value: string) => [{ fieldDefinitionId: FIELD_ID, value }]
const stored = (value: string) => [{ fieldDefinitionId: FIELD_ID, value }]

describe('validateFieldValues with an option the field no longer offers', () => {
  it('accepts an unchanged MultiSelect save that still holds it', () => {
    const value = `${WELD},${REMOVED}`
    expect(
      validateFieldValues(
        effective(FieldType.MultiSelect),
        submit(value),
        undefined,
        stored(value),
      ),
    ).toEqual([{ fieldDefinitionId: FIELD_ID, value }])
  })

  it('accepts an unchanged Dropdown save that still holds it', () => {
    expect(
      validateFieldValues(
        effective(FieldType.Dropdown),
        submit(REMOVED),
        undefined,
        stored(REMOVED),
      ),
    ).toEqual([{ fieldDefinitionId: FIELD_ID, value: REMOVED }])
  })

  it('refuses adding an id the idea does not already store', () => {
    expect(() =>
      validateFieldValues(
        effective(FieldType.MultiSelect),
        submit(`${WELD},${UNKNOWN}`),
        undefined,
        stored(WELD),
      ),
    ).toThrow(ValidationError)
  })

  it('refuses a removed id on create, where nothing is stored', () => {
    expect(() => validateFieldValues(effective(FieldType.Dropdown), submit(REMOVED))).toThrow(
      ValidationError,
    )
  })

  it('drops it once unticked', () => {
    expect(
      validateFieldValues(
        effective(FieldType.MultiSelect),
        submit(`${WELD},${PAINT}`),
        undefined,
        stored(`${WELD},${REMOVED}`),
      ),
    ).toEqual([{ fieldDefinitionId: FIELD_ID, value: `${WELD},${PAINT}` }])
  })
})
