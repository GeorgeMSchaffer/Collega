// Wire-facing read models and commands for fieldsets (SPEC/contracts/fieldsets.md).

/** One member of a fieldset, joined to its field definition. `isActive` is `false` for an archived
 * definition: the membership is kept but the field is skipped wherever fields are resolved. */
export type FieldsetFieldModel = {
  readonly fieldDefinitionId: string
  readonly name: string
  readonly fieldType: string
  readonly isActive: boolean
  readonly displayOrder: number
}

export type FieldsetModel = {
  readonly fieldsetId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly displayOrder: number
  /** Idea types, archived ones excluded, that have the fieldset attached. */
  readonly usedByIdeaTypeCount: number
  readonly fields: readonly FieldsetFieldModel[]
}

/** Create and update take the same shape; membership has its own command. */
export type SaveFieldsetCommand = {
  readonly name: string
  readonly description: string | null
  readonly displayOrder: number | null
}

export type SetFieldsetFieldsCommand = {
  readonly fieldDefinitionIds: readonly string[]
}
