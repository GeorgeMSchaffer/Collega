// The runner end to end through `main(argv, deps)`: the real corpus, the real adapter on a fake
// client, a fixed clock and a scratch runs directory. No key is real and no call leaves the process.

import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, test } from 'node:test'
import { DEFAULT_AI_USAGE_LIMITS, defaultAiPromptSet } from '@collega/application/ai'
import { main } from '../src/cli.ts'
import { loadCorpus } from '../src/corpus.ts'
import { prepareFixture, schemaPriorities } from '../src/fixture-context.ts'
import { sha256 } from '../src/hashing.ts'
import { computeMetrics } from '../src/metrics.ts'
import { type RunFile, readRunFile } from '../src/run-file.ts'
import {
  capture,
  copyCorpus,
  type FakeClient,
  fakeAnthropic,
  PACKAGE_ROOT,
  perfectResponder,
  type Responder,
  scratchDir,
  TEST_KEY,
  testDeps,
  USAGE,
  writeJson,
} from './helpers.ts'

const KEY_ENV = { PROMPT_EVAL_ANTHROPIC_API_KEY: TEST_KEY }
const RUN_FILE = '20260928T101500Z-default.json'

interface Outcome {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly runsDir: string
  readonly fake: FakeClient
  readonly configs: { apiKey: string | undefined; model: string; effort: string }[]
}

/** `main` with the perfect model unless `responder` is given, the key in the environment. */
async function runMain(
  argv: string[],
  options: {
    responder?: Responder
    env?: NodeJS.ProcessEnv
    envFile?: string
    runsDir?: string
    corpusRoot?: string
  } = {},
): Promise<Outcome> {
  const fake = fakeAnthropic(options.responder ?? (await perfectResponder()))
  const runsDir = options.runsDir ?? (await scratchDir())
  const deps = testDeps(fake, {
    runsDir,
    env: options.env ?? KEY_ENV,
    ...(options.envFile === undefined ? {} : { envFile: options.envFile }),
    ...(options.corpusRoot === undefined ? {} : { corpusRoot: options.corpusRoot }),
  })
  const { result, stdout, stderr } = await capture(() => main(argv, deps))
  return { code: result, stdout, stderr, runsDir, fake, configs: deps.modelConfigs }
}

async function runFileOf(outcome: Outcome, name = RUN_FILE): Promise<RunFile> {
  return JSON.parse(await readFile(path.join(outcome.runsDir, name), 'utf8'))
}

async function filesIn(dir: string): Promise<string[]> {
  return (await readdir(dir)).sort()
}

// Baselines passed by path must sit inside the repository to test the repo-relative path; this
// scratch directory is under the gitignored runs/ and is removed afterwards.
let inRepoScratch: string | undefined
async function repoScratch(): Promise<string> {
  if (inRepoScratch === undefined) {
    await mkdir(path.join(PACKAGE_ROOT, 'runs'), { recursive: true })
    inRepoScratch = await mkdtemp(path.join(PACKAGE_ROOT, 'runs', 'self-test-'))
  }
  return inRepoScratch
}
after(async () => {
  if (inRepoScratch !== undefined) await rm(inRepoScratch, { recursive: true, force: true })
})

// --- Credentials (rules 22, 36, 37) -------------------------------------------------------------

test('a live run with only ANTHROPIC_API_KEY set refuses to start: exit 2, no model, no call', async () => {
  const envFile = path.join(await scratchDir(), '.env')
  await writeFile(envFile, 'ANTHROPIC_API_KEY=sk-ant-api-from-file\n', 'utf8')
  const o = await runMain(['--repeats', '1'], {
    env: { ANTHROPIC_API_KEY: 'sk-ant-api-from-env' },
    envFile,
  })
  assert.equal(o.code, 2)
  assert.match(o.stderr, /PROMPT_EVAL_ANTHROPIC_API_KEY is not set/)
  assert.deepEqual(o.configs, [])
  assert.equal(o.fake.requests.length, 0)
  assert.deepEqual(await filesIn(o.runsDir), [])
})

