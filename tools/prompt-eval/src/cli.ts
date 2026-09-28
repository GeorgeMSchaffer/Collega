// The prompt-eval runner (SPEC/20-feature-prompt-eval-runner.md). Invoked through the package's
// `eval` script, which Turbo never runs:
//
//   pnpm --filter @collega/prompt-eval eval [--dry-run] [options]
//   pnpm --filter @collega/prompt-eval eval dump-prompt --fixture <name> [--prompt-file <path>]
//
// Imports the application and infrastructure from their dist/ builds, so `pnpm build` comes first.
//
// `pnpm --filter` reports any failing script as exit 1. Where the runner's own code matters (2 is
// "not a valid run"), use `pnpm -C tools/prompt-eval eval` or `node tools/prompt-eval/src/cli.ts`.

import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { IdeaDraftModel } from '@collega/application/ai'
import { DEFAULT_AI_USAGE_LIMITS } from '@collega/application/ai'
import type { AnthropicIdeaDraftModelConfig } from '@collega/infrastructure/integrations/ai'
import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import { type Corpus, CorpusError, type EvalCase, loadCorpus } from './corpus.ts'
import { KEY_VARIABLE, readEvaluationKey, redact } from './credentials.ts'
import {
  caseContentSha256,
  type PreparedFixture,
  prepareFixture,
  schemaPriorities,
} from './fixture-context.ts'
import { loadPromptSource, PromptFileError, type PromptSource } from './prompt-source.ts'
import {
  gitState,
  RUN_FILE_SCHEMA_VERSION,
  type RunCase,
  type RunFile,
  RunFileExistsError,
  type RunFixture,
  writeRunFile,
} from './run-file.ts'
import { runTrials, type Stopwatch, type TrialSpec } from './turn-loop.ts'

const RUNNER_VERSION = '0.1.0'
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..')

/**
 * Everything ambient a live run touches. `main` defaults each to the real thing; a hermetic check
 * passes its own - an adapter built on a fake client, a fixed clock, a scratch directory.
 */
export interface RunnerDeps {
  readonly env: NodeJS.ProcessEnv
  /** The root `.env`, read for the key alone. */
  readonly envFile: string
  readonly runsDir: string
  readonly createModel: (config: AnthropicIdeaDraftModelConfig) => IdeaDraftModel
  readonly now: () => Date
  readonly stopwatch: Stopwatch
}

const DEFAULT_DEPS: RunnerDeps = {
  env: process.env,
  envFile: path.join(REPO_ROOT, '.env'),
  runsDir: path.join(PACKAGE_ROOT, 'runs'),
  createModel: (config) => new AnthropicIdeaDraftModel(config),
  now: () => new Date(),
  stopwatch: { elapsedMs: () => performance.now() },
}

const EXIT_OK = 0
const EXIT_INVALID = 2

/** Rule 40: a live run above this many planned calls needs `--yes`. */
const CONFIRM_ABOVE_CALLS = 100
/** Rule 30: above this share of errored trials a run is not valid. */
const MAX_ERRORED_SHARE = 0.1
const EFFORTS: readonly string[] = ['low', 'medium', 'high', 'max']
/** A rough characters-per-token ratio for the dry-run estimate only. */
const CHARS_PER_TOKEN = 4

class UsageError extends Error {}

interface Options {
  readonly command: 'run' | 'dump-prompt'
  readonly dryRun: boolean
  readonly cases: readonly string[] | null
  readonly repeats: number
  readonly concurrency: number
  readonly promptFile: string | undefined
  readonly maxCalls: number
  readonly maxTokens: number
  readonly model: string
  readonly effort: string
  readonly yes: boolean
  readonly label: string | undefined
  readonly fixture: string | undefined
}

