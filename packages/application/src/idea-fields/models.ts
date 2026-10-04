// Wire-facing read models and commands for Idea Type administration
// (SPEC/30-Contracts.md "Idea Field Option Contracts", "Idea-Type Field Contracts").

import type { EffectiveFieldSource } from '@collega/domain/idea-fields'

/** One field in an Idea Type's curated selection. */
export type IdeaTypeFieldItem = {
  readonly fieldDefinitionId: string
  readonly displayOrder: number
  readonly isRequired: boolean
}

/** One selectable option of a `Dropdown` or `MultiSelect` field, in display order. */
export type EffectiveFieldOptionItem = {
  readonly optionId: string
  readonly label: string
}

/** A custom field an idea of a given type shows, as `resolveEffectiveFields` decided it.
 * `isRequired` is the field's required-ness for that type, not its global flag. */
export type EffectiveFieldItem = {
  readonly fieldDefinitionId: string
  readonly name: string
  readonly fieldType: string
  readonly isRequired: boolean
  readonly options: readonly EffectiveFieldOptionItem[]
  readonly source: EffectiveFieldSource
}

/** An Idea Type as returned by the admin surface. `fieldMode` is `AllActiveFields` or `Curated`;
 * `fields` carries the curated selection (empty for an `AllActiveFields` type). `colorHex`/`icon`
 * drive the type badge. */
export type IdeaTypeItem = {
  readonly ideaTypeId: string
  readonly organizationId: string
  readonly name: string
  readonly sortOrder: number
  readonly isDeleted: boolean
  readonly colorHex: string | null
  readonly icon: string | null
  readonly fieldMode: string
  readonly fields: readonly IdeaTypeFieldItem[]
  /** Attached fieldsets, in attach order; `fieldsetIds` and `fieldsets` list the same sets. */
  readonly fieldsetIds: readonly string[]
  readonly fieldsets: readonly { readonly id: string; readonly name: string }[]
  readonly effectiveFields: readonly EffectiveFieldItem[]
}

/** One entry in a replace-the-selection request. */
export type IdeaTypeFieldSelectionInput = {
  readonly fieldDefinitionId: string
  readonly displayOrder: number
  readonly isRequired: boolean
}

export type CreateIdeaTypeCommand = {
  readonly name: string
  readonly sortOrder: number | null
}

export type UpdateIdeaTypeCommand = {
  readonly name: string
  readonly sortOrder: number | null
}