test('a blank key refuses to start', async () => {
  const o = await runMain(['--repeats', '1'], { env: { PROMPT_EVAL_ANTHROPIC_API_KEY: '  ' } })
  assert.equal(o.code, 2)
  assert.equal(o.fake.requests.length, 0)
})

test('the key from the env file is passed to the adapter explicitly, and process.env is untouched', async () => {
  const envFile = path.join(await scratchDir(), '.env')
  await writeFile(envFile, `PROMPT_EVAL_ANTHROPIC_API_KEY='${TEST_KEY}'\n`, 'utf8')
  const before = { ...process.env }
  const o = await runMain(['--repeats', '1', '--case', 'approval-threshold'], { env: {}, envFile })
  assert.equal(o.code, 0)
  assert.deepEqual(o.configs, [
    {
      apiKey: TEST_KEY,
      model: DEFAULT_AI_USAGE_LIMITS.model,
      effort: DEFAULT_AI_USAGE_LIMITS.effort,
    },
  ])
  assert.deepEqual({ ...process.env }, before)
})

test('the key never reaches stdout, stderr, the run file or the summary, even when the provider echoes it', async () => {
  const plainKey = 'evaluation-key-without-the-usual-prefix'
  const perfect = await perfectResponder()
  const echo: Responder = (text, call) =>
    text.includes('label printers')
      ? { kind: 'throw', error: new Error(`401 {"x-api-key":"${plainKey}","also":"${TEST_KEY}"}`) }
      : perfect(text, call)
  for (const key of [TEST_KEY, plainKey]) {
    const o = await runMain(['--repeats', '1'], {
      env: { PROMPT_EVAL_ANTHROPIC_API_KEY: key },
      responder: echo,
    })
    const run = await runFileOf(o)
    const summary = await readFile(path.join(o.runsDir, RUN_FILE.replace('.json', '.md')), 'utf8')
    const errored = run.trials.filter((t) => t.status === 'errored')
    assert.equal(errored.length, 1, 'the echoing call is an errored trial')
    assert.match(errored[0].turns.at(-1)?.error ?? '', /\[redacted\]/)
    for (const [where, text] of [
      ['stdout', o.stdout],
      ['stderr', o.stderr],
      ['run file', JSON.stringify(run)],
      ['summary', summary],
    ]) {
      assert.ok(!text.includes(key), `the key is in the ${where}`)
      assert.ok(!text.includes(TEST_KEY), `an sk-ant key is in the ${where}`)
    }
  }
})

test('a defect that echoes the key is stored redacted and aborts the run: exit 2', async () => {
  const runsDir = await scratchDir()
  const deps = testDeps(null, {
    runsDir,
    env: KEY_ENV,
    createModel: () => ({
      isConfigured: true,
      continueTurn: async () => {
        throw new TypeError(`bad state near ${TEST_KEY}`)
      },
    }),
  })
  const { result, stdout, stderr } = await capture(() => main(['--repeats', '1'], deps))
  assert.equal(result, 2)
  const run: RunFile = JSON.parse(await readFile(path.join(runsDir, RUN_FILE), 'utf8'))
  assert.equal(run.header.abortReason, 'unexpected-error')
  assert.equal(run.header.abortMessage, 'bad state near [redacted]')
  assert.match(stderr, /Stopped by: bad state near \[redacted\]/)
  assert.ok(!`${stdout}${stderr}${JSON.stringify(run)}`.includes(TEST_KEY))
})

// --- A live run ---------------------------------------------------------------------------------

