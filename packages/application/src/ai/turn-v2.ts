import { Priority } from '@collega/domain/enums'
import {
  DESCRIPTION_MAX_LENGTH,
  IMPACT_RATIONALE_MAX_LENGTH,
  PROBLEM_MAX_LENGTH,
  PROPOSED_SOLUTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '@collega/domain/ideas'
import type {
  IdeaAssistContext,
  IdeaAssistFieldDefinition,
  IdeaAssistFieldValue,
  IdeaAssistSuggestions,
  IdeaAssistTurn,
  IdeaAssistTurnInputV2,
  IdeaDraftChanges,
  IdeaDraftModelResponseV2,
  IdeaDraftV2,
} from './models.js'
import { businessImpactIdsOf, ideaTypeIdsOf } from './models.js'
import { SYSTEM_PROMPT_TEMPLATE_V2 } from './prompt-defaults.js'
import {
  customFieldKey,
  DRAFT_FIELD_KEYS,
  isValidCustomFieldValue,
  NEXT_STEP_DONE,
  nextStepValues,
  offeredCustomFields,
  TURN_V2_BOUNDS,
} from './turn-schema-v2.js'

/**
 * The server half of the v2 turn (SPEC/contracts/ai-assist.md "v2 turn contract"). Pure: no I/O,
 * no clock. `IdeaAssistService.continueTurnV2` calls it, and `tools/prompt-eval` can call it to
 * score a turn exactly as the service returns it.
 *
 * What the model returns is UNTRUSTED. The schema keeps the model to the right keys and closed
 * enums, but leaves the array bounds and the Number, Date and MultiSelect value shapes to this
 * file, and the locked fields are removed here whatever the schema offered.
 */

const CHARS_PER_TOKEN = 4
/** As v1's reservation: the system prompt and catalog going in and the reply coming back. */
const RESERVED_OVERHEAD_TOKENS = 12_000
const CUSTOM_FIELD_KEY_PREFIX = 'fieldValues.'
const PRIORITIES: readonly string[] = Object.values(Priority)
/** Fields with a title-ish "is it filled" test in the fallback step order. */
const OPTIONAL_STEPS: ReadonlySet<string> = new Set(['priority', 'tagNames', 'description'])

/**
 * A `nextStep`-vocabulary value, or null. An unknown value is ignored, not rejected. A custom
 * field step must name a field offered for the draft's type: nothing free-form from the client
 * reaches the prompt or the out-of-scope echo.
 */
export function knownStepOrNull(
  step: string | null | undefined,
  customFields: readonly IdeaAssistFieldDefinition[],
): string | null {
  if (typeof step !== 'string') {
    return null
  }
  const value = step.trim()
  if (value === NEXT_STEP_DONE || (DRAFT_FIELD_KEYS as readonly string[]).includes(value)) {
    return value
  }
  return customFields.some((f) => customFieldKey(f.id) === value) ? value : null
}

/** The context with the v2 co-author prompt in place of the active (v1) template. */
export function withV2Prompt(context: IdeaAssistContext): IdeaAssistContext {
  return {
    ...context,
    prompts: { ...context.prompts, systemPromptTemplate: SYSTEM_PROMPT_TEMPLATE_V2 },
  }
}

/** What a turn is held against the daily ceiling while in flight (see v1's `estimateTurnTokens`). */
export function estimateTurnTokensV2(
  transcript: readonly IdeaAssistTurn[],
  draft: IdeaDraftV2,
): number {
  const characters =
    transcript.reduce((total, turn) => total + turn.text.length, 0) + JSON.stringify(draft).length
  return RESERVED_OVERHEAD_TOKENS + Math.ceil(characters / CHARS_PER_TOKEN)
}

/**
 * Clamps the CALLER'S draft to the domain maxima before it reaches the prompt, as v1 does: clamped
 * rather than rejected at this layer (the controller already refused over-length input with a
 * `400`), so a direct caller of the service cannot walk around the per-entry cap.
 */
export function clampDraftV2(draft: IdeaDraftV2): IdeaDraftV2 {
  return {
    title: cleanText(draft.title, TITLE_MAX_LENGTH) ?? null,
    problem: cleanText(draft.problem, PROBLEM_MAX_LENGTH) ?? null,
    proposedSolutions: cleanList(
      draft.proposedSolutions,
      PROPOSED_SOLUTION_MAX_LENGTH,
      TURN_V2_BOUNDS.proposedSolutions.max,
    ),
    impactRationale: cleanText(draft.impactRationale, IMPACT_RATIONALE_MAX_LENGTH) ?? null,
    businessImpactId: draft.businessImpactId ?? null,
    ideaTypeId: draft.ideaTypeId ?? null,
    priority: draft.priority != null && PRIORITIES.includes(draft.priority) ? draft.priority : null,
    tagNames: cleanList(draft.tagNames, TAG_NAME_MAX_LENGTH, TURN_V2_BOUNDS.tagNames.max),
    fieldValues: clampFieldValues(draft.fieldValues),
    description: cleanText(draft.description, DESCRIPTION_MAX_LENGTH) ?? null,
  }
}

/** Longest custom-field value (`Url`, the widest type) and most entries a draft may carry. */
const FIELD_VALUE_MAX_LENGTH = 2048
const MAX_FIELD_VALUE_ENTRIES = 100
/** Tag names are short labels; a vocabulary match is exact, so a longer item cannot match. */
const TAG_NAME_MAX_LENGTH = 100

function clampFieldValues(
  values: readonly IdeaAssistFieldValue[] | null | undefined,
): IdeaAssistFieldValue[] | null {
  if (!values) {
    return null
  }
  return values
    .filter((v) => v.value.length <= FIELD_VALUE_MAX_LENGTH)
    .slice(0, MAX_FIELD_VALUE_ENTRIES)
}

/**
 * The request normalised against the retrieved catalog. Unknown or inactive ids, tags outside the
 * vocabulary and custom-field entries for a field not visible for the draft's Idea Type are
 * discarded, not rejected (as v1 treats ids); `lockedFields` keeps only names that denote a real
 * field, so an unknown one is inert.
 */
export function prepareTurnInputV2(
  context: IdeaAssistContext,
  draft: IdeaDraftV2,
  lockedFields: readonly string[],
  step: string | null | undefined,
): IdeaAssistTurnInputV2 {
  const ideaTypeId =
    draft.ideaTypeId != null && ideaTypeIdsOf(context).includes(draft.ideaTypeId)
      ? draft.ideaTypeId
      : null
  const customFields = ideaTypeId === null ? [] : (context.fieldsByIdeaType?.[ideaTypeId] ?? [])
  const visibleIds = new Set(customFields.map((f) => f.id))

  const knownLockable = new Set<string>(DRAFT_FIELD_KEYS)
  for (const fields of Object.values(context.fieldsByIdeaType ?? {})) {
    for (const field of fields) {
      knownLockable.add(customFieldKey(field.id))
    }
  }

  return {
    draft: {
      ...draft,
      ideaTypeId,
      businessImpactId:
        draft.businessImpactId != null &&
        businessImpactIdsOf(context).includes(draft.businessImpactId)
          ? draft.businessImpactId
          : null,
      tagNames: vocabularyTags(draft.tagNames, context),
      fieldValues: (draft.fieldValues ?? []).filter((v) => visibleIds.has(v.fieldDefinitionId)),
    },
    lockedFields: [...new Set(lockedFields.filter((name) => knownLockable.has(name)))],
    step: knownStepOrNull(step, customFields),
    customFields,
  }
}

export type FinalizedTurnV2 = {
  readonly changes: IdeaDraftChanges
  readonly suggestions?: IdeaAssistSuggestions
  readonly nextStep: string
}

/**
 * Validates one in-scope v2 model response and reduces it to what may leave the server. Every
 * value is checked against the retrieved set and its limits; a value that fails is dropped and the
 * rest of the response stands. Locked fields never survive - not in `changes`, not as a
 * suggestion, not as `nextStep`.
 */
export function finalizeTurnV2(
  response: Pick<IdeaDraftModelResponseV2, 'changes' | 'suggestions' | 'nextStep'>,
  context: IdeaAssistContext,
  input: IdeaAssistTurnInputV2,
): FinalizedTurnV2 {
  const locked = new Set(input.lockedFields)
  const open = (key: string) => !locked.has(key)
  const offered = offeredCustomFields(input)
  const raw = isRecord(response.changes) ? response.changes : {}
  const changes: Record<string, unknown> = {}

  const text = (key: 'title' | 'problem' | 'impactRationale' | 'description', max: number) => {
    const value = open(key) ? cleanText(raw[key], max) : undefined
    if (value !== undefined) changes[key] = value
  }
  text('title', TITLE_MAX_LENGTH)
  text('problem', PROBLEM_MAX_LENGTH)
  text('impactRationale', IMPACT_RATIONALE_MAX_LENGTH)
  text('description', DESCRIPTION_MAX_LENGTH)

  if (open('proposedSolutions')) {
    const solutions = cleanList(
      raw.proposedSolutions,
      PROPOSED_SOLUTION_MAX_LENGTH,
      TURN_V2_BOUNDS.proposedSolutions.max,
    )
    if (solutions !== null && solutions.length >= TURN_V2_BOUNDS.proposedSolutions.min) {
      changes.proposedSolutions = solutions
    }
  }

  if (
    open('businessImpactId') &&
    typeof raw.businessImpactId === 'string' &&
    businessImpactIdsOf(context).includes(raw.businessImpactId)
  ) {
    changes.businessImpactId = raw.businessImpactId
  }
  if (
    open('ideaTypeId') &&
    typeof raw.ideaTypeId === 'string' &&
    ideaTypeIdsOf(context).includes(raw.ideaTypeId)
  ) {
    changes.ideaTypeId = raw.ideaTypeId
  }
  if (open('priority') && typeof raw.priority === 'string' && PRIORITIES.includes(raw.priority)) {
    changes.priority = raw.priority
  }
  if (open('tagNames')) {
    const tags = vocabularyTags(raw.tagNames, context)
    if (tags !== null && tags.length > 0) changes.tagNames = tags
  }

  const fieldValues = validFieldValues(raw.fieldValues, offered)
  if (fieldValues.length > 0) {
    changes.fieldValues = fieldValues
  }

  const typedChanges = changes as IdeaDraftChanges
  const suggestions = finalizeSuggestions(response.suggestions, open)
  const allowedSteps = nextStepValues(context, locked, offered)
  const nextStep = allowedSteps.includes(response.nextStep)
    ? response.nextStep
    : fallbackStep(allowedSteps, { ...input.draft, ...typedChanges })

  return {
    changes: typedChanges,
    ...(suggestions === undefined ? {} : { suggestions }),
    nextStep,
  }
}

function finalizeSuggestions(
  value: unknown,
  open: (key: string) => boolean,
): IdeaAssistSuggestions | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const out: { solutions?: string[]; problemRewrite?: string; rationales?: string[] } = {}

  if (open('proposedSolutions')) {
    const solutions = cleanList(
      value.solutions,
      PROPOSED_SOLUTION_MAX_LENGTH,
      TURN_V2_BOUNDS.solutionSuggestions.max,
    )
    if (solutions !== null && solutions.length > 0) out.solutions = solutions
  }
  if (open('problem')) {
    const rewrite = cleanText(value.problemRewrite, PROBLEM_MAX_LENGTH)
    if (rewrite !== undefined) out.problemRewrite = rewrite
  }
  if (open('impactRationale')) {
    const rationales = cleanList(
      value.rationales,
      IMPACT_RATIONALE_MAX_LENGTH,
      TURN_V2_BOUNDS.rationaleSuggestions.max,
    )
    if (rationales !== null && rationales.length > 0) out.rationales = rationales
  }

  return Object.keys(out).length === 0 ? undefined : out
}

