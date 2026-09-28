import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AiTokenUsage, IdeaAssistTurn, IdeaDraft } from '@collega/application/ai'
import type { AssistantVersion, CaseDraft, V2Expectations } from './corpus.ts'
import type { CatalogField, CatalogOption } from './fixture-context.ts'
import type { RunMetrics } from './metrics.ts'
import type { Verdict } from './verdict.ts'

/**
 * The run file of SPEC/20-feature-prompt-eval-runner.md rule 19. `rescore` and `compare`
 * (slice 115) read it back, so a saved run carries everything they need without the corpus.
 */
export const RUN_FILE_SCHEMA_VERSION = 1

export type RunStatus = 'completed' | 'aborted'
export type AbortReason = 'max-calls' | 'max-tokens' | 'unexpected-error'

export interface RunHeader {
  readonly runnerVersion: string
  readonly git: { readonly commit: string | null; readonly dirty: boolean | null }
  readonly label: string
  readonly model: string
  readonly effort: string
  readonly modelOverridden: boolean
  readonly effortOverridden: boolean
  readonly repeats: number
  readonly concurrency: number
  /** The `--case` ids as given, or null when every v1 case ran. */
  readonly caseSelection: readonly string[] | null
  /** The case ids that ran, in run order. */
  readonly cases: readonly string[]
  readonly prompt: { readonly source: string; readonly templateSha256: string }
  readonly caseHashes: Readonly<Record<string, string>>
  readonly fixtureHashes: Readonly<Record<string, string>>
  /** Template-independent fixture hashes; see `PreparedFixture.catalogSha256`. */
  readonly fixtureCatalogHashes: Readonly<Record<string, string>>
  readonly ceilings: { readonly maxCalls: number; readonly maxTokens: number }
  readonly startedAt: string
  readonly endedAt: string
  readonly status: RunStatus
  readonly abortReason: AbortReason | null
  /** Set with `unexpected-error`: a defect, not a provider failure. Key redacted. */
  readonly abortMessage: string | null
}

export interface RunFixture {
  readonly systemPrompt: string
  readonly responseSchema: Record<string, unknown>
  readonly organizationId: string
  readonly ideaTypes: readonly CatalogOption[]
  readonly businessImpacts: readonly CatalogOption[]
  /** v2 fixtures only. */
  readonly fields?: readonly CatalogField[]
}

export interface RunCase {
  readonly fixture: string
  readonly note: string
  readonly pair: string | null
  readonly assistant: AssistantVersion
  readonly turns: readonly string[]
  readonly expect: V2Expectations
  /** v2 cases only, and only when set. */
  readonly draft?: CaseDraft
  readonly lockedFields?: readonly string[]
}

/**
 * The v2 draft on the wire (SPEC/20-feature-ai-idea-assist-v2.md "Contract changes"): options and
 * custom fields by id, tags by name. Provisional until the v2 turn is built.
 */
export interface V2Draft {
  readonly title: string | null
  readonly problem: string | null
  readonly proposedSolutions: readonly string[]
  readonly impactRationale: string | null
  readonly businessImpactId: string | null
  readonly ideaTypeId: string | null
  readonly priority: string | null
  readonly tagNames: readonly string[]
  readonly fieldValues: readonly {
    readonly fieldDefinitionId: string
    readonly value: string | number
  }[]
  readonly description: string | null
}

/**
 * What a v2 turn adds to its record. `rawChanges` is the model's output before the server drops
 * locked fields and unknown ids, which is what the locked-field proposal rate reads (rule 16);
 * `draft` is the draft after the turn, which the survival count and the field scores read.
 */
export interface V2TurnRecord {
  readonly draftSent: V2Draft
  readonly lockedFields: readonly string[]
  readonly rawChanges: Partial<V2Draft> | null
  readonly changes: Partial<V2Draft> | null
  readonly draft: V2Draft | null
  readonly suggestions: {
    readonly solutions?: readonly string[]
    readonly problemRewrite?: string
    readonly rationales?: readonly string[]
  } | null
  readonly nextStep: string | null
}

