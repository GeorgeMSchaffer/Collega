// The prompt-eval runner (SPEC/20-feature-prompt-eval-runner.md). Invoked through the package's
// `eval` script, which Turbo never runs (rule 40):
//
//   pnpm -C tools/prompt-eval eval [--dry-run] [--baseline <file>] [options]
//   pnpm -C tools/prompt-eval eval dump-prompt --fixture <name> [--prompt-file <path>]
//   pnpm -C tools/prompt-eval eval rescore <run.json> [--baseline <file>]
//   pnpm -C tools/prompt-eval eval compare <baseline.json> <candidate.json>
//
// Imports the application and infrastructure from their dist/ builds, so `pnpm build` comes first.
// `pnpm --filter` also works but reports any failure as exit 1, hiding exit 2 ("not a valid run").

import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import type { IdeaDraftModel } from '@collega/application/ai'
import { DEFAULT_AI_USAGE_LIMITS } from '@collega/application/ai'
import type { AnthropicIdeaDraftModelConfig } from '@collega/infrastructure/integrations/ai'
import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import { compareRuns } from './compare.ts'
import { type Corpus, CorpusError, type EvalCase, loadCorpus } from './corpus.ts'
import { KEY_VARIABLE, readEvaluationKey, redact } from './credentials.ts'
import {
  caseContentSha256,
  type PreparedFixture,
  prepareFixture,
  schemaPriorities,
} from './fixture-context.ts'
import { computeMetrics } from './metrics.ts'
import { loadPromptSource, PromptFileError, type PromptSource } from './prompt-source.ts'
import {
  gitState,
  RUN_FILE_SCHEMA_VERSION,
  type RunCase,
  type RunData,
  RunFileExistsError,
  RunFileReadError,
  type RunFixture,
  type RunHeader,
  readRunFile,
  writeRunFile,
} from './run-file.ts'
import { renderSummary } from './summary.ts'
import { runTrials, type Stopwatch, type TrialSpec } from './turn-loop.ts'
import { type Baseline, EXIT_INVALID, EXIT_PASS, judge } from './verdict.ts'

const RUNNER_VERSION = '0.1.0'
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..')

/**
 * Everything ambient a live run touches. `main` defaults each to the real thing; a hermetic check
 * passes its own - an adapter built on a fake client, a fixed clock, a scratch directory.
 */
export interface RunnerDeps {
  readonly env: NodeJS.ProcessEnv
  /** The root `.env.local` then `.env`, read for the key alone. */
  readonly envFile: string | readonly string[]
  readonly runsDir: string
  /** Holds `cases/` and `fixtures/`. */
  readonly corpusRoot: string
  readonly git: () => RunHeader['git']
  readonly createModel: (config: AnthropicIdeaDraftModelConfig) => IdeaDraftModel
  readonly now: () => Date
  readonly stopwatch: Stopwatch
}

const DEFAULT_DEPS: RunnerDeps = {
  env: process.env,
  envFile: [path.join(REPO_ROOT, '.env.local'), path.join(REPO_ROOT, '.env')],
  runsDir: path.join(PACKAGE_ROOT, 'runs'),
  corpusRoot: PACKAGE_ROOT,
  git: () => gitState(REPO_ROOT),
  createModel: (config) => new AnthropicIdeaDraftModel(config),
  now: () => new Date(),
  stopwatch: { elapsedMs: () => performance.now() },
}

/** Rule 40: a live run above this many planned calls needs `--yes`. */
const CONFIRM_ABOVE_CALLS = 100
const EFFORTS: readonly string[] = ['low', 'medium', 'high', 'max']
/** A rough characters-per-token ratio for the dry-run estimate only. */
const CHARS_PER_TOKEN = 4

class UsageError extends Error {}

interface Options {
  readonly command: 'run' | 'dump-prompt' | 'rescore' | 'compare'
  /** The run file(s) `rescore` and `compare` read. */
  readonly files: readonly string[]
  readonly baseline: string | undefined
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