function parseOptions(argv: readonly string[]): Options {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(argv)
  } catch (error) {
    throw new UsageError((error as Error).message)
  }
  const { values, positionals } = parsed

  const [command = 'run', ...extra] = positionals
  if (command === 'compare' || command === 'rescore') {
    throw new UsageError(`"${command}" is not built yet.`)
  }
  if (command !== 'run' && command !== 'dump-prompt') {
    throw new UsageError(`Unknown command "${command}".`)
  }
  if (extra.length > 0) throw new UsageError(`Unexpected argument: ${extra.join(' ')}`)

  const effort = values.effort ?? DEFAULT_AI_USAGE_LIMITS.effort
  if (!EFFORTS.includes(effort)) {
    // The adapter would quietly run anything else at `low` while the header said otherwise.
    throw new UsageError(`--effort must be one of ${EFFORTS.join(', ')}.`)
  }
  const model = values.model ?? DEFAULT_AI_USAGE_LIMITS.model
  if (model.trim().length === 0) throw new UsageError('--model must not be blank.')

  if (command === 'dump-prompt' && values.fixture === undefined) {
    throw new UsageError('dump-prompt needs --fixture <name>.')
  }

  return {
    command,
    dryRun: values['dry-run'] ?? false,
    cases: values.case && values.case.length > 0 ? values.case : null,
    repeats: positiveInteger(values.repeats, 5, '--repeats'),
    concurrency: positiveInteger(values.concurrency, 1, '--concurrency'),
    promptFile: values['prompt-file'],
    maxCalls: positiveInteger(values['max-calls'], 200, '--max-calls'),
    maxTokens: positiveInteger(values['max-tokens'], 1_000_000, '--max-tokens'),
    model,
    effort,
    yes: values.yes ?? false,
    label: values.label,
    fixture: values.fixture,
  }
}

function parse(argv: readonly string[]) {
  return parseArgs({
    args: [...argv],
    allowPositionals: true,
    strict: true,
    options: {
      'dry-run': { type: 'boolean' },
      case: { type: 'string', multiple: true },
      repeats: { type: 'string' },
      concurrency: { type: 'string' },
      'prompt-file': { type: 'string' },
      'max-calls': { type: 'string' },
      'max-tokens': { type: 'string' },
      model: { type: 'string' },
      effort: { type: 'string' },
      yes: { type: 'boolean' },
      label: { type: 'string' },
      fixture: { type: 'string' },
    },
  })
}

function positiveInteger(raw: string | undefined, fallback: number, flag: string): number {
  if (raw === undefined) return fallback
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    throw new UsageError(`${flag} must be a positive whole number.`)
  }
  return Number(raw)
}

/** Cases the v1 turn runs: `assistant` of `v1` or `both`, narrowed by `--case`. */
function selectCases(corpus: Corpus, requested: readonly string[] | null): EvalCase[] {
  const runnable = corpus.cases.filter((c) => c.assistant !== 'v2')
  if (requested === null) return runnable
  const unknown = requested.filter((id) => !runnable.some((c) => c.id === id))
  if (unknown.length > 0) {
    throw new UsageError(`Unknown or non-v1 case: ${unknown.join(', ')}.`)
  }
  return runnable.filter((c) => requested.includes(c.id))
}

function prepareAll(corpus: Corpus, prompt: PromptSource): Map<string, PreparedFixture> {
  return new Map(
    [...corpus.fixtures.values()].map((f) => [f.name, prepareFixture(f, prompt.prompts)]),
  )
}

/** Input tokens for one call, before the model has said anything: prompt, schema and turns. */
function estimateInputTokens(fixture: PreparedFixture, userTurns: readonly string[]): number {
  const characters =
    fixture.systemPrompt.length +
    JSON.stringify(fixture.responseSchema).length +
    userTurns.reduce((sum, t) => sum + t.length, 0)
  return Math.ceil(characters / CHARS_PER_TOKEN)
}