test('a live run writes the run file and summary, exits 0, and rescore reproduces its metrics exactly', async () => {
  const o = await runMain(['--repeats', '2'])
  assert.equal(o.code, 0, o.stderr)
  assert.deepEqual(await filesIn(o.runsDir), [RUN_FILE, RUN_FILE.replace('.json', '.md')])
  const stored = await runFileOf(o)

  const h = stored.header
  assert.deepEqual(
    [h.model, h.effort, h.modelOverridden, h.effortOverridden, h.repeats, h.status],
    [DEFAULT_AI_USAGE_LIMITS.model, DEFAULT_AI_USAGE_LIMITS.effort, false, false, 2, 'completed'],
  )
  assert.equal(h.cases.length, 9, 'the v1 and both cases, no v2 case')
  assert.deepEqual(Object.keys(h.caseHashes).sort(), [...h.cases].sort())
  assert.deepEqual(Object.keys(h.fixtureHashes), ['acme', 'acme-scoped'])
  assert.equal(h.prompt.source, 'default')
  assert.equal(h.prompt.templateSha256, sha256(defaultAiPromptSet().systemPromptTemplate))
  assert.deepEqual(h.git, { commit: 'abc123', dirty: false })
  assert.equal(h.startedAt, '2026-09-28T10:15:00.000Z')
  assert.equal(stored.trials.length, 18)
  assert.equal(stored.totals.calls, 20)
  assert.equal(stored.metrics.scopeGate.refuse.recall.rate, 1)
  assert.equal(stored.metrics.usage.inputTokens, 20 * USAGE.input_tokens)
  assert.equal(stored.verdict.exitCode, 0)

  const reread = await readRunFile(path.join(o.runsDir, RUN_FILE))
  assert.deepEqual(computeMetrics(reread), stored.metrics)

  const rescored = await runMain(['rescore', path.join(o.runsDir, RUN_FILE)], { env: {} })
  assert.equal(rescored.code, 0)
  const summary = await readFile(path.join(o.runsDir, RUN_FILE.replace('.json', '.md')), 'utf8')
  assert.equal(rescored.stdout, `${summary}\n`, 'rescore prints the same summary, with no key')
})

test('the fixture prompt stored in the run file is the one the adapter sent', async () => {
  const o = await runMain(['--repeats', '1', '--case', 'approval-threshold'])
  const run = await runFileOf(o)
  const request = o.fake.requests[0] as { system: { text: string }[] }
  assert.equal(request.system[0].text, run.fixtures.acme.systemPrompt)
})

test('an errored refuse-* trial makes a live run invalid: exit 2', async () => {
  const perfect = await perfectResponder()
  const o = await runMain(['--repeats', '1'], {
    responder: (text, call) =>
      text.includes('limerick')
        ? { kind: 'throw', error: new Error('overloaded') }
        : perfect(text, call),
  })
  assert.equal(o.code, 2)
  assert.match(o.stdout, /Not a valid run\*\* \(exit 2\)/)
  assert.match(o.stdout, /refuse-\* trial\(s\) errored/)
})

test('a refuse-* case answered fails the floor: exit 1', async () => {
  const perfect = await perfectResponder()
  const o = await runMain(['--repeats', '1'], {
    responder: (text, call) =>
      text.includes('limerick')
        ? { kind: 'json', body: { inScope: true, nextQuestion: 'Sure!' } }
        : perfect(text, call),
  })
  assert.equal(o.code, 1)
})

// --- Ceilings, --yes, selection (rules 25, 28, 40) ----------------------------------------------

test('--max-calls stops the run, writes it as aborted and exits 2', async () => {
  const o = await runMain(['--repeats', '1', '--max-calls', '3'])
  assert.equal(o.code, 2)
  assert.equal(o.fake.requests.length, 3)
  const run = await runFileOf(o)
  assert.deepEqual([run.header.status, run.header.abortReason], ['aborted', 'max-calls'])
  assert.equal(run.verdict.exitCode, 2)
})

test('--max-tokens stops the run as max-tokens and exits 2', async () => {
  // Each fake call reports 180 tokens across the four kinds.
  const o = await runMain(['--repeats', '1', '--max-tokens', '300'])
  assert.equal(o.code, 2)
  assert.equal(o.fake.requests.length, 2)
  assert.equal((await runFileOf(o)).header.abortReason, 'max-tokens')
})

test('above 100 planned calls a live run needs --yes, and refuses before any call without it', async () => {
  // Ten v1 turns x 11 repeats = 110 calls.
  const refused = await runMain(['--repeats', '11'])
  assert.equal(refused.code, 2)
  assert.match(refused.stderr, /plans 110 calls, above 100\. Re-run with --yes/)
  assert.deepEqual(refused.configs, [])
  const confirmed = await runMain(['--repeats', '11', '--yes'])
  assert.equal(confirmed.code, 0)
  assert.equal(confirmed.fake.requests.length, 110)
})

