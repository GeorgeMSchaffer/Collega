import type { FieldDefinition } from '../fields/index.js'

/** Where an effective field came from: mapped directly (or an `AllActiveFields` type), or supplied
 * by an attached fieldset. */
export type EffectiveFieldSource =
  | { readonly kind: 'field' }
  | { readonly kind: 'fieldset'; readonly fieldsetId: string; readonly fieldsetName: string }

/**
 * A field resolved for an idea's type: the `FieldDefinition` to render plus its effective
 * required-ness for that type (SPEC/20-feature-idea-type-fields.md "Effective-field resolution").
 */
export type EffectiveField = {
  readonly field: FieldDefinition
  readonly required: boolean
  readonly source: EffectiveFieldSource
}
