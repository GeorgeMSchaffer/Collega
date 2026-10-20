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

/** The fields the interview asks about, in order (v2 spec "Conversation" item 3). Title is last. */
const ASKABLE_FIELD_KEYS = [
  'problem',
  'proposedSolutions',
  'impactRationale',
  'businessImpactId',
  'ideaTypeId',
] as const

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
  const customFields = input.customFields.filter((f) => isOpen(customFieldKey(f.id)))

  const changes: Record<string, JsonSchema> = {}
  const add = (key: DraftFieldKey, schema: JsonSchema | null): void => {
    if (schema && isOpen(key)) {
      changes[key] = schema
    }
  }

  add('title', { type: 'string', minLength: 1, maxLength: TITLE_MAX_LENGTH })
  add('problem', { type: 'string', minLength: 1, maxLength: PROBLEM_MAX_LENGTH })
  add('proposedSolutions', {
    type: 'array',
    minItems: MIN_PROPOSED_SOLUTIONS,
    maxItems: MAX_PROPOSED_SOLUTIONS,
    items: { type: 'string', minLength: 1, maxLength: PROPOSED_SOLUTION_MAX_LENGTH },
  })
  add('impactRationale', { type: 'string', minLength: 1, maxLength: IMPACT_RATIONALE_MAX_LENGTH })
  add('businessImpactId', idEnum(businessImpactIdsOf(context)))
  add('ideaTypeId', idEnum(ideaTypeIdsOf(context)))
  add('priority', { type: 'string', enum: Object.values(Priority) })
  add(
    'tagNames',
    context.tags.length === 0
      ? null
      : {
          type: 'array',
          maxItems: MAX_TAGS,
          uniqueItems: true,
          items: { type: 'string', enum: [...context.tags] },
        },
  )
  add('description', { type: 'string', minLength: 1, maxLength: DESCRIPTION_MAX_LENGTH })

  if (customFields.length > 0) {
    changes.fieldValues = {
      type: 'array',
      maxItems: customFields.length,
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
      enum: nextStepValues(locked, customFields),
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
 * Brainstorm offers. A suggestion for a locked field is dropped with the field: the client would
 * apply it over a value the person owns.
 */
function suggestionsSchema(isOpen: (key: string) => boolean): JsonSchema | null {
  const properties: Record<string, JsonSchema> = {}
  if (isOpen('proposedSolutions')) {
    properties.solutions = {
      type: 'array',
      maxItems: MAX_SOLUTION_SUGGESTIONS,
      items: { type: 'string', minLength: 1, maxLength: PROPOSED_SOLUTION_MAX_LENGTH },
    }
  }
  if (isOpen('problem')) {
    properties.problemRewrite = { type: 'string', minLength: 1, maxLength: PROBLEM_MAX_LENGTH }
  }
  if (isOpen('impactRationale')) {
    properties.rationales = {
      type: 'array',
      maxItems: MAX_RATIONALE_SUGGESTIONS,
      items: { type: 'string', minLength: 1, maxLength: IMPACT_RATIONALE_MAX_LENGTH },
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

/** Unlocked askable fields in interview order, then required custom fields, then title, then done. */
function nextStepValues(
  locked: ReadonlySet<string>,
  customFields: readonly IdeaAssistFieldDefinition[],
): string[] {
  const steps: string[] = ASKABLE_FIELD_KEYS.filter((key) => !locked.has(key))
  for (const field of customFields) {
    if (field.isRequired) {
      steps.push(customFieldKey(field.id))
    }
  }
  if (!locked.has('title')) {
    steps.push('title')
  }
  steps.push(NEXT_STEP_DONE)
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

function customFieldValue(field: IdeaAssistFieldDefinition): JsonSchema {
  const optionIds = field.options.map((o) => o.id)
  switch (field.fieldType) {
    case FieldType.Text:
      return { type: 'string', minLength: 1, maxLength: TEXT_FIELD_MAX_LENGTH }
    case FieldType.Url:
      return { type: 'string', minLength: 1, maxLength: URL_FIELD_MAX_LENGTH }
    case FieldType.Number:
      return { type: 'string', pattern: '^-?[0-9]+(\\.[0-9]+)?$' }
    case FieldType.Date:
      return { type: 'string', pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' }
    case FieldType.Boolean:
      return { type: 'string', enum: ['true', 'false'] }
    case FieldType.Dropdown:
      return { type: 'string', enum: optionIds }
    case FieldType.MultiSelect: {
      // Comma-separated option ids, the stored form. Ids are GUIDs, so nothing needs escaping.
      const one = optionIds.join('|')
      return { type: 'string', pattern: `^(${one})(,(${one}))*$` }
    }
  }
}
