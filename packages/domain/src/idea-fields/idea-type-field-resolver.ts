import { IdeaTypeFieldMode } from '../enums/index.js'
import type { FieldDefinition } from '../fields/index.js'
import type { Fieldset } from '../fieldsets/index.js'
import type { EffectiveField } from './effective-field.js'
import type { IdeaType } from './idea-type.js'

const DIRECT_SOURCE = { kind: 'field' } as const

/**
 * The single source of truth for which User-Defined Fields an idea of a given type resolves to,
 * and whether each is required (SPEC/20-feature-idea-type-fields.md "Effective-field
 * resolution"). Consumed by the idea form, the value validator (`validateFieldValues`), and the
 * detail projection so all three agree - this is the densest logic in the .NET Domain layer
 * (`IdeaTypeFieldResolver`), ported as a single pure function rather than a static class since
 * there is no state to hang a class off.
 *
 * Resolves even when `ideaType` itself is soft-deleted - archival of the type does not change an
 * existing idea's schema.
 *
 * @param ideaType The idea's type (with its `fields` links loaded).
 * @param activeOrgFieldDefinitions The organization's active (non-soft-deleted) field
 * definitions. A soft-deleted definition never appears in either branch below, even if a
 * `Curated` link still references it - the filter runs here too as a defence against a caller
 * that passed archived definitions in.
 * @param fieldsetsById The organization's fieldsets (members loaded), keyed by id. Only consulted
 * for a `Curated` type, which lists its direct fields first and then each attached fieldset in
 * order; a field already listed is not repeated (first wins), and a fieldset-supplied field uses
 * the field's own required flag. Omitting it resolves exactly as before fieldsets existed.
 */
export function resolveEffectiveFields(
  ideaType: IdeaType,
  activeOrgFieldDefinitions: readonly FieldDefinition[],
  fieldsetsById: ReadonlyMap<string, Fieldset> = new Map(),
): readonly EffectiveField[] {
  const activeById = new Map(
    activeOrgFieldDefinitions
      .filter((definition) => !definition.isDeleted)
      .map((definition) => [definition.id, definition] as const),
  )

  if (ideaType.fieldMode === IdeaTypeFieldMode.AllActiveFields) {
    return [...activeById.values()]
      .sort((a, b) => a.displayOrder - b.displayOrder || compareIgnoreCase(a.name, b.name))
      .map((field) => ({ field, required: field.isRequired, source: DIRECT_SOURCE }))
  }

  const direct: EffectiveField[] = ideaType.fields
    .flatMap((link) => {
      const field = activeById.get(link.fieldDefinitionId)
      // A link naming an archived (or otherwise no-longer-active) definition is dropped here
      // rather than surfaced with a placeholder - `flatMap` returning `[]` filters it out without
      // a non-null assertion downstream.
      return field ? [{ link, field }] : []
    })
    .sort(
      (a, b) =>
        a.link.displayOrder - b.link.displayOrder || compareIgnoreCase(a.field.name, b.field.name),
    )
    .map(({ link, field }) => ({ field, required: link.isRequired, source: DIRECT_SOURCE }))

  const listed = new Set(direct.map((effective) => effective.field.id))
  const attached = ideaType.fieldsets
    .flatMap((link) => {
      const fieldset = fieldsetsById.get(link.fieldsetId)
      return fieldset ? [{ link, fieldset }] : []
    })
    .sort(
      (a, b) =>
        a.link.displayOrder - b.link.displayOrder ||
        compareIgnoreCase(a.fieldset.name, b.fieldset.name),
    )

  const fromFieldsets: EffectiveField[] = []
  for (const { fieldset } of attached) {
    const members = fieldset.fields
      .flatMap((member) => {
        const field = activeById.get(member.fieldDefinitionId)
        return field ? [{ member, field }] : []
      })
      .sort(
        (a, b) =>
          a.member.displayOrder - b.member.displayOrder ||
          compareIgnoreCase(a.field.name, b.field.name),
      )
    for (const { field } of members) {
      if (listed.has(field.id)) {
        continue
      }
      listed.add(field.id)
      fromFieldsets.push({
        field,
        required: field.isRequired,
        source: { kind: 'fieldset', fieldsetId: fieldset.id, fieldsetName: fieldset.name },
      })
    }
  }

  return [...direct, ...fromFieldsets]
}


function compareIgnoreCase(a: string, b: string): number {
  const left = a.toLowerCase()
  const right = b.toLowerCase()
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}