function plannedCalls(cases: readonly EvalCase[], repeats: number): number {
  return cases.reduce((sum, c) => sum + c.turns.length, 0) * repeats
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function printDryRun(
  options: Options,
  prompt: PromptSource,
  cases: readonly EvalCase[],
  fixtures: ReadonlyMap<string, PreparedFixture>,
): void {
  const calls = plannedCalls(cases, options.repeats)
  let inputTokens = 0
  for (const c of cases) {
    const fixture = fixtures.get(c.fixture) as PreparedFixture
    for (let t = 1; t <= c.turns.length; t++) {
      inputTokens += estimateInputTokens(fixture, c.turns.slice(0, t)) * options.repeats
    }
  }

  const out: string[] = []
  out.push('Dry run - no key read, no network.')
  out.push('')
  out.push(`Prompt     ${prompt.source}  sha256 ${prompt.templateSha256}`)
  out.push(`Model      ${options.model}${overriddenNote(options.model, 'model')}`)
  out.push(`Effort     ${options.effort}${overriddenNote(options.effort, 'effort')}`)
  out.push(`Repeats    ${options.repeats}    Concurrency ${options.concurrency}`)
  out.push(
    `Ceilings   ${formatNumber(options.maxCalls)} calls, ${formatNumber(options.maxTokens)} tokens`,
  )
  out.push('')
  out.push('Fixtures (every one rendered)')
  for (const f of fixtures.values()) {
    out.push(
      `  ${f.name.padEnd(18)} prompt ${formatNumber(f.systemPrompt.length).padStart(6)} chars` +
        `  schema ${formatNumber(JSON.stringify(f.responseSchema).length).padStart(5)} chars` +
        `  sha256 ${f.contentSha256.slice(0, 12)}`,
    )
  }
  out.push('')
  out.push('Cases')
  for (const c of cases) {
    const pair = c.pair === null ? '' : `  pair ${c.pair}`
    out.push(
      `  ${c.id.padEnd(28)} ${c.fixture.padEnd(16)} ${c.turns.length} turn(s) x ${options.repeats}` +
        ` = ${c.turns.length * options.repeats} calls${pair}`,
    )
  }
  out.push('')
  out.push(`Planned    ${formatNumber(calls)} calls across ${cases.length} cases`)
  out.push(
    `Estimate   ~${formatNumber(inputTokens)} input tokens (characters / ${CHARS_PER_TOKEN}; ` +
      'before caching, without assistant replies, output or thinking)',
  )
  if (calls > options.maxCalls) {
    out.push(
      `Warning    the plan exceeds --max-calls; a live run would abort at call ${options.maxCalls}.`,
    )
  }
  if (calls > CONFIRM_ABOVE_CALLS) {
    out.push(`Note       a live run of more than ${CONFIRM_ABOVE_CALLS} calls needs --yes.`)
  }
  console.log(out.join('\n'))
}

function overriddenNote(value: string, key: 'model' | 'effort'): string {
  return value === DEFAULT_AI_USAGE_LIMITS[key] ? '' : '  (overridden)'
}

async function liveRun(
  deps: RunnerDeps,
  options: Options,
  prompt: PromptSource,
  cases: readonly EvalCase[],
  fixtures: ReadonlyMap<string, PreparedFixture>,
): Promise<number> {
  const calls = plannedCalls(cases, options.repeats)
  if (calls > CONFIRM_ABOVE_CALLS && !options.yes) {
    console.error(
      `This run plans ${calls} calls, above ${CONFIRM_ABOVE_CALLS}. Re-run with --yes to spend them.`,
    )
    return EXIT_INVALID
  }

  const key = await readEvaluationKey(deps.env, deps.envFile)
  if (key === null) {
    console.error(
      `${KEY_VARIABLE} is not set, in the environment or the root .env. A live run needs the ` +
        'dedicated evaluation key; ANTHROPIC_API_KEY is never read.',
    )
    return EXIT_INVALID
  }

  const model = deps.createModel({
    apiKey: key,
    model: options.model,
    effort: options.effort,
  })

  const used = new Set(cases.map((c) => c.fixture))
  const specs: TrialSpec[] = cases.flatMap((evalCase) =>
    Array.from({ length: options.repeats }, (_, repeat) => ({
      evalCase,
      repeat,
      context: (fixtures.get(evalCase.fixture) as PreparedFixture).context,
    })),
  )

  const startedAt = deps.now()
  console.log(
    `Running ${specs.length} trials (${calls} calls planned) on ${options.model} at ${options.effort}.`,
  )
  const result = await runTrials(specs, {
    model,
    ceilings: { maxCalls: options.maxCalls, maxTokens: options.maxTokens },
    concurrency: options.concurrency,
    stopwatch: deps.stopwatch,
    redact: (text) => redact(text, key),
    onTrial: (trial) => {
      const last = trial.turns[trial.turns.length - 1]
      const outcome =
        trial.status !== 'completed' ? trial.status : last.inScope ? 'in scope' : 'refused'
      console.log(`  ${trial.caseId.padEnd(28)} #${trial.repeat + 1}  ${outcome}`)
    },
  })
  const endedAt = deps.now()

  const pick = <T>(record: ReadonlyMap<string, T>, keys: Iterable<string>) =>
    Object.fromEntries([...keys].map((k) => [k, record.get(k) as T]))
  const usedFixtures = pick(fixtures, [...used].sort())

  const run: RunFile = {
    schemaVersion: RUN_FILE_SCHEMA_VERSION,
    header: {
      runnerVersion: RUNNER_VERSION,
      git: gitState(REPO_ROOT),
      label: options.label ?? labelFor(prompt),
      model: options.model,
      effort: options.effort,
      modelOverridden: options.model !== DEFAULT_AI_USAGE_LIMITS.model,
      effortOverridden: options.effort !== DEFAULT_AI_USAGE_LIMITS.effort,
      repeats: options.repeats,
      concurrency: options.concurrency,
      caseSelection: options.cases,
      cases: cases.map((c) => c.id),
      prompt: { source: prompt.source, templateSha256: prompt.templateSha256 },
      caseHashes: Object.fromEntries(cases.map((c) => [c.id, caseContentSha256(c)])),
      fixtureHashes: mapValues(usedFixtures, (f) => f.contentSha256),
      fixtureCatalogHashes: mapValues(usedFixtures, (f) => f.catalogSha256),
      ceilings: { maxCalls: options.maxCalls, maxTokens: options.maxTokens },
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      status: result.abortReason === null ? 'completed' : 'aborted',
      abortReason: result.abortReason,
      abortMessage: result.abortMessage,
    },
    fixtures: mapValues(
      usedFixtures,
      (f): RunFixture => ({
        systemPrompt: f.systemPrompt,
        responseSchema: f.responseSchema,
        organizationId: f.catalog.organizationId,
        ideaTypes: f.catalog.ideaTypes,
        businessImpacts: f.catalog.businessImpacts,
      }),
    ),
    cases: Object.fromEntries(
      cases.map((c): [string, RunCase] => [
        c.id,
        {
          fixture: c.fixture,
          note: c.note,
          pair: c.pair,
          assistant: c.assistant,
          turns: c.turns,
          expect: c.expect,
        },
      ]),
    ),
    trials: result.trials,
    totals: {
      calls: result.calls,
      trials: result.trials.length,
      erroredTrials: result.trials.filter((t) => t.status === 'errored').length,
      abortedTrials: result.trials.filter((t) => t.status === 'aborted').length,
      ...result.tokens,
    },
  }

  const file = await writeRunFile(deps.runsDir, run)
  const t = run.totals
  console.log('')
  console.log(`Run file   ${path.relative(REPO_ROOT, file)}`)
  console.log(
    `Status     ${run.header.status}${run.header.abortReason ? ` (${run.header.abortReason})` : ''}`,
  )
  console.log(`Trials     ${t.trials}, ${t.erroredTrials} errored, ${t.abortedTrials} aborted`)
  console.log(
    `Tokens     ${formatNumber(t.inputTokens)} in, ${formatNumber(t.outputTokens)} out, ` +
      `${formatNumber(t.cacheReadInputTokens)} cache read, ` +
      `${formatNumber(t.cacheCreationInputTokens)} cache write, over ${t.calls} calls`,
  )
  if (run.header.abortMessage !== null) console.error(`Stopped by: ${run.header.abortMessage}`)

  if (run.header.status === 'aborted') return EXIT_INVALID
  if (t.trials > 0 && t.erroredTrials / t.trials > MAX_ERRORED_SHARE) {
    console.error(`More than ${MAX_ERRORED_SHARE * 100}% of trials errored; the run is not valid.`)
    return EXIT_INVALID
  }
  return EXIT_OK
}

function labelFor(prompt: PromptSource): string {
  return prompt.source === 'default' ? 'default' : path.parse(prompt.source).name
}

function mapValues<T, U>(record: Record<string, T>, fn: (value: T) => U): Record<string, U> {
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, fn(v)]))
}

