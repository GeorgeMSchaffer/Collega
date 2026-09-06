// Satisfies `IdeaFieldValuesPort` (ideas/ports.ts) - "the densest logic in the .NET Domain
// layer", deliberately a single delegated port rather than re-implemented against B5's domain
// types. This adapter does not re-derive that logic: it loads the rows `resolveEffectiveFields`
// (`@collega/domain/idea-fields`) and `validateFieldValues` (`@collega/application/fields`) need,
// and calls them. Everything here is projection/formatting of already-decided data (which fields
// an idea type resolves to, whether a submitted value is well-formed) - no new policy is made in
// this file; the two functions it calls own that.
//
// Also provides `listActiveWithFieldNames`, satisfying `AiIdeaTypesPort` (ai/ports.ts) - the same
// field-resolution composition, so it lives beside it rather than being duplicated.

import type { AiIdeaTypesPort } from '@collega/application/ai'
import { ValidationError } from '@collega/application/common'
import type { FieldValueWrite } from '@collega/application/fields'
import { validateFieldValues } from '@collega/application/fields'
import type {
  IdeaFieldValueFilter,
  IdeaFieldValuesPort,
  IdeaFieldValueView,
  ImportCellTranslation,
} from '@collega/application/ideas'
import { isReservedColumn } from '@collega/application/ideas'
import { FieldType, type IdeaTypeFieldMode } from '@collega/domain/enums'
import type { FieldDefinition } from '@collega/domain/fields'
import type { EffectiveField, IdeaType } from '@collega/domain/idea-fields'
import { resolveEffectiveFields } from '@collega/domain/idea-fields'
import type { IdeaFieldValueInput } from '@collega/domain/ideas'
import type {
  field_definitions as FieldDefinitionRow,
  idea_type_fields as IdeaTypeFieldRow,
  idea_types as IdeaTypeRow,
  field_definition_options as OptionRow,
} from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'

type FieldDefinitionRowWithOptions = FieldDefinitionRow & { field_definition_options: OptionRow[] }
type IdeaTypeRowWithFields = IdeaTypeRow & { idea_type_fields: IdeaTypeFieldRow[] }

