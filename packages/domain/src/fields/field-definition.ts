// Organization-owned User-Defined Field schema (SPEC/20-feature-user-defined-fields.md). The
// field schema is shared across every board in the organization; admins manage definitions, all
// members fill values on ideas. `FieldType` is fixed at creation because stored idea field values
// are interpreted by it. Deletion is a soft delete (values are preserved but hidden from
// forms/filters), so existing values and audit history stay valid.
//
// Modelled as plain immutable data plus transition functions, per `packages/domain/src/common` -
// every mutation already takes an explicit `nowUtc` and actor, so a class buys nothing here.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'
import { FieldType } from '../enums/index.js'

export const FIELD_NAME_MAX_LENGTH = 100
export const FIELD_DESCRIPTION_MAX_LENGTH = 500
export const FIELD_OPTION_LABEL_MAX_LENGTH = 200

/** Persisted `idea_field_values.value` cap (mirrors the .NET `IdeaFieldValue.ValueMaxLength`).
 * Owned here because the merged Ideas partition's `Idea.fieldValues` (`@collega/domain/ideas`)
 * models a bare `{fieldDefinitionId, value}` record with no length invariant of its own - value
 * validation is entirely this feature's responsibility, run before `Idea.replaceFieldValues` ever
 * sees a value. */
export const FIELD_VALUE_MAX_LENGTH = 4000

/**
 * Raised when a caller asks this module to put a `FieldDefinition` into an invalid state. Carries
 * only a message, not a per-property field key, and that is DELIBERATE - do not "fix" it into
 * per-property keys like `IdeaDomainError`/`BoardInvariantError` use. The .NET
 * `FieldDefinitionService` bucketed every one of these under one fixed `"fieldDefinition"`
 * `ValidationAppException` key regardless of which invariant fired (its shared `AsValidation`
 * helper), and this is a verified, corpus-pinned quirk of that code, not an oversight this port
 * is simplifying away. It is also genuinely reachable, not just a defensive backstop: a blank name
 * reaches this class rather than being pre-checked, exactly as
 * `FieldDefinitionService.EnsureNameAvailableAsync` deliberately let it fall through with the
 * comment "Let the domain produce the canonical 'Name is required.' message." Changing this to
 * per-property keys would change the JSON body a client sees for every one of these validation
 * failures.
 */
export class FieldDefinitionDomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FieldDefinitionDomainError'
  }
}

export type FieldDefinitionOption = {
  readonly id: string
  readonly fieldDefinitionId: string
  readonly label: string
  readonly displayOrder: number
}

/**
 * Caller-supplied option state passed to `setFieldDefinitionOptions`. `id` is always present -
 * unlike the .NET `FieldOptionInput.Id` (nullable, with a null Id creating a new option via the
 * entity's ambient `Guid.NewGuid()`), ids are never generated in the domain here (SPEC/
 * decisions.md 2026-09-06). The Application layer generates a fresh `randomUUID()` for a "new"
 * option before calling in; an id that matches an existing option reuses it (preserving identity
 * for any idea value that references it), any other id creates a new option.
 */
export type FieldOptionInput = {
  readonly id: string
  readonly label: string
  readonly displayOrder: number
}

export type FieldDefinition = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  /** Lower-cased, trimmed form of `name`, backing the partial unique index
   * `ux_field_definitions_organization_id_normalized_name` on `(organization_id,
   * normalized_name) WHERE is_deleted = false` - a soft-deleted name may be reused, an active one
   * may not. The comparison lives in a column rather than a collation because PostgreSQL, unlike
   * SQL Server, compares case-sensitively by default. */
  readonly normalizedName: string
  readonly description: string | null
  readonly fieldType: FieldType
  readonly isRequired: boolean
  readonly displayOrder: number
  readonly isDeleted: boolean
  readonly deletedAtUtc: Date | null
  readonly deletedByUserId: string | null
  readonly options: readonly FieldDefinitionOption[]
}

/** Dropdown and MultiSelect are the only types that own selectable options. */
export function isOptionBackedFieldType(fieldType: FieldType): boolean {
  return fieldType === FieldType.Dropdown || fieldType === FieldType.MultiSelect
}

