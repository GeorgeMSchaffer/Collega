// Shared scaffolding for the hermetic self-tests (SPEC/20-feature-prompt-eval-runner.md rule 39):
// a fake Anthropic client, fixed time, scratch directories and hand-built run files. Nothing here
// can reach a provider.

import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { AiTokenUsage, IdeaDraft, IdeaDraftModel } from '@collega/application/ai'
import type { AnthropicIdeaDraftModelConfig } from '@collega/infrastructure/integrations/ai'
import { AnthropicIdeaDraftModel } from '@collega/infrastructure/integrations/ai'
import type { RunnerDeps } from '../src/cli.ts'
import { nameDerivedId } from '../src/hashing.ts'
import type {
  RunCase,
  RunData,
  RunFixture,
  TrialRecord,
  TrialStatus,
  TurnRecord,
  V2Draft,
  V2TurnRecord,
} from '../src/run-file.ts'

// Rule 39: nothing in `pnpm check` reaches a provider. A real SDK client built by mistake would
// fetch through this and fail loudly instead of making a billed call.
globalThis.fetch = () => {
  throw new Error('The prompt-eval self-tests make no network call.')
}

export const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Shaped like an Anthropic key so the pattern redaction would also catch it. */
export const TEST_KEY = 'sk-ant-eval-TESTONLY-0123456789abcdef'

const scratchDirs: string[] = []
// Registered at import, so it is a file-level hook and runs once every test in the file is done.
after(async () => {
  await Promise.all(scratchDirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

/** A fresh temporary directory, removed when the test file finishes. */
export async function scratchDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'prompt-eval-test-'))
  scratchDirs.push(dir)
  return dir
}

/** A copy of the real corpus, for tests that break a file. */
export async function copyCorpus(): Promise<string> {
  const root = await scratchDir()
  await cp(path.join(PACKAGE_ROOT, 'cases'), path.join(root, 'cases'), { recursive: true })
  await cp(path.join(PACKAGE_ROOT, 'fixtures'), path.join(root, 'fixtures'), { recursive: true })
  return root
}

export interface Captured<T> {
  readonly result: T
  readonly stdout: string
  readonly stderr: string
}

/** Runs `fn` with console and stdout captured, so a test can read what the CLI printed. */
export async function capture<T>(fn: () => Promise<T>): Promise<Captured<T>> {
  const out: string[] = []
  const err: string[] = []
  const log = console.log
  const error = console.error
  const write = process.stdout.write
  const text = (args: unknown[]) =>
    args.map((a) => (a instanceof Error ? (a.stack ?? a.message) : String(a))).join(' ')
  console.log = (...args: unknown[]) => void out.push(`${text(args)}\n`)
  console.error = (...args: unknown[]) => void err.push(`${text(args)}\n`)
  process.stdout.write = ((chunk: string | Uint8Array) => {
    out.push(String(chunk))
    return true
  }) as typeof process.stdout.write
  try {
    const result = await fn()
    return { result, stdout: out.join(''), stderr: err.join('') }
  } finally {
    console.log = log
    console.error = error
    process.stdout.write = write
  }
}

// ---------------------------------------------------------------------------------------------
// A fake Anthropic client for the real adapter, answering like a perfect model.
// ---------------------------------------------------------------------------------------------

interface CorpusCase {
  readonly id: string
  readonly fixture: string
  readonly turns: readonly string[]
  readonly expect: Record<string, unknown>
}

async function corpusCases(): Promise<CorpusCase[]> {
  const { readdir } = await import('node:fs/promises')
  const dir = path.join(PACKAGE_ROOT, 'cases')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))))
}

export type Responder = (userText: string, callIndex: number) => FakeReply

export type FakeReply =
  | { readonly kind: 'json'; readonly body: Record<string, unknown>; readonly usage?: FakeUsage }
  | { readonly kind: 'throw'; readonly error: Error }
  | { readonly kind: 'refusal'; readonly usage?: FakeUsage }

export interface FakeUsage {
  readonly input_tokens: number
  readonly output_tokens: number
  readonly cache_read_input_tokens: number
  readonly cache_creation_input_tokens: number
}

export const USAGE: FakeUsage = {
  input_tokens: 100,
  output_tokens: 20,
  cache_read_input_tokens: 50,
  cache_creation_input_tokens: 10,
}

/**
 * A responder that answers every corpus turn as the case expects: refusal cases refused, in-scope
 * cases with the expected option ids and a title and description. Keyed by the turn's text.
 */