test('exactly 100 planned calls need no --yes', async () => {
  const o = await runMain(['--repeats', '10'])
  assert.equal(o.code, 0)
  assert.equal(o.fake.requests.length, 100)
})

test('--case narrows the run and is recorded; a v2 or unknown case is refused', async () => {
  const o = await runMain([
    '--repeats',
    '1',
    '--case',
    'approval-threshold',
    '--case',
    'refuse-offtopic-recipe',
  ])
  assert.equal(o.code, 0)
  const h = (await runFileOf(o)).header
  assert.deepEqual(h.caseSelection, ['approval-threshold', 'refuse-offtopic-recipe'])
  assert.deepEqual(h.cases, ['approval-threshold', 'refuse-offtopic-recipe'])

  for (const id of ['v2-locked-problem', 'no-such-case']) {
    const refused = await runMain(['--case', id])
    assert.equal(refused.code, 2)
    assert.match(refused.stderr, new RegExp(`Unknown or non-v1 case: ${id}`))
    assert.equal(refused.fake.requests.length, 0)
  }
})

test('a --case given twice runs and is recorded once', async () => {
  const o = await runMain([
    '--repeats',
    '1',
    '--case',
    'approval-threshold',
    '--case',
    'approval-threshold',
  ])
  assert.equal(o.code, 0)
  assert.deepEqual((await runFileOf(o)).header.caseSelection, ['approval-threshold'])
})

