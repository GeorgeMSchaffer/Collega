import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * The corpus as `tools/prompt-eval/README.md` describes it, validated by hand
 * (SPEC/20-feature-prompt-eval-runner.md rules 1-5). Validation is strict about unknown keys so a
 * misspelt expectation fails loudly rather than going unscored.
 *
 * The v2 keys are provisional: they follow the v2 turn contract as specified
 * (SPEC/20-feature-ai-idea-assist-v2.md "Contract changes") and change with it when v2 is built.
 */

export type AssistantVersion = 'v1' | 'v2' | 'both'

export interface V1Expectations {
  readonly inScope?: boolean
  readonly ideaType?: string
  readonly businessImpact?: string
  readonly priority?: string
  readonly titleSet?: boolean
  readonly descriptionSet?: boolean
}

/** A count of suggestions the reply offers, inclusive. */
export interface CountRange {
  readonly min?: number
  readonly max?: number
}

/** Rule 4. Only on `assistant: "v2"` cases; options, tags and fields are named in prose. */
export interface V2Expectations extends V1Expectations {
  readonly problemSet?: boolean
  readonly impactRationaleSet?: boolean
  readonly proposedSolutions?: { readonly min: number }
  /** Tag names that must be present. */
  readonly tags?: readonly string[]
  /** By field name: `"set"`, or the expected option name of a dropdown. */
  readonly fieldValues?: Readonly<Record<string, string>>
  /** The field the reply asks about, named as the v2 contract names it, or `done`. */
  readonly nextStep?: string
  readonly suggestions?: {
    readonly solutions?: CountRange
    readonly rationales?: CountRange
    readonly problemRewrite?: boolean
  }
}

/** The draft a v2 case starts from, in prose: options, tags and fields by name. */
export interface CaseDraft {
  readonly title?: string
  readonly problem?: string
  readonly proposedSolutions?: readonly string[]
  readonly impactRationale?: string
  readonly description?: string
  readonly ideaType?: string
  readonly businessImpact?: string
  readonly priority?: string
  readonly tags?: readonly string[]
  readonly fieldValues?: Readonly<Record<string, string | number>>
}

export interface EvalCase {
  readonly id: string
  readonly fixture: string
  readonly note: string
  readonly turns: readonly string[]
  readonly expect: V2Expectations
  readonly pair: string | null
  readonly assistant: AssistantVersion
  /** v2 only: the draft the first turn is sent with. Null starts from an empty draft. */
  readonly draft: CaseDraft | null
  /** v2 only: the fields the person owns, named as the v2 contract names them. */
  readonly lockedFields: readonly string[]
  /** The file it was read from, relative to the corpus root - for error messages only. */
  readonly file: string
}

export interface FixtureOption {
  readonly name: string
  readonly fieldNames?: readonly string[]
  /** v2: the subset of `fieldNames` this idea type requires. */
  readonly requiredFieldNames?: readonly string[]
}

export type FixtureFieldType = 'number' | 'dropdown' | 'text'

/** v2: a typed custom field (rule 4), attached to idea types through their `fieldNames`. */
export interface FixtureField {
  readonly name: string
  readonly type: FixtureFieldType
  /** Dropdown only. */
  readonly options?: readonly string[]
}

export interface EvalFixture {
  readonly name: string
  readonly organizationName: string
  readonly scopeStatement: string | null
  readonly ideaTypes: readonly FixtureOption[]
  readonly businessImpacts: readonly FixtureOption[]
  readonly statuses: readonly string[]
  readonly tags: readonly string[]
  readonly memberNames: readonly string[]
  /** v2 only; the v1 fixtures carry none. */
  readonly fields?: readonly FixtureField[]
  readonly file: string
}

export interface Corpus {
  /** In file-name order, which is the order a run executes them. */
  readonly cases: readonly EvalCase[]
  readonly fixtures: ReadonlyMap<string, EvalFixture>
}

export class CorpusError extends Error {
  readonly problems: readonly string[]

