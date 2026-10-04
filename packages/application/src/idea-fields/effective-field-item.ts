import { isOptionBackedFieldType } from '@collega/domain/fields'
import type { EffectiveField } from '@collega/domain/idea-fields'
import type { EffectiveFieldItem } from './models.js'

/** Projects one `resolveEffectiveFields` result onto the wire shape the idea form reads. */
export function toEffectiveFieldItem(effective: EffectiveField): EffectiveFieldItem {
  const { field } = effective
  return {
    fieldDefinitionId: field.id,
    name: field.name,
    fieldType: field.fieldType,
    isRequired: effective.required,
    options: isOptionBackedFieldType(field.fieldType)
      ? [...field.options]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((o) => ({ optionId: o.id, label: o.label }))
      : [],
    source: effective.source,
  }
}