/** Entries for an offered field with a well-formed value; the last entry for a field wins. */
function validFieldValues(
  value: unknown,
  offered: readonly IdeaAssistFieldDefinition[],
): IdeaAssistFieldValue[] {
  if (!Array.isArray(value)) {
    return []
  }
  const byId = new Map<string, IdeaAssistFieldValue>()
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.fieldDefinitionId !== 'string') continue
    const field = offered.find((f) => f.id === entry.fieldDefinitionId)
    if (field === undefined || typeof entry.value !== 'string') continue
    const serialized = entry.value.trim()
    if (isValidCustomFieldValue(field, serialized)) {
      byId.set(field.id, { fieldDefinitionId: field.id, value: serialized })
    }
  }
  return [...byId.values()]
}

/**
 * The first askable step that is still empty, for a model that named a step outside the
 * vocabulary (a locked field, or one the organization cannot answer). Optional fields are never
 * the fallback: they are asked about only when the model chooses to.
 */
function fallbackStep(allowedSteps: readonly string[], merged: IdeaDraftV2): string {
  for (const step of allowedSteps) {
    if (step === NEXT_STEP_DONE) break
    if (!OPTIONAL_STEPS.has(step) && isEmptyStep(step, merged)) {
      return step
    }
  }
  return NEXT_STEP_DONE
}