  constructor(problems: readonly string[]) {
    super(`The corpus is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
    this.name = 'CorpusError'
    this.problems = problems
  }
}

const CASE_KEYS = new Set([
  'id',
  'fixture',
  'note',
  'turns',
  'expect',
  'pair',
  'assistant',
  'draft',
  'lockedFields',
])
const FIXTURE_KEYS = new Set([
  'name',
  '//',
  'organizationName',
  'scopeStatement',
  'ideaTypes',
  'businessImpacts',
  'statuses',
  'tags',
  'memberNames',
  'fields',
])
const EXPECT_BOOLEAN_KEYS = new Set(['inScope', 'titleSet', 'descriptionSet'])
const EXPECT_OPTION_KEYS = new Set(['ideaType', 'businessImpact', 'priority'])
const V2_EXPECT_KEYS = new Set([
  'problemSet',
  'impactRationaleSet',
  'proposedSolutions',
  'tags',
  'fieldValues',
  'nextStep',
  'suggestions',
])
const ASSISTANT_VERSIONS: readonly string[] = ['v1', 'v2', 'both']
const FIELD_TYPES: readonly string[] = ['number', 'dropdown', 'text']

/** The v2 contract's draft field names, which `lockedFields` uses. */
export const V2_DRAFT_FIELDS: readonly string[] = [
  'title',
  'problem',
  'proposedSolutions',
  'impactRationale',
  'businessImpactId',
  'ideaTypeId',
  'priority',
  'tagNames',
  'description',
]
/** What the interview asks about (v2 "Conversation" 3), plus `done`. */
const NEXT_STEPS: readonly string[] = [
  'problem',
  'proposedSolutions',
  'impactRationale',
  'businessImpactId',
  'ideaTypeId',
  'title',
  'done',
]
const DRAFT_KEYS = new Set([
  'title',
  'problem',
  'proposedSolutions',
  'impactRationale',
  'description',
  'ideaType',
  'businessImpact',
  'priority',
  'tags',
  'fieldValues',
])
/** Proposed solutions holds 1 to 5 items (SPEC/20-feature-ideas-and-engagement.md rule 2). */
export const MAX_SOLUTIONS = 5
/** The v2 contract offers at most three suggestions of a kind. */
const MAX_SUGGESTIONS = 3

/**
 * Reads and validates every case and fixture under `root`. Collects every problem before failing,
 * so one run of `--dry-run` lists them all.
 *
 * `priorities` is the closed set the production response schema allows, passed in rather than
 * restated here.
 */
export async function loadCorpus(root: string, priorities: readonly string[]): Promise<Corpus> {
  const problems: string[] = []

  const fixtures = new Map<string, EvalFixture>()
  for (const file of await jsonFiles(path.join(root, 'fixtures'))) {
    const relative = `fixtures/${file}`
    const raw = await readJson(path.join(root, 'fixtures', file), relative, problems)
    if (raw === undefined) continue
    const fixture = validateFixture(raw, relative, problems)
    if (fixture === null) continue
    if (fixtures.has(fixture.name)) {
      problems.push(`${relative}: fixture name "${fixture.name}" is used by another fixture`)
      continue
    }
    fixtures.set(fixture.name, fixture)
  }

  const cases: EvalCase[] = []
  for (const file of await jsonFiles(path.join(root, 'cases'))) {
    const relative = `cases/${file}`
    const raw = await readJson(path.join(root, 'cases', file), relative, problems)
    if (raw === undefined) continue
    const evalCase = validateCase(raw, relative, fixtures, priorities, problems)
    if (evalCase === null) continue
    if (cases.some((c) => c.id === evalCase.id)) {
      problems.push(`${relative}: case id "${evalCase.id}" is used by another case`)
      continue
    }
    cases.push(evalCase)
  }

  const pairs = new Map<string, string[]>()
  for (const c of cases) {
    if (c.pair !== null) pairs.set(c.pair, [...(pairs.get(c.pair) ?? []), c.id])
  }
  for (const [pair, ids] of pairs) {
    if (ids.length !== 2) {
      problems.push(`pair "${pair}" must name exactly two cases, found ${ids.length}`)
    }
  }

  if (problems.length > 0) throw new CorpusError(problems)
  return { cases, fixtures }
}

async function jsonFiles(dir: string): Promise<string[]> {
  const names = await readdir(dir)
  return names.filter((n) => n.endsWith('.json')).sort()
}

async function readJson(
  file: string,
  relative: string,
  problems: string[],
): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown
  } catch (error) {
    problems.push(`${relative}: not valid JSON (${(error as Error).message})`)
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function isCount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max
}

function unknownKeys(raw: Record<string, unknown>, allowed: ReadonlySet<string>): string[] {
  return Object.keys(raw).filter((k) => !allowed.has(k))
}

function validateFixture(raw: unknown, file: string, problems: string[]): EvalFixture | null {
  if (!isRecord(raw)) {
    problems.push(`${file}: must be a JSON object`)
    return null
  }
  const before = problems.length
  for (const key of unknownKeys(raw, FIXTURE_KEYS)) {
    problems.push(`${file}: unknown key "${key}"`)
  }
  if (!isNonBlankString(raw.name)) problems.push(`${file}: "name" must be a non-blank string`)
  if (!isNonBlankString(raw.organizationName)) {
    problems.push(`${file}: "organizationName" must be a non-blank string`)
  }
  if (raw.scopeStatement !== null && typeof raw.scopeStatement !== 'string') {
    problems.push(`${file}: "scopeStatement" must be a string or null`)
  }
  const ideaTypes = validateOptions(raw.ideaTypes, 'ideaTypes', true, file, problems)
  const businessImpacts = validateOptions(
    raw.businessImpacts,
    'businessImpacts',
    false,
    file,
    problems,
  )
  for (const key of ['statuses', 'tags', 'memberNames'] as const) {
    if (!isStringArray(raw[key])) problems.push(`${file}: "${key}" must be an array of strings`)
  }
  const fields = raw.fields === undefined ? undefined : validateFields(raw.fields, file, problems)
  for (const type of ideaTypes) {
    if (fields !== undefined) {
      for (const name of (type.fieldNames ?? []).filter((n) => !fields.some((f) => f.name === n))) {
        problems.push(`${file}: idea type "${type.name}" names field "${name}", not in "fields"`)
      }
    }
    for (const name of type.requiredFieldNames ?? []) {
      if (!(type.fieldNames ?? []).includes(name)) {
        problems.push(`${file}: idea type "${type.name}" requires "${name}", not in its fieldNames`)
      }
    }
  }
  if (problems.length > before) return null

  return {
    name: raw.name as string,
    organizationName: raw.organizationName as string,
    scopeStatement: raw.scopeStatement as string | null,
    ideaTypes,
    businessImpacts,
    statuses: raw.statuses as string[],
    tags: raw.tags as string[],
    memberNames: raw.memberNames as string[],
    ...(fields === undefined ? {} : { fields }),
    file,
  }
}

function validateOptions(
  raw: unknown,
  key: string,
  allowFieldNames: boolean,
  file: string,
  problems: string[],
): FixtureOption[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    problems.push(`${file}: "${key}" must be a non-empty array`)
    return []
  }
  const options: FixtureOption[] = []
  const allowed = new Set(allowFieldNames ? ['name', 'fieldNames', 'requiredFieldNames'] : ['name'])
  raw.forEach((option: unknown, index) => {
    const where = `${file}: ${key}[${index}]`
    if (!isRecord(option)) {
      problems.push(`${where} must be an object`)
      return
    }
    for (const unknown of unknownKeys(option, allowed)) {
      problems.push(`${where}: unknown key "${unknown}"`)
    }
    if (!isNonBlankString(option.name)) {
      problems.push(`${where}: "name" must be a non-blank string`)
      return
    }
    for (const list of ['fieldNames', 'requiredFieldNames'] as const) {
      if (option[list] !== undefined && !isStringArray(option[list])) {
        problems.push(`${where}: "${list}" must be an array of strings`)
        return
      }
    }
    // Ids are derived from names, so two options sharing a name would share an id.
    if (options.some((o) => o.name === option.name)) {
      problems.push(`${where}: duplicate name "${option.name}"`)
      return
    }
    options.push({
      name: option.name,
      ...(option.fieldNames === undefined ? {} : { fieldNames: option.fieldNames as string[] }),
      ...(option.requiredFieldNames === undefined
        ? {}
        : { requiredFieldNames: option.requiredFieldNames as string[] }),
    })
  })
  return options
}

function validateFields(raw: unknown, file: string, problems: string[]): FixtureField[] {
  if (!Array.isArray(raw)) {
    problems.push(`${file}: "fields" must be an array`)
    return []
  }
  const fields: FixtureField[] = []
  raw.forEach((field: unknown, index) => {
    const where = `${file}: fields[${index}]`
    if (!isRecord(field)) {
      problems.push(`${where} must be an object`)
      return
    }
    for (const key of unknownKeys(field, new Set(['name', 'type', 'options']))) {
      problems.push(`${where}: unknown key "${key}"`)
    }
    if (!isNonBlankString(field.name) || fields.some((f) => f.name === field.name)) {
      problems.push(`${where}: "name" must be a non-blank, unique string`)
      return
    }
    if (typeof field.type !== 'string' || !FIELD_TYPES.includes(field.type)) {
      problems.push(`${where}: "type" must be one of ${FIELD_TYPES.join(', ')}`)
      return
    }
    const isDropdown = field.type === 'dropdown'
    const options = field.options
    if (
      isDropdown &&
      (!isStringArray(options) || options.length === 0 || new Set(options).size !== options.length)
    ) {
      problems.push(`${where}: a dropdown needs a non-empty list of unique "options"`)
      return
    }
    if (!isDropdown && options !== undefined) {
      problems.push(`${where}: only a dropdown has "options"`)
      return
    }
    fields.push({
      name: field.name,
      type: field.type as FixtureFieldType,
      ...(isDropdown ? { options: options as string[] } : {}),
    })
  })
  return fields
}

function validateCase(
  raw: unknown,
  file: string,
  fixtures: ReadonlyMap<string, EvalFixture>,
  priorities: readonly string[],
  problems: string[],
): EvalCase | null {
  if (!isRecord(raw)) {
    problems.push(`${file}: must be a JSON object`)
    return null
  }
  const before = problems.length
  for (const key of unknownKeys(raw, CASE_KEYS)) {
    problems.push(`${file}: unknown key "${key}"`)
  }
  if (!isNonBlankString(raw.id)) problems.push(`${file}: "id" must be a non-blank string`)
  if (typeof raw.note !== 'string') problems.push(`${file}: "note" must be a string`)
  if (
    !Array.isArray(raw.turns) ||
    raw.turns.length === 0 ||
    !raw.turns.every((t) => isNonBlankString(t))
  ) {
    problems.push(`${file}: "turns" must be a non-empty array of non-blank strings`)
  }
  if (raw.pair !== undefined && !isNonBlankString(raw.pair)) {
    problems.push(`${file}: "pair" must be a non-blank string when present`)
  }
  if (
    raw.assistant !== undefined &&
    (typeof raw.assistant !== 'string' || !ASSISTANT_VERSIONS.includes(raw.assistant))
  ) {
    problems.push(`${file}: "assistant" must be one of ${ASSISTANT_VERSIONS.join(', ')}`)
  }

  const fixture = isNonBlankString(raw.fixture) ? fixtures.get(raw.fixture) : undefined
  if (!isNonBlankString(raw.fixture)) {
    problems.push(`${file}: "fixture" must be a non-blank string`)
  } else if (fixture === undefined) {
    problems.push(`${file}: unknown fixture "${raw.fixture}"`)
  }

  // A `both` case is scored under v1 as well, so only a `v2` case may use what v1 cannot answer.
  const isV2 = raw.assistant === 'v2'
  if (!isRecord(raw.expect) || Object.keys(raw.expect).length === 0) {
    problems.push(`${file}: "expect" must be an object declaring at least one expectation`)
  } else {
    validateExpect(raw.expect, fixture, priorities, isV2, file, problems)
  }
  for (const key of ['draft', 'lockedFields'] as const) {
    if (raw[key] !== undefined && !isV2) problems.push(`${file}: "${key}" needs "assistant": "v2"`)
  }
  if (isV2 && raw.draft !== undefined) validateDraft(raw.draft, fixture, priorities, file, problems)
  if (isV2 && raw.lockedFields !== undefined) {
    if (!isStringArray(raw.lockedFields)) {
      problems.push(`${file}: "lockedFields" must be an array of strings`)
    } else {
      for (const name of raw.lockedFields) {
        if (!isV2FieldName(name, fixture, V2_DRAFT_FIELDS)) {
          problems.push(`${file}: lockedFields names "${name}", which is not a v2 draft field`)
        }
      }
    }
  }
  if (problems.length > before) return null

  return {
    id: raw.id as string,
    fixture: raw.fixture as string,
    note: raw.note as string,
    turns: raw.turns as string[],
    expect: raw.expect as V2Expectations,
    pair: (raw.pair as string | undefined) ?? null,
    assistant: (raw.assistant as AssistantVersion | undefined) ?? 'v1',
    draft: (raw.draft as CaseDraft | undefined) ?? null,
    lockedFields: (raw.lockedFields as string[] | undefined) ?? [],
    file,
  }
}

function validateExpect(
  expect: Record<string, unknown>,
  fixture: EvalFixture | undefined,
  priorities: readonly string[],
  isV2: boolean,
  file: string,
  problems: string[],
): void {
  for (const [key, value] of Object.entries(expect)) {
    if (V2_EXPECT_KEYS.has(key)) {
      if (isV2) validateV2Expectation(key, value, fixture, file, problems)
      else problems.push(`${file}: expect.${key} needs "assistant": "v2"`)
      continue
    }
    if (EXPECT_BOOLEAN_KEYS.has(key)) {
      if (typeof value !== 'boolean') problems.push(`${file}: expect.${key} must be a boolean`)
      continue
    }
    if (!EXPECT_OPTION_KEYS.has(key)) {
      problems.push(`${file}: unknown expectation "${key}"`)
      continue
    }
    if (!isNonBlankString(value)) {
      problems.push(`${file}: expect.${key} must name an option`)
      continue
    }
    // Options are named in prose, never by id (README "Fixtures"); the name must exist.
    const names =
      key === 'priority'
        ? priorities
        : fixture === undefined
          ? null
          : (key === 'ideaType' ? fixture.ideaTypes : fixture.businessImpacts).map((o) => o.name)
    if (names !== null && !names.includes(value)) {
      problems.push(
        `${file}: expect.${key} "${value}" is not an option${
          key === 'priority' ? '' : ` of fixture "${fixture?.name}"`
        }`,
      )
    }
  }
}

/** One of `plain`, or `fieldValues.<field name>` for a field of the fixture. */
function isV2FieldName(
  name: string,
  fixture: EvalFixture | undefined,
  plain: readonly string[],
): boolean {
  if (plain.includes(name)) return true
  if (!name.startsWith('fieldValues.')) return false
  const field = name.slice('fieldValues.'.length)
  return fixture === undefined || (fixture.fields ?? []).some((f) => f.name === field)
}

function validateCountRange(value: unknown, where: string, problems: string[]): void {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    problems.push(`${where} must be { "min": n, "max": n } with at least one bound`)
    return
  }
  for (const key of unknownKeys(value, new Set(['min', 'max']))) {
    problems.push(`${where}: unknown key "${key}"`)
  }
  for (const bound of ['min', 'max'] as const) {
    if (value[bound] !== undefined && !isCount(value[bound], MAX_SUGGESTIONS)) {
      problems.push(`${where}.${bound} must be a whole number from 0 to ${MAX_SUGGESTIONS}`)
    }
  }
  if (typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) {
    problems.push(`${where}: min is above max`)
  }
}

function validateV2Expectation(
  key: string,
  value: unknown,
  fixture: EvalFixture | undefined,
  file: string,
  problems: string[],
): void {
  const where = `${file}: expect.${key}`
  switch (key) {
    case 'problemSet':
    case 'impactRationaleSet':
      if (typeof value !== 'boolean') problems.push(`${where} must be a boolean`)
      return
    case 'proposedSolutions':
      if (
        !isRecord(value) ||
        Object.keys(value).some((k) => k !== 'min') ||
        !isCount(value.min, MAX_SOLUTIONS) ||
        value.min < 1
      ) {
        problems.push(`${where} must be { "min": n } with n from 1 to ${MAX_SOLUTIONS}`)
      }
      return
    case 'tags':
      if (!isStringArray(value) || value.length === 0) {
        problems.push(`${where} must be a non-empty array of tag names`)
      } else if (fixture !== undefined) {
        for (const tag of value.filter((t) => !fixture.tags.includes(t))) {
          problems.push(`${where}: "${tag}" is not a tag of fixture "${fixture.name}"`)
        }
      }
      return
    case 'fieldValues':
      if (!isRecord(value) || Object.keys(value).length === 0) {
        problems.push(`${where} must name at least one field`)
        return
      }
      for (const [name, expected] of Object.entries(value)) {
        const field = fixture?.fields?.find((f) => f.name === name)
        if (fixture !== undefined && field === undefined) {
          problems.push(`${where}: "${name}" is not a field of fixture "${fixture.name}"`)
        } else if (
          typeof expected !== 'string' ||
          (expected !== 'set' && !(field?.options ?? []).includes(expected))
        ) {
          problems.push(`${where}.${name} must be "set" or one of the dropdown's options`)
        }
      }
      return
    case 'nextStep':
      if (typeof value !== 'string' || !isV2FieldName(value, fixture, NEXT_STEPS)) {
        problems.push(`${where} must be a field the interview asks about, or "done"`)
      }
      return
    case 'suggestions':
      if (!isRecord(value) || Object.keys(value).length === 0) {
        problems.push(`${where} must declare at least one kind of suggestion`)
        return
      }
      for (const kind of unknownKeys(
        value,
        new Set(['solutions', 'rationales', 'problemRewrite']),
      )) {
        problems.push(`${where}: unknown key "${kind}"`)
      }
      for (const kind of ['solutions', 'rationales'] as const) {
        if (value[kind] !== undefined) validateCountRange(value[kind], `${where}.${kind}`, problems)
      }
      if (value.problemRewrite !== undefined && typeof value.problemRewrite !== 'boolean') {
        problems.push(`${where}.problemRewrite must be a boolean`)
      }
      return
  }
}

