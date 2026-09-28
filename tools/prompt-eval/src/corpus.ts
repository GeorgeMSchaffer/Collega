import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * The corpus as `tools/prompt-eval/README.md` describes it, validated by hand
 * (SPEC/20-feature-prompt-eval-runner.md rules 1-3). Validation is strict about unknown keys so a
 * misspelt expectation fails loudly rather than going unscored.
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

export interface EvalCase {
  readonly id: string
  readonly fixture: string
  readonly note: string
  readonly turns: readonly string[]
  readonly expect: V1Expectations
  readonly pair: string | null
  readonly assistant: AssistantVersion
  /** The file it was read from, relative to the corpus root - for error messages only. */
  readonly file: string
}

export interface FixtureOption {
  readonly name: string
  readonly fieldNames?: readonly string[]
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

const CASE_KEYS = new Set(['id', 'fixture', 'note', 'turns', 'expect', 'pair', 'assistant'])
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
])
const EXPECT_BOOLEAN_KEYS = new Set(['inScope', 'titleSet', 'descriptionSet'])
const EXPECT_OPTION_KEYS = new Set(['ideaType', 'businessImpact', 'priority'])
const ASSISTANT_VERSIONS: readonly string[] = ['v1', 'v2', 'both']

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
  const allowed = new Set(allowFieldNames ? ['name', 'fieldNames'] : ['name'])
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
    if (option.fieldNames !== undefined && !isStringArray(option.fieldNames)) {
      problems.push(`${where}: "fieldNames" must be an array of strings`)
      return
    }
    // Ids are derived from names, so two options sharing a name would share an id.
    if (options.some((o) => o.name === option.name)) {
      problems.push(`${where}: duplicate name "${option.name}"`)
      return
    }
    options.push(
      option.fieldNames === undefined
        ? { name: option.name }
        : { name: option.name, fieldNames: option.fieldNames as string[] },
    )
  })
  return options
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

  if (!isRecord(raw.expect) || Object.keys(raw.expect).length === 0) {
    problems.push(`${file}: "expect" must be an object declaring at least one expectation`)
  } else {
    validateExpect(raw.expect, fixture, priorities, file, problems)
  }
  if (problems.length > before) return null

  return {
    id: raw.id as string,
    fixture: raw.fixture as string,
    note: raw.note as string,
    turns: raw.turns as string[],
    expect: raw.expect as V1Expectations,
    pair: (raw.pair as string | undefined) ?? null,
    assistant: (raw.assistant as AssistantVersion | undefined) ?? 'v1',
    file,
  }
}

function validateExpect(
  expect: Record<string, unknown>,
  fixture: EvalFixture | undefined,
  priorities: readonly string[],
  file: string,
  problems: string[],
): void {
  for (const [key, value] of Object.entries(expect)) {
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
