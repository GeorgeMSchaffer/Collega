// Wire-facing read models and commands for User-Defined Field definitions
// (SPEC/20-feature-user-defined-fields.md).

/** A selectable option on a Dropdown/MultiSelect field definition. */
export type FieldOptionModel = {
  readonly optionId: string
  readonly label: string
  readonly displayOrder: number
}

/** Read model for an organization User-Defined Field definition. `fieldType` is the serialized
 * enum string (e.g. `"Text"`). */
export type FieldDefinitionModel = {
  readonly fieldDefinitionId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly fieldType: string
  readonly isRequired: boolean
  readonly displayOrder: number
  readonly isDeleted: boolean
  readonly options: readonly FieldOptionModel[]
}

/** One option in a create/update command. A non-null `optionId` targets an existing option so its
 * identity (and any idea values referencing it) survives the edit; `null` creates a new one. */
export type FieldOptionCommand = {
  readonly optionId: string | null
  readonly label: string
  readonly displayOrder: number
}

export type CreateFieldDefinitionCommand = {
  readonly name: string
  readonly description: string | null
  readonly fieldType: string
  readonly isRequired: boolean
  readonly displayOrder: number | null
  readonly options: readonly FieldOptionCommand[]
}

/** `fieldType` is immutable after creation; a differing value is rejected. */
export type UpdateFieldDefinitionCommand = CreateFieldDefinitionCommand

export type ReorderFieldDefinitionsCommand = {
  readonly orderedIds: readonly string[]
}