export async function perfectResponder(): Promise<Responder> {
  const byTurn = new Map<string, CorpusCase>()
  for (const c of await corpusCases()) for (const t of c.turns) byTurn.set(t, c)
  return (userText) => {
    const c = [...byTurn.entries()].find(([turn]) => userText.endsWith(turn))?.[1]
    if (c === undefined) throw new Error(`no corpus turn for: ${userText.slice(-60)}`)
    if (c.expect.inScope === false) {
      return { kind: 'json', body: { inScope: false, nextQuestion: 'Out of scope.' } }
    }
    const id = (kind: string, name: unknown) =>
      typeof name === 'string' ? nameDerivedId(`${c.fixture}/${kind}/${name}`) : null
    return {
      kind: 'json',
      body: {
        inScope: true,
        nextQuestion: 'What else?',
        title: 'A title',
        description: 'A description',
        ideaTypeId: id('ideaType', c.expect.ideaType),
        businessImpactId: id('businessImpact', c.expect.businessImpact),
        priority: null,
      },
    }
  }
}

export interface FakeClient {
  // biome-ignore lint/suspicious/noExplicitAny: stands in for the SDK's client type
  readonly client: any
  readonly requests: Record<string, unknown>[]
}

/** The adapter's test seam: an object with `messages.create`, never the SDK's own client. */
export function fakeAnthropic(responder: Responder): FakeClient {
  const requests: Record<string, unknown>[] = []
  const client = {
    messages: {
      create: async (params: Record<string, unknown>) => {
        requests.push(params)
        const messages = params.messages as { role: string; content: string }[]
        const reply = responder(messages[messages.length - 1].content, requests.length - 1)
        if (reply.kind === 'throw') throw reply.error
        if (reply.kind === 'refusal') {
          return { content: [], stop_reason: 'refusal', usage: reply.usage ?? USAGE }
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(reply.body) }],
          stop_reason: 'end_turn',
          usage: reply.usage ?? USAGE,
        }
      },
    },
  }
  return { client, requests }
}

export interface TestDeps extends RunnerDeps {
  /** Every configuration `createModel` was called with. */
  readonly modelConfigs: AnthropicIdeaDraftModelConfig[]
}

/**
 * Hermetic deps: the real adapter on `client`, a fixed clock, a stopwatch that advances 10 ms per
 * reading, a scratch runs directory and no `.env`.
 */
export function testDeps(
  client: FakeClient | null,
  overrides: Partial<RunnerDeps> & { runsDir: string },
): TestDeps {
  const modelConfigs: AnthropicIdeaDraftModelConfig[] = []
  let ticks = 0
  return {
    env: {},
    envFile: path.join(overrides.runsDir, 'no-such.env'),
    corpusRoot: PACKAGE_ROOT,
    git: () => ({ commit: 'abc123', dirty: false }),
    createModel: (config): IdeaDraftModel => {
      modelConfigs.push(config)
      if (client === null) throw new Error('createModel must not be called here')
      return new AnthropicIdeaDraftModel(config, client.client)
    },
    now: () => new Date('2026-09-28T10:15:00.000Z'),
    stopwatch: { elapsedMs: () => (ticks += 10) },
    ...overrides,
    modelConfigs,
  }
}

// ---------------------------------------------------------------------------------------------
// Hand-built run files with known answers, for the scorer.
// ---------------------------------------------------------------------------------------------

export const FIXTURE: RunFixture = {
  systemPrompt: 'prompt',
  responseSchema: {},
  organizationId: 'org',
  ideaTypes: [
    { id: 'type-ci', name: 'Continuous Improvement' },
    { id: 'type-pr', name: 'Process Revision' },
  ],
  businessImpacts: [
    { id: 'impact-high', name: 'High' },
    { id: 'impact-low', name: 'Low' },
  ],
  fields: [
    {
      id: 'field-line',
      name: 'Line',
      type: 'dropdown',
      options: [
        { id: 'line-packing', name: 'Packing' },
        { id: 'line-assembly', name: 'Assembly' },
      ],
    },
    { id: 'field-saving', name: 'Saving', type: 'number' },
  ],
}

export function runCase(overrides: Partial<RunCase> = {}): RunCase {
  return {
    fixture: 'f',
    note: 'why it matters',
    pair: null,
    assistant: 'v1',
    turns: ['hello'],
    expect: { inScope: true },
    ...overrides,
  }
}

export const EMPTY_DRAFT: IdeaDraft = {
  title: null,
  description: null,
  ideaTypeId: null,
  businessImpactId: null,
  priority: null,
}

