// Validates and normalizes User-Defined Field values submitted for an idea against the fields
// resolved for its idea type (SPEC/20-feature-idea-type-fields.md "Value scoping"). Mirrors the
// .NET `FieldValueValidator.Validate` (there `internal` - exported here because Wave C's
// `IdeaFieldValuesPort` adapter, which composes this with `resolveEffectiveFields`, lives in
// packages/infrastructure, which may depend on packages/application per the layer table).
//
// Each resolved field carries its effective required-ness (per-type for a curated type, global
// otherwise). Returns the serialized values to persist, or throws the kernel's `ValidationError`
// with per-field messages. The returned set is authoritative only TOGETHER WITH the caller's
// reconcile scope (the same `effectiveFields`' ids): a field with an empty/absent value produces
// no entry here at all, and it is the merged Ideas partition's `Idea.replaceFieldValues` -
// clearing any in-scope field this function omitted - that actually clears it. This is the
// field-value contract settled with Wave C: `FieldValueInput.value` is always a non-empty string
// (never null), so "clear" is expressed by omission, exactly matching the .NET `Validate`, whose
// `continue` on a blank value adds nothing to the result list.

import { FieldType } from '@collega/domain/enums'
import type { FieldDefinition, FieldValueInput } from '@collega/domain/fields'
import { FIELD_VALUE_MAX_LENGTH } from '@collega/domain/fields'
import type { EffectiveField } from '@collega/domain/idea-fields'
import { ValidationError } from '../common/index.js'

const TEXT_MAX_LENGTH = 2000
const URL_MAX_LENGTH = 2048
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A raw User-Defined Field value submitted with an idea create/update payload. Structurally the
 * same shape as the merged Ideas partition's own `IdeaFieldValueWrite` (`packages/application/src/
 * ideas/models.ts`) - not imported from there, matching the field-value contract note above. */
export type FieldValueWrite = {
  readonly fieldDefinitionId: string
  readonly value: string | null
}

export function validateFieldValues(
  effectiveFields: readonly EffectiveField[],
  submitted: readonly FieldValueWrite[] | null | undefined,
  knownFieldNames?: ReadonlyMap<string, string>,
): readonly FieldValueInput[] {
  const resolvedById = new Map(effectiveFields.map((f) => [f.field.id, f] as const))
  const errors: Record<string, string[]> = {}
  const addError = (key: string, message: string): void => {
    const existing = errors[key]
    if (existing) {
      existing.push(message)
    } else {
      errors[key] = [message]
    }
  }

  // Last submission wins if a field id is repeated.
  const submittedById = new Map<string, string | null>()
  for (const value of submitted ?? []) {
    if (!value.fieldDefinitionId) {
      continue
    }
    submittedById.set(value.fieldDefinitionId, value.value)
  }

  // A submitted value for a field outside this type's resolved set is rejected (value scoping).
  for (const id of submittedById.keys()) {
    if (!resolvedById.has(id)) {
      const name = knownFieldNames?.get(id)
      addError(
        'fieldValues',
        name !== undefined
          ? `"${name}" is not a field for this idea type.`
          : `'${id}' is not an active custom field for this organization.`,
      )
    }
  }

  const result: FieldValueInput[] = []
  for (const effective of effectiveFields) {
    const definition = effective.field
    const raw = submittedById.get(definition.id)
    const trimmed = raw?.trim()

    if (!trimmed) {
      if (effective.required) {
        addError(definition.name, `${definition.name} is required.`)
      }
      continue
    }

    const normalization = normalizeFieldValue(definition, trimmed)
    if (!normalization.ok) {
      addError(definition.name, normalization.error)
      continue
    }

    const normalized = normalization.value
    // A value that normalizes to empty (e.g. a MultiSelect made up only of separators) counts as
    // no value: it must still satisfy a required field, and is otherwise cleared (no row).
    if (normalized.length === 0) {
      if (effective.required) {
        addError(definition.name, `${definition.name} is required.`)
      }
      continue
    }

    // Guard the persisted length so an oversized value (e.g. a large MultiSelect) surfaces as a
    // 400 rather than an unbounded write reaching the repository.
    if (normalized.length > FIELD_VALUE_MAX_LENGTH) {
      addError(
        definition.name,
        `${definition.name} must be ${FIELD_VALUE_MAX_LENGTH} characters or fewer.`,
      )
      continue
    }

    result.push({ fieldDefinitionId: definition.id, value: normalized })
  }

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('One or more fields are invalid.', errors)
  }

  return result
}

type NormalizationResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string }

function normalizeFieldValue(definition: FieldDefinition, value: string): NormalizationResult {
  switch (definition.fieldType) {
    case FieldType.Text:
      if (value.length > TEXT_MAX_LENGTH) {
        return {
          ok: false,
          error: `${definition.name} must be ${TEXT_MAX_LENGTH} characters or fewer.`,
        }
      }
      return { ok: true, value }

    case FieldType.Url:
      if (value.length > URL_MAX_LENGTH || !isHttpUrl(value)) {
        return { ok: false, error: `${definition.name} must be a valid http or https URL.` }
      }
      return { ok: true, value }

    case FieldType.Number: {
      // Deliberately strict: a sign and a single decimal point only. Group separators are
      // rejected so "1,5" is not silently coerced under invariant parsing (mirrors the .NET
      // NumberStyles.AllowLeadingSign | AllowDecimalPoint).
      const normalized = parseStrictDecimal(value)
      if (normalized === null) {
        return { ok: false, error: `${definition.name} must be a valid number.` }
      }
      return { ok: true, value: normalized }
    }

    case FieldType.Date:
      if (!isValidIsoDate(value)) {
        return { ok: false, error: `${definition.name} must be a valid date (YYYY-MM-DD).` }
      }
      return { ok: true, value }

    case FieldType.Boolean:
      if (value.toLowerCase() === 'true') {
        return { ok: true, value: 'true' }
      }
      if (value.toLowerCase() === 'false') {
        return { ok: true, value: 'false' }
      }
      return { ok: false, error: `${definition.name} must be true or false.` }

    case FieldType.Dropdown: {
      const optionId = findOptionId(definition, value)
      if (optionId === null) {
        return { ok: false, error: `${definition.name} must be one of the field's options.` }
      }
      return { ok: true, value: optionId }
    }

    case FieldType.MultiSelect:
      return normalizeMultiSelect(definition, value)

    default:
      return { ok: false, error: `${definition.name} has an unsupported field type.` }
  }
}