/** Trims and lower-cases, for case-insensitive comparison - mirrors `FieldDefinition.Normalize`. */
export function normalizeFieldName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function normalizeName(name: string): string {
  const trimmed = (name ?? '').trim()
  if (trimmed.length === 0) {
    throw new FieldDefinitionDomainError('Name is required.')
  }
  if (trimmed.length > FIELD_NAME_MAX_LENGTH) {
    throw new FieldDefinitionDomainError(
      `Name must be ${FIELD_NAME_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

function normalizeDescription(description: string | null): string | null {
  const trimmed = (description ?? '').trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > FIELD_DESCRIPTION_MAX_LENGTH) {
    throw new FieldDefinitionDomainError(
      `Description must be ${FIELD_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

function normalizeOptionLabel(label: string): string {
  const trimmed = (label ?? '').trim()
  if (trimmed.length === 0) {
    throw new FieldDefinitionDomainError('Option label is required.')
  }
  if (trimmed.length > FIELD_OPTION_LABEL_MAX_LENGTH) {
    throw new FieldDefinitionDomainError(
      `Option label must be ${FIELD_OPTION_LABEL_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

/**
 * Reconciles a field's options to `options`: an input `id` matching an existing option updates it
 * in place (preserving identity for idea values that reference it); any other `id` creates a new
 * option; an existing option absent from the input set is removed. Only valid for option-backed
 * types, which must retain at least one option.
 */
function reconcileOptions(
  fieldDefinitionId: string,
  fieldType: FieldType,
  options: readonly FieldOptionInput[],
): readonly FieldDefinitionOption[] {
  if (!isOptionBackedFieldType(fieldType)) {
    if (options.length > 0) {
      throw new FieldDefinitionDomainError(`A ${fieldType} field cannot have options.`)
    }
    return []
  }

  if (options.length === 0) {
    throw new FieldDefinitionDomainError(`A ${fieldType} field must have at least one option.`)
  }

  const seenLabels = new Set<string>()
  const reconciled: FieldDefinitionOption[] = []
  for (const input of options) {
    const label = normalizeOptionLabel(input.label)
    const normalizedLabel = label.toLowerCase()
    if (seenLabels.has(normalizedLabel)) {
      throw new FieldDefinitionDomainError(
        `Option labels must be unique; '${label}' is duplicated.`,
      )
    }
    seenLabels.add(normalizedLabel)

    reconciled.push({ id: input.id, fieldDefinitionId, label, displayOrder: input.displayOrder })
  }

  return reconciled
}

export type CreateFieldDefinitionProps = {
  /** Generated by the Application layer with `randomUUID()` and passed in - domain does not
   * generate ids (SPEC/decisions.md 2026-09-06). */
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly fieldType: FieldType
  readonly isRequired: boolean
  readonly displayOrder: number
  readonly options: readonly FieldOptionInput[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
}

export function createFieldDefinition(props: CreateFieldDefinitionProps): FieldDefinition {
  if (props.organizationId.trim().length === 0) {
    throw new FieldDefinitionDomainError('Organization id is required.')
  }

  const name = normalizeName(props.name)
  const description = normalizeDescription(props.description)
  const options = reconcileOptions(props.id, props.fieldType, props.options)

  return {
    id: props.id,
    organizationId: props.organizationId,
    name,
    normalizedName: normalizeFieldName(name),
    description,
    fieldType: props.fieldType,
    isRequired: props.isRequired,
    displayOrder: props.displayOrder,
    isDeleted: false,
    deletedAtUtc: null,
    deletedByUserId: null,
    options,
    ...markCreated(props.nowUtc, props.actorUserId),
  }
}

function ensureNotDeleted(definition: FieldDefinition): void {
  if (definition.isDeleted) {
    throw new FieldDefinitionDomainError('A deleted field definition cannot be modified.')
  }
}

/** Updates the editable scalar attributes. `fieldType` is immutable and not accepted here. */
export function updateFieldDefinition(
  definition: FieldDefinition,
  input: {
    readonly name: string
    readonly description: string | null
    readonly isRequired: boolean
    readonly displayOrder: number
  },
  nowUtc: Date,
  actorUserId: string | null,
): FieldDefinition {
  ensureNotDeleted(definition)
  const name = normalizeName(input.name)
  const description = normalizeDescription(input.description)

  return markUpdated(
    {
      ...definition,
      name,
      normalizedName: normalizeFieldName(name),
      description,
      isRequired: input.isRequired,
      displayOrder: input.displayOrder,
    },
    nowUtc,
    actorUserId,
  )
}

/** Sets only the display order (used by reorder), leaving all other attributes intact. */
export function setFieldDefinitionDisplayOrder(
  definition: FieldDefinition,
  displayOrder: number,
  nowUtc: Date,
  actorUserId: string | null,
): FieldDefinition {
  ensureNotDeleted(definition)
  return markUpdated({ ...definition, displayOrder }, nowUtc, actorUserId)
}

export function setFieldDefinitionOptions(
  definition: FieldDefinition,
  options: readonly FieldOptionInput[],
  nowUtc: Date,
  actorUserId: string | null,
): FieldDefinition {
  ensureNotDeleted(definition)
  const reconciled = reconcileOptions(definition.id, definition.fieldType, options)
  return markUpdated({ ...definition, options: reconciled }, nowUtc, actorUserId)
}

/** Soft-deletes (archives) the definition. Idempotent; values are preserved. */
export function softDeleteFieldDefinition(
  definition: FieldDefinition,
  nowUtc: Date,
  actorUserId: string | null,
): FieldDefinition {
  if (definition.isDeleted) {
    return definition
  }
  return markUpdated(
    { ...definition, isDeleted: true, deletedAtUtc: nowUtc, deletedByUserId: actorUserId },
    nowUtc,
    actorUserId,
  )
}

/** A single validated User-Defined Field value ready to persist, produced by
 * `validateFieldValues` (`packages/application/src/fields`). Structurally identical to the merged
 * Ideas partition's own `IdeaFieldValueInput` (`@collega/domain/ideas`) - not imported from there
 * deliberately: Ideas merged first and defined its own local shape rather than depend on a
 * not-yet-existing sibling package, and duplicating this two-field record is cheaper than adding a
 * domain-to-domain dependency between sibling features for a shape this small. */
export type FieldValueInput = {
  readonly fieldDefinitionId: string
  readonly value: string
}
