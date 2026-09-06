// Wire-facing read models and commands for Idea Type administration
// (SPEC/30-Contracts.md "Idea Field Option Contracts", "Idea-Type Field Contracts").

/** One field in an Idea Type's curated selection. */
export type IdeaTypeFieldItem = {
  readonly fieldDefinitionId: string
  readonly displayOrder: number
  readonly isRequired: boolean
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