function normalizeMultiSelect(definition: FieldDefinition, value: string): NormalizationResult {
  const segments = value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const seen = new Set<string>()
  const ids: string[] = []
  for (const segment of segments) {
    const optionId = findOptionId(definition, segment)
    if (optionId === null) {
      return { ok: false, error: `${definition.name} must contain only the field's options.` }
    }
    if (seen.has(optionId)) {
      return { ok: false, error: `${definition.name} must not repeat an option.` }
    }
    seen.add(optionId)
    ids.push(optionId)
  }

  return { ok: true, value: ids.join(',') }
}

/** Matches `raw` against `definition`'s options by id (case-insensitively), returning the
 * canonical (lower-cased) id, or null if `raw` is not a GUID or names no option. */
function findOptionId(definition: FieldDefinition, raw: string): string | null {
  if (!GUID_PATTERN.test(raw)) {
    return null
  }
  const normalized = raw.toLowerCase()
  return definition.options.some((option) => option.id.toLowerCase() === normalized)
    ? normalized
    : null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Parses a plain decimal literal (optional leading sign, digits, optional single decimal point)
 * and re-renders it the way .NET's `decimal.ToString(CultureInfo.InvariantCulture)` would after
 * `decimal.TryParse` with no arithmetic in between: leading zeros in the integer part and a `+`
 * sign are dropped, but the fractional digit count (the decimal's "scale") is preserved exactly
 * as submitted. Returns null when `value` is not a valid decimal literal.
 */
function parseStrictDecimal(value: string): string | null {
  const match = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(value)
  if (!match) {
    return null
  }
  const [, sign, rawIntPart, fracPart] = match
  if ((rawIntPart ?? '').length === 0 && fracPart === undefined) {
    return null
  }

  const intPart = (rawIntPart ?? '').replace(/^0+(?=\d)/, '') || '0'
  const isZero = intPart === '0' && (fracPart === undefined || /^0*$/.test(fracPart))
  const negative = sign === '-' && !isZero

  return `${negative ? '-' : ''}${intPart}${fracPart !== undefined ? `.${fracPart}` : ''}`
}

function isValidIsoDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [rawYear, rawMonth, rawDay] = value.split('-')
  const year = Number(rawYear)
  const month = Number(rawMonth)
  const day = Number(rawDay)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}
