import { IdeaTypeFieldMode } from '../enums/index.js'
import type { FieldDefinition } from '../fields/index.js'
import type { EffectiveField } from './effective-field.js'
import type { IdeaType } from './idea-type.js'

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
 */
export function resolveEffectiveFields(
  ideaType: IdeaType,
  activeOrgFieldDefinitions: readonly FieldDefinition[],
): readonly EffectiveField[] {
  const activeById = new Map(
    activeOrgFieldDefinitions
      .filter((definition) => !definition.isDeleted)
      .map((definition) => [definition.id, definition] as const),
  )

  if (ideaType.fieldMode === IdeaTypeFieldMode.AllActiveFields) {
    return [...activeById.values()]
      .sort((a, b) => a.displayOrder - b.displayOrder || compareIgnoreCase(a.name, b.name))
      .map((field) => ({ field, required: field.isRequired }))
  }

  return ideaType.fields
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
    .map(({ link, field }) => ({ field, required: link.isRequired }))
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