test('--model and --effort overrides reach the request and are recorded as overridden', async () => {
  const o = await runMain([
    '--repeats',
    '1',
    '--case',
    'approval-threshold',
    '--model',
    'claude-other',
    '--effort',
    'high',
  ])
  const request = o.fake.requests[0] as { model: string; output_config: { effort: string } }
  assert.deepEqual([request.model, request.output_config.effort], ['claude-other', 'high'])
  const h = (await runFileOf(o)).header
  assert.deepEqual([h.modelOverridden, h.effortOverridden], [true, true])
  assert.match(o.stdout, /overrides production's settings/)
})

test('an unknown effort or a malformed number is a usage error: exit 2', async () => {
  for (const argv of [
    ['--effort', 'extreme'],
    ['--repeats', '0'],
    ['--max-calls', '1.5'],
    ['--bogus'],
  ]) {
    const o = await runMain(argv)
    assert.equal(o.code, 2, argv.join(' '))
    assert.equal(o.fake.requests.length, 0)
  }
})

test('a run file is never overwritten: the second run of the same second exits 2', async () => {
  const first = await runMain(['--repeats', '1', '--case', 'approval-threshold'])
  const before = await readFile(path.join(first.runsDir, RUN_FILE), 'utf8')
  const second = await runMain(['--repeats', '1', '--case', 'impact-inference'], {
    runsDir: first.runsDir,
  })
  assert.equal(second.code, 2)
  assert.match(second.stderr, /already exists; not overwriting it/)
  assert.equal(await readFile(path.join(first.runsDir, RUN_FILE), 'utf8'), before)
})

// --- Prompt source (rule 26) --------------------------------------------------------------------

test('--prompt-file is trimmed as publishing trims it, and recorded by path and hash', async () => {
  const dir = await scratchDir()
  const file = path.join(dir, 'candidate.txt')
  const template = 'Be brief.\n{{ORGANIZATION_CATALOG}}\n{{SCOPE_STATEMENT}}'
  await writeFile(file, `\n  ${template}  \n\n`, 'utf8')
  const o = await runMain(['--repeats', '1', '--case', 'approval-threshold', '--prompt-file', file])
  assert.equal(o.code, 0, o.stderr)
  const run = await (async () => {
    const [json] = (await filesIn(o.runsDir)).filter((f) => f.endsWith('.json'))
    assert.equal(json, '20260928T101500Z-candidate.json', 'labelled after the file')
    return runFileOf(o, json)
  })()
  assert.equal(run.header.prompt.source, file)
  assert.equal(run.header.prompt.templateSha256, sha256(template))
  assert.ok(run.fixtures.acme.systemPrompt.startsWith('Be brief.\n'))
})

test('a template missing a placeholder is refused before any call', async () => {
  const file = path.join(await scratchDir(), 'candidate.txt')
  await writeFile(file, 'Only {{ORGANIZATION_CATALOG}} here.', 'utf8')
  for (const argv of [
    ['--prompt-file', file],
    ['dump-prompt', '--fixture', 'acme', '--prompt-file', file],
    ['--dry-run', '--prompt-file', file],
  ]) {
    const o = await runMain(argv)
    assert.equal(o.code, 2, argv.join(' '))
    assert.match(o.stderr, /must contain \{\{SCOPE_STATEMENT\}\}/)
    assert.equal(o.fake.requests.length, 0)
  }
})

test('a JSON response saved as the prompt file is refused with a hint', async () => {
  const file = path.join(await scratchDir(), 'response.json')
  await writeFile(file, JSON.stringify({ body: 'x' }), 'utf8')
  const o = await runMain(['--dry-run', '--prompt-file', file])
  assert.equal(o.code, 2)
  assert.match(o.stderr, /not the JSON response/)
})

// --- --dry-run and dump-prompt (rule 27) ---------------------------------------------------------

test('--dry-run needs no key, makes no call, writes nothing and counts the plan', async () => {
  const o = await runMain(['--dry-run'], { env: {} })
  assert.equal(o.code, 0)
  assert.deepEqual(o.configs, [])
  assert.equal(o.fake.requests.length, 0)
  assert.deepEqual(await filesIn(o.runsDir), [])
  assert.match(o.stdout, /Planned {4}50 calls across 9 cases/)
  assert.match(o.stdout, /Validated, not run \(7 v2 cases/)
  assert.match(o.stdout, /hostile-catalog/, 'every fixture is rendered')
})

test('--dry-run reads --baseline as a live run would: unreadable is exit 2, readable is named', async () => {
  const missing = await runMain(
    ['--dry-run', '--baseline', path.join(await scratchDir(), 'nope.json')],
    { env: {} },
  )
  assert.equal(missing.code, 2)
  assert.match(missing.stderr, /Cannot read run file/)

  const live = await runMain(['--repeats', '1', '--case', 'approval-threshold'])
  const baseline = path.join(await repoScratch(), 'dry-baseline.json')
  await writeFile(baseline, await readFile(path.join(live.runsDir, RUN_FILE), 'utf8'))
  const ok = await runMain(['--dry-run', '--baseline', baseline], { env: {} })
  assert.equal(ok.code, 0)
  assert.match(
    ok.stdout,
    /Baseline {3}tools\/prompt-eval\/runs\/self-test-[^/]+\/dry-baseline\.json \(1 trials, readable\)/,
  )
})

test('--dry-run on an invalid corpus exits 2 and lists every problem', async () => {
  const root = await copyCorpus()
  await writeFile(path.join(root, 'cases', 'broken.json'), '{"id": "broken"}', 'utf8')
  const o = await runMain(['--dry-run'], { env: {}, corpusRoot: root })
  assert.equal(o.code, 2)
  assert.match(o.stderr, /The corpus is invalid:\n {2}- cases\/broken.json: /)
})

test('dump-prompt prints the rendered prompt, byte-identical across runs', async () => {
  const corpus = await loadCorpus(PACKAGE_ROOT, schemaPriorities())
  const expected = prepareFixture(
    corpus.fixtures.get('hostile-catalog') as never,
    defaultAiPromptSet(),
  ).systemPrompt
  const first = await runMain(['dump-prompt', '--fixture', 'hostile-catalog'], { env: {} })
  const second = await runMain(['dump-prompt', '--fixture', 'hostile-catalog'], { env: {} })
  assert.equal(first.code, 0)
  assert.equal(first.stdout, `${expected}\n`)
  assert.equal(second.stdout, first.stdout)
})

test('dump-prompt needs a known --fixture', async () => {
  assert.equal((await runMain(['dump-prompt'], { env: {} })).code, 2)
  const unknown = await runMain(['dump-prompt', '--fixture', 'nowhere'], { env: {} })
  assert.equal(unknown.code, 2)
  assert.match(unknown.stderr, /Unknown fixture "nowhere"/)
})

// --- --baseline, rescore and compare (rules 29, 30, 34) ------------------------------------------

async function savedRun(
  argv: string[] = ['--repeats', '1'],
  responder?: Responder,
): Promise<string> {
  const o = await runMain(argv, responder === undefined ? {} : { responder })
  const file = path.join(await repoScratch(), `${path.basename(o.runsDir)}.json`)
  await writeFile(file, await readFile(path.join(o.runsDir, RUN_FILE), 'utf8'))
  return file
}

test('a live run with --baseline stores the baseline path relative to the repository', async () => {
  const baseline = await savedRun()
  const o = await runMain(['--repeats', '1', '--baseline', baseline])
  assert.equal(o.code, 0)
  const expected = path
    .relative(path.resolve(PACKAGE_ROOT, '..', '..'), baseline)
    .split(path.sep)
    .join('/')
  assert.match(expected, /^tools\/prompt-eval\/runs\//)
  assert.equal((await runFileOf(o)).verdict.baseline, expected)
})

test('an unreadable --baseline stops a live run before any call', async () => {
  const bad = await writeJson(path.join(await scratchDir(), 'bad.json'), { schemaVersion: 99 })
  const o = await runMain(['--repeats', '1', '--baseline', bad])
  assert.equal(o.code, 2)
  assert.match(o.stderr, /not a schema version 1 run file/)
  assert.equal(o.fake.requests.length, 0)
})

test('rescore applies --baseline: a regression is exit 1', async () => {
  const good = await savedRun()
  const perfect = await perfectResponder()
  const worse = await savedRun(['--repeats', '1'], (text, call) => {
    const reply = perfect(text, call)
    return reply.kind === 'json' && reply.body.inScope === true
      ? { kind: 'json', body: { ...reply.body, title: null, description: null } }
      : reply
  })
  assert.equal((await runMain(['rescore', worse], { env: {} })).code, 0, 'the floor alone passes')
  const judged = await runMain(['rescore', worse, '--baseline', good], { env: {} })
  assert.equal(judged.code, 1)
  assert.match(judged.stdout, /Failed: titleSet accuracy/)
})

test('a run file of another schema version is refused, whatever else it holds', async () => {
  const good = await savedRun()
  const future = { ...JSON.parse(await readFile(good, 'utf8')), schemaVersion: 2 }
  const file = await writeJson(path.join(await scratchDir(), 'future.json'), future)
  const o = await runMain(['rescore', file], { env: {} })
  assert.equal(o.code, 2)
  assert.match(o.stderr, /not a schema version 1 run file/)
})

test('rescore and compare refuse malformed input with exit 2', async () => {
  const dir = await scratchDir()
  const notJson = path.join(dir, 'x.json')
  await writeFile(notJson, '{', 'utf8')
  const good = await savedRun()
  for (const argv of [
    ['rescore', notJson],
    ['rescore', path.join(dir, 'missing.json')],
    ['rescore'],
    ['compare', good],
    ['compare', good, notJson],
    ['compare', notJson, good],
    ['compare', good, good, '--baseline', good],
  ]) {
    const o = await runMain(argv, { env: {} })
    assert.equal(o.code, 2, argv.join(' '))
  }
})

test('compare: 0 on like runs, 0 with a warning on unlike ones, 2 when a run is invalid', async () => {
  const base = await savedRun()
  const same = await runMain(['compare', base, base], { env: {} })
  assert.equal(same.code, 0)
  assert.match(same.stdout, /No regression\./)

  const overridden = await savedRun(['--repeats', '1', '--effort', 'medium'])
  const unlike = await runMain(['compare', base, overridden], { env: {} })
  assert.equal(unlike.code, 0)
  assert.match(unlike.stdout, /! effort differs: low -> medium/)

  const aborted = await savedRun(['--repeats', '1', '--max-calls', '2'])
  const invalid = await runMain(['compare', base, aborted], { env: {} })
  assert.equal(invalid.code, 2)
  assert.match(invalid.stdout, /x candidate: the run was aborted \(max-calls\)/)
})