export interface TurnRecord {
  readonly index: number
  /** The transcript sent: refused user turns already dropped, `nextQuestion`s appended. */
  readonly transcript: readonly IdeaAssistTurn[]
  /** The draft sent with it; null on a v2 turn, whose draft is in `v2`. */
  readonly draftSent: IdeaDraft | null
  /** Null when the call errored. */
  readonly inScope: boolean | null
  readonly nextQuestion: string | null
  /** What the model returned, unvalidated. */
  readonly rawDraft: IdeaDraft | null
  /** What the service would return: `sanitizeDraft` on an in-scope turn, the draft sent on a
   * refusal. */
  readonly sanitizedDraft: IdeaDraft | null
  /** Null when the provider reported nothing (a transport failure). */
  readonly usage: AiTokenUsage | null
  readonly latencyMs: number
  readonly error: string | null
  /** v2 turns only. */
  readonly v2?: V2TurnRecord
}

/**
 * `completed`: every turn ran. `errored`: a turn ended in `IdeaDraftModelError`, so the trial is
 * counted but kept out of every metric denominator. `aborted`: a ceiling stopped it part-way.
 */
export type TrialStatus = 'completed' | 'errored' | 'aborted'

export interface TrialRecord {
  readonly caseId: string
  readonly repeat: number
  readonly status: TrialStatus
  readonly turns: readonly TurnRecord[]
}

export interface RunTotals {
  readonly calls: number
  readonly trials: number
  readonly erroredTrials: number
  readonly abortedTrials: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadInputTokens: number
  readonly cacheCreationInputTokens: number
}

/** What a run collected. `rescore` and `compare` need no more than this. */
export interface RunData {
  readonly schemaVersion: typeof RUN_FILE_SCHEMA_VERSION
  readonly header: RunHeader
  readonly fixtures: Readonly<Record<string, RunFixture>>
  readonly cases: Readonly<Record<string, RunCase>>
  /** In case order, then repeat order - not completion order. */
  readonly trials: readonly TrialRecord[]
  readonly totals: RunTotals
}

export interface RunFile extends RunData {
  /** Rules 13-18, recomputed from `trials` by `rescore`. */
  readonly metrics: RunMetrics
  /** Rules 30-32 against `verdict.baseline`, if one was given. */
  readonly verdict: Verdict
}

export class RunFileReadError extends Error {
  constructor(file: string, reason: string) {
    super(`Cannot read run file ${file}: ${reason}`)
    this.name = 'RunFileReadError'
  }
}

/** A saved run, checked for the shape `rescore` and `compare` rely on. */
export async function readRunFile(file: string): Promise<RunData> {
  let raw: unknown
  try {
    raw = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new RunFileReadError(file, (error as Error).message)
  }
  const run = raw as Partial<RunData> | null
  const header = run?.header as Partial<RunHeader> | undefined
  if (
    run === null ||
    typeof run !== 'object' ||
    run.schemaVersion !== RUN_FILE_SCHEMA_VERSION ||
    typeof header !== 'object' ||
    header === null ||
    !Array.isArray(header.cases) ||
    typeof header.caseHashes !== 'object' ||
    typeof header.fixtureCatalogHashes !== 'object' ||
    !Array.isArray(run.trials) ||
    typeof run.cases !== 'object' ||
    typeof run.fixtures !== 'object'
  ) {
    throw new RunFileReadError(file, `not a schema version ${RUN_FILE_SCHEMA_VERSION} run file`)
  }
  return run as RunData
}

/** `20260928T101500Z` - sortable, and legal in a Windows file name. */
export function fileTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

export function slugLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'run'
  )
}

export class RunFileExistsError extends Error {
  constructor(file: string) {
    super(`${file} already exists; not overwriting it. Re-run, or pass a different --label.`)
    this.name = 'RunFileExistsError'
  }
}

/** Writes the run file and its summary beside it; returns the run file's path. */
export async function writeRunFile(dir: string, run: RunFile, summary: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = path.join(
    dir,
    `${fileTimestamp(new Date(run.header.startedAt))}-${slugLabel(run.header.label)}.json`,
  )
  try {
    // Exclusive, so a second run started in the same second cannot overwrite the first.
    await writeFile(file, `${JSON.stringify(run, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
    await writeFile(file.replace(/\.json$/, '.md'), summary, { encoding: 'utf8', flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new RunFileExistsError(file)
    throw error
  }
  return file
}

/** Commit and dirty flag, or nulls outside a git checkout. */
export function gitState(cwd: string): RunHeader['git'] {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
    const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
    return { commit, dirty: status.trim().length > 0 }
  } catch {
    return { commit: null, dirty: null }
  }
}
