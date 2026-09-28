import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { AiTokenUsage, IdeaAssistTurn, IdeaDraft } from '@collega/application/ai'
import type { AssistantVersion, V1Expectations } from './corpus.ts'
import type { CatalogOption } from './fixture-context.ts'

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
}

export interface RunCase {
  readonly fixture: string
  readonly note: string
  readonly pair: string | null
  readonly assistant: AssistantVersion
  readonly turns: readonly string[]
  readonly expect: V1Expectations
}

export interface TurnRecord {
  readonly index: number
  /** The transcript sent: refused user turns already dropped, `nextQuestion`s appended. */
  readonly transcript: readonly IdeaAssistTurn[]
  /** The draft sent with it. */
  readonly draftSent: IdeaDraft
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

export interface RunFile {
  readonly schemaVersion: typeof RUN_FILE_SCHEMA_VERSION
  readonly header: RunHeader
  readonly fixtures: Readonly<Record<string, RunFixture>>
  readonly cases: Readonly<Record<string, RunCase>>
  /** In case order, then repeat order - not completion order. */
  readonly trials: readonly TrialRecord[]
  readonly totals: RunTotals
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

export async function writeRunFile(dir: string, run: RunFile): Promise<string> {
  await mkdir(dir, { recursive: true })
  const file = path.join(
    dir,
    `${fileTimestamp(new Date(run.header.startedAt))}-${slugLabel(run.header.label)}.json`,
  )
  await writeFile(file, `${JSON.stringify(run, null, 2)}\n`, 'utf8')
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
