/**
 * Custom fields, fieldsets and their attachment to idea types, as scenario data. The `fields`
 * module turns this into rows; this file has no imports so `scenario.ts` and the vertical files can
 * share it without a cycle.
 */

export type DemoFieldType =
  | 'Text'
  | 'Number'
  | 'Date'
  | 'Boolean'
  | 'Dropdown'
  | 'MultiSelect'
  | 'Url'

export type DemoField = {
  readonly name: string
  readonly description?: string
  readonly type: DemoFieldType
  /** Labels, in display order. Dropdown and MultiSelect only. */
  readonly options?: readonly string[]
}

export type DemoFieldset = {
  readonly name: string
  readonly description: string
  /** Field names, in member order. */
  readonly fields: readonly string[]
}

export type DemoTypeFields = {
  /** One of the organization's idea type names. Its field mode becomes Curated. */
  readonly ideaType: string
  readonly fieldsets: readonly string[]
  readonly fields: readonly { readonly name: string; readonly required: boolean }[]
}

export type DemoFieldValues = {
  /** Index into the first board's ideas; the idea's type must offer every field named here. */
  readonly ideaIndex: number
  /** Option fields take labels (a MultiSelect an array of them); the seed resolves them to ids. */
  readonly values: Readonly<Record<string, string | readonly string[]>>
}

export type DemoFieldsScenario = {
  readonly fields: readonly DemoField[]
  readonly fieldsets: readonly DemoFieldset[]
  readonly typeFields: readonly DemoTypeFields[]
  readonly fieldValues: readonly DemoFieldValues[]
}

/** The Dropdown every organization shares. */
export const EFFORT_FIELD: DemoField = {
  name: 'Effort',
  description: 'T-shirt size of the work.',
  type: 'Dropdown',
  options: ['XS', 'S', 'M', 'L', 'XL'],
}