export async function main(
  argv: readonly string[],
  deps: RunnerDeps = DEFAULT_DEPS,
): Promise<number> {
  try {
    const options = parseOptions(argv)
    const prompt = await loadPromptSource(options.promptFile)
    const corpus = await loadCorpus(PACKAGE_ROOT, schemaPriorities())
    const fixtures = prepareAll(corpus, prompt)

    if (options.command === 'dump-prompt') {
      const fixture = fixtures.get(options.fixture as string)
      if (fixture === undefined) throw new UsageError(`Unknown fixture "${options.fixture}".`)
      process.stdout.write(`${fixture.systemPrompt}\n`)
      return EXIT_OK
    }

    const cases = selectCases(corpus, options.cases)
    if (options.dryRun) {
      printDryRun(options, prompt, cases, fixtures)
      return EXIT_OK
    }
    return await liveRun(deps, options, prompt, cases, fixtures)
  } catch (error) {
    if (
      error instanceof UsageError ||
      error instanceof CorpusError ||
      error instanceof PromptFileError ||
      error instanceof RunFileExistsError
    ) {
      console.error(error.message)
      return EXIT_INVALID
    }
    // Exit 1 means "thresholds failed" (rule 30), so a defect must not borrow it.
    console.error(error)
    return EXIT_INVALID
  }
}

if (
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await main(process.argv.slice(2))
}