export const EMPTY_V2: V2Draft = {
  title: null,
  problem: null,
  proposedSolutions: [],
  impactRationale: null,
  businessImpactId: null,
  ideaTypeId: null,
  priority: null,
  tagNames: [],
  fieldValues: [],
  description: null,
}

export interface TurnSpec {
  readonly inScope?: boolean | null
  readonly draft?: Partial<IdeaDraft>
  readonly usage?: AiTokenUsage | null
  readonly latencyMs?: number
  readonly error?: string | null
  readonly v2?: Partial<Omit<V2TurnRecord, 'draft'>> & { draft?: Partial<V2Draft> | null }
}

export const TURN_USAGE: AiTokenUsage = {
  inputTokens: 1000,
  outputTokens: 100,
  cacheReadInputTokens: 500,
  cacheCreationInputTokens: 200,
}

export function turn(spec: TurnSpec = {}, index = 0): TurnRecord {
  const inScope = spec.inScope === undefined ? true : spec.inScope
  const draft = { ...EMPTY_DRAFT, ...spec.draft }
  return {
    index,
    transcript: [],
    draftSent: EMPTY_DRAFT,
    inScope,
    nextQuestion: inScope === null ? null : 'next?',
    rawDraft: inScope === null ? null : draft,
    sanitizedDraft: inScope === null ? null : draft,
    usage: spec.usage === undefined ? TURN_USAGE : spec.usage,
    latencyMs: spec.latencyMs ?? 100,
    error: spec.error ?? null,
    ...(spec.v2 === undefined
      ? {}
      : {
          v2: {
            draftSent: EMPTY_V2,
            lockedFields: [],
            rawChanges: null,
            changes: null,
            suggestions: null,
            nextStep: null,
            ...spec.v2,
            draft: spec.v2.draft === null ? null : { ...EMPTY_V2, ...spec.v2.draft },
          },
        }),
  }
}

export function trial(
  caseId: string,
  repeat: number,
  turns: TurnRecord | TurnRecord[],
  status: TrialStatus = 'completed',
): TrialRecord {
  return { caseId, repeat, status, turns: Array.isArray(turns) ? turns : [turns] }
}

/** Errored on its only turn: no answer, a message, usage as the provider billed it. */
export function erroredTrial(caseId: string, repeat: number, error = 'boom'): TrialRecord {
  return trial(caseId, repeat, turn({ inScope: null, error, usage: null }), 'errored')
}

/**
 * A run file around `cases` and `trials`. Header fields that like-with-like reads are filled from
 * the cases; pass `header` to change them.
 */
export function makeRun(
  cases: Record<string, RunCase>,
  trials: readonly TrialRecord[],
  header: Partial<RunData['header']> = {},
): RunData {
  const ids = Object.keys(cases)
  return {
    schemaVersion: 1,
    header: {
      runnerVersion: '0.1.0',
      git: { commit: 'abc123', dirty: false },
      label: 'test',
      model: 'claude-sonnet-5',
      effort: 'low',
      modelOverridden: false,
      effortOverridden: false,
      repeats: 1,
      concurrency: 1,
      caseSelection: null,
      cases: ids,
      prompt: { source: 'default', templateSha256: 'a'.repeat(64) },
      caseHashes: Object.fromEntries(ids.map((id) => [id, `hash-${id}`])),
      fixtureHashes: { f: 'fixture-hash' },
      fixtureCatalogHashes: { f: 'catalog-hash' },
      ceilings: { maxCalls: 200, maxTokens: 1_000_000 },
      startedAt: '2026-09-28T10:00:00.000Z',
      endedAt: '2026-09-28T10:05:00.000Z',
      status: 'completed',
      abortReason: null,
      abortMessage: null,
      ...header,
    },
    fixtures: { f: FIXTURE },
    cases,
    trials,
    totals: {
      calls: trials.reduce((n, t) => n + t.turns.length, 0),
      trials: trials.length,
      erroredTrials: trials.filter((t) => t.status === 'errored').length,
      abortedTrials: trials.filter((t) => t.status === 'aborted').length,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    },
  }
}

/** `n` completed trials of `caseId`, the first `refused` of them refused. */
export function refusals(caseId: string, n: number, refused: number): TrialRecord[] {
  return Array.from({ length: n }, (_, i) => trial(caseId, i, turn({ inScope: i >= refused })))
}

export async function writeJson(file: string, value: unknown): Promise<string> {
  const { writeFile } = await import('node:fs/promises')
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  return file
}