  const [command = 'run', ...files] = positionals
  if (
    command !== 'run' &&
    command !== 'dump-prompt' &&
    command !== 'rescore' &&
    command !== 'compare'
  ) {
    throw new UsageError(`Unknown command "${command}".`)
  }
  const expectedFiles = command === 'rescore' ? 1 : command === 'compare' ? 2 : 0
  if (files.length !== expectedFiles) {
    throw new UsageError(
      command === 'rescore'
        ? 'rescore takes one run file: rescore <run.json> [--baseline <file>].'
        : command === 'compare'
          ? 'compare takes two run files: compare <baseline.json> <candidate.json>.'
          : `Unexpected argument: ${files.join(' ')}`,
    )
  }
  if (values.baseline !== undefined && command !== 'run' && command !== 'rescore') {
    throw new UsageError('--baseline applies to a live run and to rescore.')
  }

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
    files,
    baseline: values.baseline,
    dryRun: values['dry-run'] ?? false,
    cases: values.case && values.case.length > 0 ? [...new Set(values.case)] : null,
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
      baseline: { type: 'string' },
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
  v2Only: readonly EvalCase[],
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
  if (v2Only.length > 0) {
    out.push(
      `Validated, not run (${v2Only.length} v2 cases; the v2 turn is not built): ${v2Only.map((c) => c.id).join(', ')}`,
    )
    out.push('')
  }
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

  // Read before anything is spent, so an unreadable baseline costs nothing.
  const baseline = options.baseline === undefined ? null : await loadBaseline(options.baseline)

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

  const data: RunData = {
    schemaVersion: RUN_FILE_SCHEMA_VERSION,
    header: {
      runnerVersion: RUNNER_VERSION,
      git: deps.git(),
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
        ...(f.catalog.fields === undefined ? {} : { fields: f.catalog.fields }),
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
          ...(c.draft === null ? {} : { draft: c.draft }),
          ...(c.lockedFields.length === 0 ? {} : { lockedFields: c.lockedFields }),
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

  const metrics = computeMetrics(data)
  const verdict = judge(data, metrics, baseline)
  const summary = renderSummary(data, metrics, verdict)
  const file = await writeRunFile(deps.runsDir, { ...data, metrics, verdict }, summary)
  if (data.header.abortMessage !== null) console.error(`Stopped by: ${data.header.abortMessage}`)
  console.log('')
  console.log(summary)
  console.log(`Run file: ${path.relative(REPO_ROOT, file)} (summary beside it, .md)`)
  return verdict.exitCode
}

async function loadBaseline(file: string): Promise<Baseline> {
  const run = await readRunFile(file)
  // Relative to the repository, so a verdict names the same baseline on every machine.
  const relative = path.relative(REPO_ROOT, path.resolve(file)).split(path.sep).join('/')
  return { path: relative, run, metrics: computeMetrics(run) }
}

/** Rule 29: the metrics and verdict again from a saved run, with no key and no call. */
async function rescore(options: Options): Promise<number> {
  const run = await readRunFile(options.files[0])
  const baseline = options.baseline === undefined ? null : await loadBaseline(options.baseline)
  const metrics = computeMetrics(run)
  const verdict = judge(run, metrics, baseline)
  console.log(renderSummary(run, metrics, verdict))
  return verdict.exitCode
}

async function compare(options: Options): Promise<number> {
  const [baseline, candidate] = await Promise.all(options.files.map(loadBaseline))
  const { text, exitCode } = compareRuns(baseline, candidate)
  console.log(text)
  return exitCode
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
    if (options.command === 'rescore') return await rescore(options)
    if (options.command === 'compare') return await compare(options)

    const prompt = await loadPromptSource(options.promptFile)
    const corpus = await loadCorpus(deps.corpusRoot, schemaPriorities())
    const fixtures = prepareAll(corpus, prompt)

    if (options.command === 'dump-prompt') {
      const fixture = fixtures.get(options.fixture as string)
      if (fixture === undefined) throw new UsageError(`Unknown fixture "${options.fixture}".`)
      process.stdout.write(`${fixture.systemPrompt}\n`)
      return EXIT_PASS
    }

    const cases = selectCases(corpus, options.cases)
    if (options.dryRun) {
      // Read as a live run would, so a bad --baseline fails here rather than after the spend.
      const baseline = options.baseline === undefined ? null : await loadBaseline(options.baseline)
      const v2Only = corpus.cases.filter((c) => c.assistant === 'v2')
      printDryRun(options, prompt, cases, fixtures, v2Only)
      if (baseline !== null) {
        console.log(`Baseline   ${baseline.path} (${baseline.run.trials.length} trials, readable)`)
      }
      return EXIT_PASS
    }
    return await liveRun(deps, options, prompt, cases, fixtures)
  } catch (error) {
    if (
      error instanceof UsageError ||
      error instanceof CorpusError ||
      error instanceof PromptFileError ||
      error instanceof RunFileExistsError ||
      error instanceof RunFileReadError
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