function isEmptyStep(step: string, draft: IdeaDraftV2): boolean {
  if (step.startsWith(CUSTOM_FIELD_KEY_PREFIX)) {
    const id = step.slice(CUSTOM_FIELD_KEY_PREFIX.length)
    return !(draft.fieldValues ?? []).some((v) => v.fieldDefinitionId === id)
  }
  const value = (draft as Record<string, unknown>)[step]
  return Array.isArray(value) ? value.length === 0 : value == null || value === ''
}

/** Tags the organization's vocabulary contains (matched case-insensitively, returned as stored). */
function vocabularyTags(value: unknown, context: IdeaAssistContext): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const canonical = new Map(context.tags.map((tag) => [tag.toLowerCase(), tag]))
  const names = value.flatMap((item) =>
    typeof item === 'string' ? [canonical.get(item.trim().toLowerCase())] : [],
  )
  return [...new Set(names.filter((n): n is string => n !== undefined))].slice(
    0,
    TURN_V2_BOUNDS.tagNames.max,
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A trimmed, non-blank string cut to `max`, or undefined. */
function cleanText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  if (trimmed.length <= max) {
    return trimmed
  }
  // Cutting between a surrogate pair would leave a lone surrogate the create form rejects.
  const code = trimmed.charCodeAt(max - 1)
  return trimmed.slice(0, code >= 0xd800 && code <= 0xdbff ? max - 1 : max)
}

/** Non-blank strings, each cut to `maxLength`, at most `maxItems`; null when `value` is no array. */
function cleanList(value: unknown, maxLength: number, maxItems: number): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  return value
    .map((item) => cleanText(item, maxLength))
    .filter((item): item is string => item !== undefined)
    .slice(0, maxItems)
}
