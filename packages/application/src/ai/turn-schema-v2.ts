import { FieldType, Priority } from '@collega/domain/enums'
import {
  DESCRIPTION_MAX_LENGTH,
  IMPACT_RATIONALE_MAX_LENGTH,
  MAX_PROPOSED_SOLUTIONS,
  MAX_TAGS,
  MIN_PROPOSED_SOLUTIONS,
  PROBLEM_MAX_LENGTH,
  PROPOSED_SOLUTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@collega/domain/ideas'
import type { IdeaAssistContext, IdeaAssistFieldDefinition } from './models.js'
import { businessImpactIdsOf, ideaTypeIdsOf } from './models.js'

/** Brainstorm bounds (SPEC/20-feature-ai-idea-assist-v2.md "Conversation" item 4). */
export const MAX_SOLUTION_SUGGESTIONS = 3
export const MAX_RATIONALE_SUGGESTIONS = 3

/**
 * Bounds the model-facing schema deliberately does NOT carry. The schema keeps to the keywords
 * v1 has proven against the provider (type, enum, anyOf, maxLength, required,
 * additionalProperties); everything else is enforced by the server's re-validation (slice 307)
 * from these constants and `isValidCustomFieldValue`.
 */
export const TURN_V2_BOUNDS = {
  proposedSolutions: { min: MIN_PROPOSED_SOLUTIONS, max: MAX_PROPOSED_SOLUTIONS },
  tagNames: { max: MAX_TAGS },
  solutionSuggestions: { max: MAX_SOLUTION_SUGGESTIONS },
  rationaleSuggestions: { max: MAX_RATIONALE_SUGGESTIONS },
} as const

const TEXT_FIELD_MAX_LENGTH = 2000
const URL_FIELD_MAX_LENGTH = 2048
const CUSTOM_FIELD_KEY_PREFIX = 'fieldValues.'

/** The lockable draft keys; a custom field is `fieldValues.<fieldDefinitionId>`. */
export const DRAFT_FIELD_KEYS = [
  'title',
  'problem',
  'proposedSolutions',
  'impactRationale',
  'businessImpactId',
  'ideaTypeId',
  'priority',
  'tagNames',
  'description',
] as const

export type DraftFieldKey = (typeof DRAFT_FIELD_KEYS)[number]

/** The interview fields, in order (v2 spec "Conversation" item 3). Title comes after the custom fields. */
const INTERVIEW_FIELD_KEYS = [
  'problem',
  'proposedSolutions',
  'impactRationale',
  'businessImpactId',
  'ideaTypeId',
] as const

/** Optional fields that may also be asked about, after title. */
const OPTIONAL_FIELD_KEYS = ['priority', 'tagNames', 'description'] as const

export const NEXT_STEP_DONE = 'done'

export function customFieldKey(fieldDefinitionId: string): string {
  return `${CUSTOM_FIELD_KEY_PREFIX}${fieldDefinitionId}`
}

export type IdeaAssistTurnSchemaInput = {
  /** Names the person owns: draft keys, and `fieldValues.<fieldDefinitionId>`. Unknown names are inert. */
  readonly lockedFields: readonly string[]
  /** The custom fields visible for the draft's Idea Type; empty when it has none or none is chosen. */
  readonly customFields: readonly IdeaAssistFieldDefinition[]
}

type JsonSchema = Record<string, unknown>

/**
 * The v2 turn's response JSON Schema, built PER REQUEST (SPEC/20-feature-ai-idea-assist.md rules
 * 15-18, extended by SPEC/contracts/ai-assist.md "v2 turn contract"). Pure: no I/O, no clock.
 *
 * `changes` offers only the fields the person has not locked, so a locked field is not merely
 * stripped afterwards (the service still does that) - the model cannot express it. Ids are closed
 * enums of the organization's active options, tags an enum of its vocabulary, and each custom
 * field is a typed entry pinned to its own definition id. `additionalProperties` is false
 * everywhere, so `nextQuestion` and the bounded suggestion strings are the only free text.
 */
export function buildIdeaAssistTurnSchemaV2(
  context: IdeaAssistContext,
  input: IdeaAssistTurnSchemaInput,
): JsonSchema {
  const locked = new Set(input.lockedFields)
  const isOpen = (key: string): boolean => !locked.has(key)
  // A Dropdown or MultiSelect with no options cannot express a value, so it is not offered.
  const customFields = offeredCustomFields(input)

  const changes: Record<string, JsonSchema> = {}
  const add = (key: DraftFieldKey, schema: JsonSchema | null): void => {
    if (schema && isOpen(key)) {
      changes[key] = schema
    }
  }

  add('title', { type: 'string', maxLength: TITLE_MAX_LENGTH })
  add('problem', { type: 'string', maxLength: PROBLEM_MAX_LENGTH })
  add('proposedSolutions', {
    type: 'array',
    items: { type: 'string', maxLength: PROPOSED_SOLUTION_MAX_LENGTH },
  })
  add('impactRationale', { type: 'string', maxLength: IMPACT_RATIONALE_MAX_LENGTH })
  add('businessImpactId', idEnum(businessImpactIdsOf(context)))
  add('ideaTypeId', idEnum(ideaTypeIdsOf(context)))
  add('priority', { type: 'string', enum: Object.values(Priority) })
  add(
    'tagNames',
    context.tags.length === 0
      ? null
      : {
          type: 'array',
          items: { type: 'string', enum: [...context.tags] },
        },
  )
  add('description', { type: 'string', maxLength: DESCRIPTION_MAX_LENGTH })

  if (customFields.length > 0) {
    changes.fieldValues = {
      type: 'array',
      items: { anyOf: customFields.map(customFieldEntry) },
    }
  }

  const properties: Record<string, JsonSchema> = {
    inScope: {
      type: 'boolean',
      description:
        "True when the user's latest message could plausibly become an idea of one of this " +
        "organization's active idea types, within any scope statement given. False otherwise.",
    },
    nextQuestion: {
      type: 'string',
      description:
        'One short reply that moves the idea forward and asks about the next field. This is the ' +
        'only free text you may write apart from the bounded suggestion strings.',
    },
    nextStep: {
      type: 'string',
      enum: nextStepValues(context, locked, customFields),
      description: `The field nextQuestion asks about, or ${NEXT_STEP_DONE} when nothing more is needed.`,
    },
    changes: {
      type: 'object',
      description: 'Only the fields this turn sets. Omit any field you are not setting.',
      properties: changes,
      additionalProperties: false,
    },
  }

  const suggestions = suggestionsSchema(isOpen)
  if (suggestions) {
    properties.suggestions = suggestions
  }

  return {
    type: 'object',
    properties,
    // suggestions stays optional: most turns offer none.
    required: ['inScope', 'nextQuestion', 'nextStep', 'changes'],
    additionalProperties: false,
  }
}

/**
 * The custom fields the model may fill this turn: unlocked, and (for Dropdown and MultiSelect)
 * with at least one option, since a field with none cannot express a value. The server's
 * validation uses the same set, so what the schema offers and what survives cannot drift.
 */
export function offeredCustomFields(input: IdeaAssistTurnSchemaInput): IdeaAssistFieldDefinition[] {
  const locked = new Set(input.lockedFields)
  return input.customFields.filter(
    (f) => !locked.has(customFieldKey(f.id)) && (!isOptionBacked(f) || f.options.length > 0),
  )
}

/**
 * Brainstorm offers. A suggestion for a locked field is dropped with the field: the client would
 * apply it over a value the person owns.
 */
function suggestionsSchema(isOpen: (key: string) => boolean): JsonSchema | null {
  const properties: Record<string, JsonSchema> = {}
  if (isOpen('proposedSolutions')) {
    properties.solutions = {
      type: 'array',
      items: { type: 'string', maxLength: PROPOSED_SOLUTION_MAX_LENGTH },
    }
  }
  if (isOpen('problem')) {
    properties.problemRewrite = { type: 'string', maxLength: PROBLEM_MAX_LENGTH }
  }
  if (isOpen('impactRationale')) {
    properties.rationales = {
      type: 'array',
      items: { type: 'string', maxLength: IMPACT_RATIONALE_MAX_LENGTH },
    }
  }
  if (Object.keys(properties).length === 0) {
    return null
  }
  return {
    type: 'object',
    description: 'Optional offers the person may accept; never applied automatically.',
    properties,
    additionalProperties: false,
  }
}

/**
 * Unlocked interview fields in order, then required custom fields, title, the optional fields and
 * done. Ids the organization has none of are not offered: nothing could be chosen for them.
 */
export function nextStepValues(
  context: IdeaAssistContext,
  locked: ReadonlySet<string>,
  customFields: readonly IdeaAssistFieldDefinition[],
): string[] {
  const unavailable = new Set<string>()
  if (context.businessImpacts.length === 0) {
    unavailable.add('businessImpactId')
  }
  if (context.ideaTypes.length === 0) {
    unavailable.add('ideaTypeId')
  }
  const askable = (key: string): boolean => !locked.has(key) && !unavailable.has(key)

  const steps: string[] = INTERVIEW_FIELD_KEYS.filter(askable)
  for (const field of customFields) {
    if (field.isRequired) {
      steps.push(customFieldKey(field.id))
    }
  }
  if (askable('title')) {
    steps.push('title')
  }
  steps.push(...OPTIONAL_FIELD_KEYS.filter(askable), NEXT_STEP_DONE)
  return steps
}

/** A closed enum of ids; an organization with none cannot express a value, so the key is omitted. */
function idEnum(ids: readonly string[]): JsonSchema | null {
  return ids.length === 0 ? null : { type: 'string', enum: [...ids] }
}

/** One custom-field entry, pinned to its definition id, `value` typed per `IdeaFieldValue` serialization. */
function customFieldEntry(field: IdeaAssistFieldDefinition): JsonSchema {
  return {
    type: 'object',
    // The name is user-authored: neutralise angle brackets as the prompt builder's fence() does.
    description: `Value for the custom field "${field.name.replaceAll('<', '(').replaceAll('>', ')')}".`,
    properties: {
      fieldDefinitionId: { type: 'string', enum: [field.id] },
      value: customFieldValue(field),
    },
    required: ['fieldDefinitionId', 'value'],
    additionalProperties: false,
  }
}

function isOptionBacked(field: IdeaAssistFieldDefinition): boolean {
  return field.fieldType === FieldType.Dropdown || field.fieldType === FieldType.MultiSelect
}

function customFieldValue(field: IdeaAssistFieldDefinition): JsonSchema {
  switch (field.fieldType) {
    case FieldType.Text:
      return { type: 'string', maxLength: TEXT_FIELD_MAX_LENGTH }
    case FieldType.Url:
      return { type: 'string', maxLength: URL_FIELD_MAX_LENGTH }
    case FieldType.Number:
      return { type: 'string', description: 'An invariant decimal number such as 50000 or 12.5.' }
    case FieldType.Date:
      return { type: 'string', description: 'An ISO date, yyyy-MM-dd.' }
    case FieldType.Boolean:
      return { type: 'string', enum: ['true', 'false'] }
    case FieldType.Dropdown:
      return { type: 'string', enum: field.options.map((o) => o.id) }
    case FieldType.MultiSelect:
      return {
        type: 'string',
        description: 'Comma-separated option ids, no spaces, no duplicates.',
      }
  }
}

const NUMBER_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/
const DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/

/**
 * Whether `value` is a well-formed serialization for `field` (the `IdeaFieldValue` formats). The
 * checks the schema leaves to the server: Number, Date and MultiSelect shape, plus the enum and
 * length rules, so one function answers for every type.
 */
export function isValidCustomFieldValue(field: IdeaAssistFieldDefinition, value: string): boolean {
  const optionIds = new Set(field.options.map((o) => o.id))
  switch (field.fieldType) {
    case FieldType.Text:
      return value.length > 0 && value.length <= TEXT_FIELD_MAX_LENGTH
    case FieldType.Url:
      return value.length > 0 && value.length <= URL_FIELD_MAX_LENGTH
    case FieldType.Number:
      return NUMBER_PATTERN.test(value)
    case FieldType.Date:
      return DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    case FieldType.Boolean:
      return value === 'true' || value === 'false'
    case FieldType.Dropdown:
      return optionIds.has(value)
    case FieldType.MultiSelect: {
      const ids = value.split(',')
      return ids.every((id) => optionIds.has(id)) && new Set(ids).size === ids.length
    }
  }
}