function fieldDefinitionFromRow(row: FieldDefinitionRowWithOptions): FieldDefinition {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    normalizedName: row.normalized_name,
    description: row.description,
    fieldType: row.field_type as FieldType,
    isRequired: row.is_required,
    displayOrder: row.display_order,
    isDeleted: row.is_deleted,
    deletedAtUtc: row.deleted_at_utc,
    deletedByUserId: row.deleted_by_user_id,
    options: [...row.field_definition_options]
      .sort((a, b) => a.display_order - b.display_order)
      .map((o) => ({
        id: o.id,
        fieldDefinitionId: o.field_definition_id,
        label: o.label,
        displayOrder: o.display_order,
      })),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

function ideaTypeFromRow(row: IdeaTypeRowWithFields): IdeaType {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    sortOrder: row.sort_order,
    isDeleted: row.is_deleted,
    colorHex: row.color_hex,
    icon: row.icon,
    fieldMode: row.field_mode as IdeaTypeFieldMode,
    fields: row.idea_type_fields.map((f) => ({
      id: f.id,
      ideaTypeId: f.idea_type_id,
      fieldDefinitionId: f.field_definition_id,
      displayOrder: f.display_order,
      isRequired: f.is_required,
    })),
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaIdeaFieldValuesRepository implements IdeaFieldValuesPort, AiIdeaTypesPort {
  constructor(private readonly prisma: PrismaClient) {}

  private async loadActiveFieldDefinitions(organizationId: string): Promise<FieldDefinition[]> {
    const rows = await this.prisma.field_definitions.findMany({
      where: { organization_id: organizationId, is_deleted: false },
      include: { field_definition_options: true },
    })
    return rows.map(fieldDefinitionFromRow)
  }

  /** Loads a field definition by id regardless of soft-delete state, scoped to the organization -
   * used to label archived/out-of-scope stored values, which must keep their prior name. */
  private async loadFieldDefinitionAnyState(
    organizationId: string,
    fieldDefinitionId: string,
  ): Promise<FieldDefinition | null> {
    const row = await this.prisma.field_definitions.findFirst({
      where: { id: fieldDefinitionId, organization_id: organizationId },
      include: { field_definition_options: true },
    })
    return row ? fieldDefinitionFromRow(row) : null
  }

  private async loadEffectiveFields(
    organizationId: string,
    ideaTypeId: string,
  ): Promise<readonly EffectiveField[]> {
    const [ideaTypeRow, activeDefinitions] = await Promise.all([
      this.prisma.idea_types.findFirst({
        where: { id: ideaTypeId, organization_id: organizationId },
        include: { idea_type_fields: true },
      }),
      this.loadActiveFieldDefinitions(organizationId),
    ])
    if (!ideaTypeRow) {
      return []
    }
    return resolveEffectiveFields(ideaTypeFromRow(ideaTypeRow), activeDefinitions)
  }

  private renderStoredValue(definition: FieldDefinition, value: string): string {
    if (definition.fieldType === FieldType.Boolean) {
      return value === 'true' ? 'Yes' : 'No'
    }
    if (definition.fieldType === FieldType.Dropdown) {
      return this.optionLabel(definition, value) ?? value
    }
    if (definition.fieldType === FieldType.MultiSelect) {
      return value
        .split(',')
        .map((id) => this.optionLabel(definition, id) ?? id)
        .join(', ')
    }
    return value
  }

  private optionLabel(definition: FieldDefinition, optionId: string): string | null {
    const normalized = optionId.toLowerCase()
    return definition.options.find((o) => o.id.toLowerCase() === normalized)?.label ?? null
  }

  async resolveAndValidate(input: {
    organizationId: string
    ideaTypeId: string
    submitted: readonly { fieldDefinitionId: string; value: string | null }[]
  }): Promise<readonly IdeaFieldValueInput[]> {
    const effectiveFields = await this.loadEffectiveFields(input.organizationId, input.ideaTypeId)
    return validateFieldValues(effectiveFields, input.submitted as readonly FieldValueWrite[])
  }

  async getReconcileScope(organizationId: string, ideaTypeId: string): Promise<readonly string[]> {
    const effectiveFields = await this.loadEffectiveFields(organizationId, ideaTypeId)
    return effectiveFields.map((f) => f.field.id)
  }

  async getFieldNames(
    organizationId: string,
    fieldDefinitionIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (fieldDefinitionIds.length === 0) {
      return new Map()
    }
    const rows = await this.prisma.field_definitions.findMany({
      where: {
        organization_id: organizationId,
        id: { in: [...fieldDefinitionIds] },
        is_deleted: false,
      },
      select: { id: true, name: true },
    })
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  async describeForDetail(input: {
    organizationId: string
    ideaTypeId: string
    stored: readonly { fieldDefinitionId: string; value: string }[]
  }): Promise<readonly IdeaFieldValueView[]> {
    const effectiveFields = await this.loadEffectiveFields(input.organizationId, input.ideaTypeId)
    const storedByField = new Map(input.stored.map((s) => [s.fieldDefinitionId, s.value] as const))
    const views: IdeaFieldValueView[] = []
    const seen = new Set<string>()

    for (const effective of effectiveFields) {
      seen.add(effective.field.id)
      const value = storedByField.get(effective.field.id)
      if (value === undefined) {
        continue
      }
      views.push({
        fieldDefinitionId: effective.field.id,
        fieldName: effective.field.name,
        fieldType: effective.field.fieldType,
        value: this.renderStoredValue(effective.field, value),
      })
    }

    for (const stored of input.stored) {
      if (seen.has(stored.fieldDefinitionId)) {
        continue
      }
      const definition = await this.loadFieldDefinitionAnyState(
        input.organizationId,
        stored.fieldDefinitionId,
      )
      if (!definition) {
        continue
      }
      views.push({
        fieldDefinitionId: stored.fieldDefinitionId,
        fieldName: definition.name,
        fieldType: definition.fieldType,
        value: this.renderStoredValue(definition, stored.value),
      })
    }

    return views
  }

  async translateListFilters(input: {
    organizationId: string
    raw: ReadonlyMap<string, string> | null
  }): Promise<{
    readonly filters: readonly IdeaFieldValueFilter[]
    readonly searchTextFieldIds: readonly string[]
  }> {
    const activeDefinitions = await this.loadActiveFieldDefinitions(input.organizationId)
    const byId = new Map(activeDefinitions.map((d) => [d.id, d] as const))

    const searchTextFieldIds = activeDefinitions
      .filter((d) => d.fieldType === FieldType.Text || d.fieldType === FieldType.Url)
      .map((d) => d.id)

    if (!input.raw) {
      return { filters: [], searchTextFieldIds }
    }

    const filters: IdeaFieldValueFilter[] = []
    for (const [fieldDefinitionId, rawValue] of input.raw) {
      const definition = byId.get(fieldDefinitionId)
      if (!definition) {
        continue
      }
      const filter = this.translateOneFilter(definition, rawValue)
      if (filter) {
        filters.push(filter)
      }
    }

    return { filters, searchTextFieldIds }
  }

  private translateOneFilter(
    definition: FieldDefinition,
    rawValue: string,
  ): IdeaFieldValueFilter | null {
    const trimmed = rawValue.trim()
    if (trimmed.length === 0) {
      return null
    }

    switch (definition.fieldType) {
      case FieldType.Text:
      case FieldType.Url:
        return {
          fieldDefinitionId: definition.id,
          kind: 'contains',
          value: trimmed,
          min: null,
          max: null,
        }

      case FieldType.Boolean: {
        const lowered = trimmed.toLowerCase()
        if (lowered !== 'true' && lowered !== 'false') {
          return null
        }
        return {
          fieldDefinitionId: definition.id,
          kind: 'equals',
          value: lowered,
          min: null,
          max: null,
        }
      }

      case FieldType.Dropdown:
        return {
          fieldDefinitionId: definition.id,
          kind: 'equals',
          value: trimmed.toLowerCase(),
          min: null,
          max: null,
        }

      case FieldType.MultiSelect:
        return {
          fieldDefinitionId: definition.id,
          kind: 'multiSelectContains',
          value: trimmed.toLowerCase(),
          min: null,
          max: null,
        }

      case FieldType.Number: {
        const [min, max] = this.splitRange(trimmed)
        if (min === null && max === null) {
          return null
        }
        return { fieldDefinitionId: definition.id, kind: 'numberRange', value: null, min, max }
      }

      case FieldType.Date: {
        const [min, max] = this.splitRange(trimmed)
        if (min === null && max === null) {
          return null
        }
        return { fieldDefinitionId: definition.id, kind: 'dateRange', value: null, min, max }
      }

      default:
        return null
    }
  }

  /** Splits a `<min>:<max>` range, either side omittable. Returns `[null, null]` when the input
   * has no colon at all - not a valid range expression. */
  private splitRange(value: string): readonly [string | null, string | null] {
    const colonIndex = value.indexOf(':')
    if (colonIndex === -1) {
      return [null, null]
    }
    const min = value.slice(0, colonIndex).trim()
    const max = value.slice(colonIndex + 1).trim()
    return [min.length > 0 ? min : null, max.length > 0 ? max : null]
  }

  async getExportColumns(
    organizationId: string,
  ): Promise<readonly { readonly fieldDefinitionId: string; readonly header: string }[]> {
    const activeDefinitions = await this.loadActiveFieldDefinitions(organizationId)
    return activeDefinitions
      .filter((d) => !isReservedColumn(d.name))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((d) => ({ fieldDefinitionId: d.id, header: d.name }))
  }

  async formatForExport(fieldDefinitionId: string, value: string | null): Promise<string> {
    if (value === null || value.trim().length === 0) {
      return ''
    }
    const row = await this.prisma.field_definitions.findUnique({
      where: { id: fieldDefinitionId },
      include: { field_definition_options: true },
    })
    if (!row) {
      return value
    }
    return this.renderStoredValue(fieldDefinitionFromRow(row), value)
  }

  async translateImportCell(input: {
    organizationId: string
    fieldName: string
    rawCell: string
  }): Promise<ImportCellTranslation> {
    const activeDefinitions = await this.loadActiveFieldDefinitions(input.organizationId)
    const definition = activeDefinitions.find(
      (d) => d.name.toLowerCase() === input.fieldName.trim().toLowerCase(),
    )
    if (!definition) {
      return {
        ok: false,
        error: `'${input.fieldName}' is not an active field for this organization.`,
      }
    }

    const rawCell = input.rawCell.trim()

    // Dropdown/MultiSelect columns hold LABELS in a CSV, but the validator (like storage) works
    // in option ids - translate labels to ids here before delegating normalization/required-ness
    // to the same `validateFieldValues` the create/update path uses, so both paths agree on what
    // counts as valid.
    let submittedValue = rawCell
    if (
      definition.fieldType === FieldType.Dropdown ||
      definition.fieldType === FieldType.MultiSelect
    ) {
      if (rawCell.length === 0) {
        submittedValue = ''
      } else {
        const labels =
          definition.fieldType === FieldType.MultiSelect ? rawCell.split(',') : [rawCell]
        const ids: string[] = []
        for (const rawLabel of labels) {
          const label = rawLabel.trim()
          if (label.length === 0) {
            continue
          }
          const option = definition.options.find(
            (o) => o.label.toLowerCase() === label.toLowerCase(),
          )
          if (!option) {
            return { ok: false, error: `${definition.name} must be one of the field's options.` }
          }
          ids.push(option.id)
        }
        submittedValue = ids.join(',')
      }
    }

    try {
      const result = validateFieldValues(
        [{ field: definition, required: false }],
        [
          {
            fieldDefinitionId: definition.id,
            value: submittedValue.length > 0 ? submittedValue : null,
          },
        ],
      )
      return { ok: true, stored: result[0]?.value ?? '' }
    } catch (error) {
      const message =
        error instanceof ValidationError ? Object.values(error.failures)[0]?.[0] : undefined
      return { ok: false, error: message ?? `${definition.name} is invalid.` }
    }
  }

  /** `AiIdeaTypesPort.listActiveWithFieldNames`. */
  async listActiveWithFieldNames(organizationId: string): Promise<
    readonly {
      readonly id: string
      readonly name: string
      readonly fieldNames: readonly string[]
    }[]
  > {
    const [ideaTypeRows, activeDefinitions] = await Promise.all([
      this.prisma.idea_types.findMany({
        where: { organization_id: organizationId, is_deleted: false },
        include: { idea_type_fields: true },
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
      this.loadActiveFieldDefinitions(organizationId),
    ])

    return ideaTypeRows.map((row) => {
      const ideaType = ideaTypeFromRow(row)
      const effective = resolveEffectiveFields(ideaType, activeDefinitions)
      return {
        id: ideaType.id,
        name: ideaType.name,
        fieldNames: effective.map((f) => f.field.name),
      }
    })
  }
}
