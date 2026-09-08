import type { FieldDefinition } from '../fields/index.js'

/**
 * A field resolved for an idea's type: the `FieldDefinition` to render plus its effective
 * required-ness for that type (SPEC/20-feature-idea-type-fields.md "Effective-field resolution").
 */
export type EffectiveField = {
  readonly field: FieldDefinition
  readonly required: boolean
}