function validateDraft(
  draft: unknown,
  fixture: EvalFixture | undefined,
  priorities: readonly string[],
  file: string,
  problems: string[],
): void {
  if (!isRecord(draft)) {
    problems.push(`${file}: "draft" must be an object`)
    return
  }
  for (const key of unknownKeys(draft, DRAFT_KEYS)) {
    problems.push(`${file}: draft has unknown key "${key}"`)
  }
  for (const key of ['title', 'problem', 'impactRationale', 'description'] as const) {
    if (draft[key] !== undefined && !isNonBlankString(draft[key])) {
      problems.push(`${file}: draft.${key} must be a non-blank string`)
    }
  }
  const solutions = draft.proposedSolutions
  if (
    solutions !== undefined &&
    (!isStringArray(solutions) ||
      solutions.length === 0 ||
      solutions.length > MAX_SOLUTIONS ||
      !solutions.every(isNonBlankString))
  ) {
    problems.push(`${file}: draft.proposedSolutions must hold 1 to ${MAX_SOLUTIONS} items`)
  }
  const options: [string, readonly string[] | undefined][] = [
    ['ideaType', fixture?.ideaTypes.map((o) => o.name)],
    ['businessImpact', fixture?.businessImpacts.map((o) => o.name)],
    ['priority', priorities],
  ]
  for (const [key, names] of options) {
    const value = draft[key]
    if (value !== undefined && (typeof value !== 'string' || (names && !names.includes(value)))) {
      problems.push(`${file}: draft.${key} must name an option`)
    }
  }
  if (
    draft.tags !== undefined &&
    (!isStringArray(draft.tags) || (fixture && !draft.tags.every((t) => fixture.tags.includes(t))))
  ) {
    problems.push(`${file}: draft.tags must name tags of the fixture`)
  }
  if (draft.fieldValues === undefined) return
  if (!isRecord(draft.fieldValues)) {
    problems.push(`${file}: draft.fieldValues must be an object keyed by field name`)
    return
  }
  for (const [name, value] of Object.entries(draft.fieldValues)) {
    const field = fixture?.fields?.find((f) => f.name === name)
    const valid =
      field === undefined
        ? fixture === undefined
        : field.type === 'number'
          ? typeof value === 'number'
          : field.type === 'dropdown'
            ? (field.options ?? []).includes(value as string)
            : isNonBlankString(value)
    if (!valid) problems.push(`${file}: draft.fieldValues.${name} is not a valid value`)
  }
}
