// The verdict (rules 30-32), like with like (rule 34) and `compareRuns`, on hand-built runs.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareRuns } from '../src/compare.ts'
import { computeMetrics } from '../src/metrics.ts'
import type { RunData } from '../src/run-file.ts'
import { renderSummary } from '../src/summary.ts'
import { type Baseline, judge, unlikeRuns } from '../src/verdict.ts'
import {
  EMPTY_V2,
  erroredTrial,
  makeRun,
  refusals,
  runCase,
  TURN_USAGE,
  trial,
  turn,
} from './helpers.ts'

const CASES = {
  'refuse-a': runCase({ expect: { inScope: false } }),
  'happy-b': runCase({ expect: { inScope: true, ideaType: 'Continuous Improvement' } }),
}

/** 10 refuse-a trials, all refused, and 20 happy-b trials of which `typeRight` pick the type. */
function run(typeRight = 20, extra: Partial<RunData['header']> = {}, more: RunData['trials'] = []) {
  return makeRun(
    CASES,
    [
      ...refusals('refuse-a', 10, 10),
      ...Array.from({ length: 20 }, (_, i) =>
        trial('happy-b', i, turn({ draft: { ideaTypeId: i < typeRight ? 'type-ci' : 'type-pr' } })),
      ),
      ...more,
    ],
    extra,
  )
}

function judged(data: RunData, baseline: RunData | null = null) {
  return judge(data, computeMetrics(data), baseline === null ? null : asBaseline(baseline))
}

function asBaseline(data: RunData, path = 'tools/prompt-eval/baselines/v1.json'): Baseline {
  return { path, run: data, metrics: computeMetrics(data) }
}

// --- Validity and the floor ---------------------------------------------------------------------

test('a clean run passes with exit 0', () => {
  const v = judged(run())
  assert.deepEqual([v.valid, v.exitCode, v.failures, v.invalidReasons], [true, 0, [], []])
})

test('an aborted run is not valid: exit 2', () => {
  const v = judged(run(20, { status: 'aborted', abortReason: 'max-calls' }))
  assert.equal(v.exitCode, 2)
  assert.match(v.invalidReasons[0], /aborted \(max-calls\)/)
})

test('errored trials above 10% make the run invalid; exactly 10% does not', () => {
  const at = (errored: number) =>
    makeRun({ 'happy-b': CASES['happy-b'] }, [
      ...Array.from({ length: 10 - errored }, (_, i) =>
        trial('happy-b', i, turn({ draft: { ideaTypeId: 'type-ci' } })),
      ),
      ...Array.from({ length: errored }, (_, i) => erroredTrial('happy-b', 10 + i)),
    ])
  assert.equal(judged(at(1)).exitCode, 0)
  assert.equal(judged(at(2)).exitCode, 2)
  assert.match(judged(at(2)).invalidReasons[0], /2 of 10 trials errored, above 10%/)
})

test('one errored refuse-* trial makes the run invalid, however few that is', () => {
  const v = judged(run(20, {}, [erroredTrial('refuse-a', 10)]))
  assert.equal(v.exitCode, 2)
  assert.match(v.invalidReasons.join(), /1 refuse-\* trial\(s\) errored/)
})

test('an errored trial of another case is not a floor problem', () => {
  assert.equal(judged(run(20, {}, [erroredTrial('happy-b', 20)])).exitCode, 0)
})

test('the floor: one refuse-* trial answered fails the run with exit 1', () => {
  const data = makeRun(CASES, [...refusals('refuse-a', 10, 9)])
  const v = judged(data)
  assert.equal(v.exitCode, 1)
  assert.equal(v.failures[0].metric, 'refusal recall (refuse-*)')
  assert.match(v.failures[0].detail, /9\/10 refused/)
})

test('the floor holds only refuse-*: a missed scope-* refusal alone passes', () => {
  const data = makeRun(
    { 'scope-x': runCase({ expect: { inScope: false } }) },
    refusals('scope-x', 10, 5),
  )
  assert.equal(judged(data).exitCode, 0)
})

test('invalid outranks failed: exit 2 even when the floor also fails', () => {
  const data = makeRun(CASES, refusals('refuse-a', 10, 5), {
    status: 'aborted',
    abortReason: 'max-tokens',
  })
  const v = judged(data)
  assert.equal(v.exitCode, 2)
  assert.equal(v.failures.length, 1)
})

test('a flagged pair warns without failing', () => {
  const data = makeRun(
    {
      'scope-n': runCase({ pair: 'p', expect: { inScope: false } }),
      'scope-u': runCase({ pair: 'p', expect: { inScope: true } }),
    },
    [...refusals('scope-n', 4, 2), ...refusals('scope-u', 4, 2)],
  )
  const v = judged(data)
  assert.equal(v.exitCode, 0)
  assert.match(v.warnings[0], /pair p: .* scope statement may be ignored/)
})

test('a run overriding the model warns when there is no baseline to compare it with', () => {
  const v = judged(run(20, { model: 'claude-other', modelOverridden: true }))
  assert.equal(v.exitCode, 0)
  assert.match(v.warnings.join(), /overrides production's settings \(model claude-other/)
})

test('a surviving locked field fails outright, baseline or not', () => {
  const data = makeRun(
    {
      locked: runCase({
        assistant: 'v2',
        expect: { inScope: true },
        draft: { problem: 'Theirs' },
        lockedFields: ['problem'],
      }),
    },
    [
      trial(
        'locked',
        0,
        turn({ v2: { draftSent: { ...EMPTY_V2, problem: 'Theirs' }, draft: { problem: 'Mine' } } }),
      ),
    ],
  )
  const v = judged(data)
  assert.equal(v.exitCode, 1)
  assert.match(v.failures[0].detail, /locked #1: problem/)
})

// --- Relative to a baseline ---------------------------------------------------------------------

test('a candidate whose interval lies wholly below the baseline point regresses: exit 1', () => {
  // Baseline 20/20; candidate 12/20 has an upper bound of about 0.78.
  const v = judged(run(12), run(20))
  assert.equal(v.exitCode, 1)
  assert.deepEqual(
    v.failures.map((f) => f.metric),
    ['ideaType accuracy', 'overall mapping accuracy'],
  )
  assert.equal(v.baseline, 'tools/prompt-eval/baselines/v1.json')
})

test('a lower candidate whose interval still reaches the baseline point does not regress', () => {
  // Baseline 16/20 = 0.8; candidate 13/20 has an upper bound of about 0.82.
  assert.equal(judged(run(13), run(16)).exitCode, 0)
})

test('a perfect run judged against itself does not regress', () => {
  const v = judged(run(), run())
  assert.deepEqual([v.exitCode, v.failures], [0, []])
})

test('refusal recall and precision take the interval rule too', () => {
  const cases = {
    'scope-n': runCase({ expect: { inScope: false } }),
    'scope-u': runCase({ expect: { inScope: true } }),
  }
  const base = makeRun(cases, [...refusals('scope-n', 20, 20), ...refusals('scope-u', 20, 0)])
  const worse = makeRun(cases, [...refusals('scope-n', 20, 10), ...refusals('scope-u', 20, 10)])
  const v = judged(worse, base)
  assert.deepEqual(
    v.failures.map((f) => f.metric),
    ['refusal recall', 'refusal precision'],
  )
})

test('a metric the baseline does not have is not judged', () => {
  const base = makeRun(
    { 'happy-b': runCase({ expect: { inScope: true } }) },
    refusals('happy-b', 5, 0),
  )
  assert.equal(
    judged(run(0), base).failures.some((f) => f.metric === 'ideaType accuracy'),
    false,
  )
})

test('the cache guard: zero cache reads against a non-zero baseline fail', () => {
  const noCache = { ...TURN_USAGE, cacheReadInputTokens: 0 }
  const cold = makeRun(CASES, [
    trial('happy-b', 0, turn({ usage: noCache, draft: { ideaTypeId: 'type-ci' } })),
  ])
  const v = judged(cold, run())
  assert.equal(v.exitCode, 1)
  assert.equal(v.failures[0].metric, 'cache guard')
  assert.match(v.failures[0].detail, /cache prefix broken/)
  // Zero against zero is a prefix below the cacheable minimum, not a break.
  assert.equal(judged(cold, cold).exitCode, 0)
})

// --- Like with like -----------------------------------------------------------------------------

test('each unlike header field warns', () => {
  const base = run()
  const changes: [Partial<RunData['header']>, RegExp][] = [
    [{ model: 'claude-other' }, /model differs: claude-sonnet-5 -> claude-other/],
    [{ effort: 'high' }, /effort differs: low -> high/],
    [{ modelOverridden: true }, /the candidate overrides the model/],
    [{ effortOverridden: true }, /the candidate overrides the effort/],
    [{ repeats: 3 }, /repeats differ: 1 -> 3/],
    [{ cases: ['refuse-a'] }, /case selection differs; baseline only: happy-b/],
    [
      { caseHashes: { 'refuse-a': 'changed', 'happy-b': 'hash-happy-b' } },
      /case refuse-a: content differs/,
    ],
    [{ fixtureCatalogHashes: { f: 'changed' } }, /fixture f: catalog differs/],
  ]
  for (const [header, expected] of changes) {
    const warnings = unlikeRuns(base, run(20, header))
    assert.ok(
      warnings.some((w) => expected.test(w)),
      `${expected}: ${warnings.join('; ')}`,
    )
  }
  assert.match(
    unlikeRuns(run(20, { modelOverridden: true }), base).join(),
    /the baseline overrides the model/,
  )
})

test('only the template may differ: its hash and the rendered-prompt hash do not warn', () => {
  const candidate = run(20, {
    prompt: { source: 'candidate.txt', templateSha256: 'b'.repeat(64) },
    fixtureHashes: { f: 'another-rendered-prompt' },
    concurrency: 4,
    label: 'candidate',
  })
  assert.deepEqual(unlikeRuns(run(), candidate), [])
})

// --- compare ------------------------------------------------------------------------------------

function compared(base: RunData, candidate: RunData) {
  return compareRuns(asBaseline(base, 'base.json'), asBaseline(candidate, 'candidate.json'))
}

test('compare prints both values and the delta per metric and per case, and exits 0 on no regression', () => {
  const { text, exitCode } = compared(run(18), run(19))
  assert.equal(exitCode, 0)
  assert.match(
    text,
    /ideaType accuracy\s+0\.90 \[.*\] \(18\/20\)\s+0\.95 \[.*\] \(19\/20\)\s+\+0\.05/,
  )
  assert.match(text, /happy-b\s+18\/20 0\.90 flaky\s+19\/20 0\.95 flaky\s+\+0\.05/)
  assert.match(text, /No regression\./)
})

test('compare warns on unlike runs without failing', () => {
  const { text, exitCode } = compared(run(), run(20, { effort: 'high', effortOverridden: true }))
  assert.equal(exitCode, 0)
  assert.match(text, /Warning: these runs are not like with like\.\n\s+! effort differs/)
})

test('compare exits 1 on a regression and names it', () => {
  const { text, exitCode } = compared(run(20), run(10))
  assert.equal(exitCode, 1)
  assert.match(text, /Regressed \(2\):\n\s+x ideaType accuracy/)
})

test('compare exits 1 on a surviving locked field in the candidate', () => {
  const cases = {
    locked: runCase({
      assistant: 'v2',
      expect: { inScope: true },
      draft: { problem: 'Theirs' },
      lockedFields: ['problem'],
    }),
  }
  const sent = { ...EMPTY_V2, problem: 'Theirs' }
  const held = makeRun(cases, [trial('locked', 0, turn({ v2: { draftSent: sent, draft: sent } }))])
  const lost = makeRun(cases, [
    trial('locked', 0, turn({ v2: { draftSent: sent, draft: { problem: 'Mine' } } })),
  ])
  assert.equal(compared(held, lost).exitCode, 1)
  assert.equal(
    compared(lost, held).exitCode,
    0,
    'a survival in the baseline is not the candidate’s',
  )
})

test('compare exits 2 when either run is itself invalid, and says why', () => {
  const aborted = run(20, { status: 'aborted', abortReason: 'max-calls' })
  const erroredRefusal = run(20, {}, [erroredTrial('refuse-a', 10)])
  for (const [base, candidate, side] of [
    [aborted, run(), 'baseline'],
    [run(), aborted, 'candidate'],
    [run(), erroredRefusal, 'candidate'],
  ] as const) {
    const { text, exitCode } = compared(base, candidate)
    assert.equal(exitCode, 2)
    assert.match(text, new RegExp(`x ${side}: `))
    assert.match(text, /Not judged: a run is not valid \(exit 2\)\./)
  }
})

test('compare judges only the cases both runs share, and names the ones it left out', () => {
  // The candidate adds happy-c, every trial of it mapped wrong: judged whole, ideaType regresses.
  const withExtra = makeRun({ ...CASES, 'happy-c': CASES['happy-b'] }, [
    ...run().trials,
    ...Array.from({ length: 20 }, (_, i) =>
      trial('happy-c', i, turn({ draft: { ideaTypeId: 'type-pr' } })),
    ),
  ])
  assert.equal(judged(withExtra, run()).exitCode, 1, 'the whole run does regress')

  const { text, exitCode } = compared(run(), withExtra)
  assert.equal(exitCode, 0)
  assert.match(text, /case selection differs; candidate only: happy-c/)
  assert.match(
    text,
    /Judged on the 2 case\(s\) both runs share \(rule 33\); excluded:\n\s+- candidate only: happy-c/,
  )
  assert.doesNotMatch(text, /^happy-c/m)
  assert.match(text, /No regression\./)

  // A regression in a shared case still fails, and a baseline-only case is excluded the same way.
  const fewer = makeRun({ 'happy-b': CASES['happy-b'] }, run(10).trials.slice(10))
  const narrowed = compared(run(), fewer)
  assert.equal(narrowed.exitCode, 1)
  assert.match(narrowed.text, /Judged on the 1 case\(s\)[^\n]*\n\s+- baseline only: refuse-a\n/)
  assert.match(narrowed.text, /Regressed \(2\):\n\s+x ideaType accuracy/)
})

test('compare refuses to judge runs that share no case: exit 2', () => {
  const onlyRefuse = makeRun({ 'refuse-a': CASES['refuse-a'] }, refusals('refuse-a', 10, 10))
  const onlyHappy = makeRun({ 'happy-b': CASES['happy-b'] }, run().trials.slice(10))
  const { text, exitCode } = compared(onlyRefuse, onlyHappy)
  assert.equal(exitCode, 2)
  assert.match(text, /Not judged: the runs share no case \(exit 2\)\./)
  assert.doesNotMatch(text, /No regression|Regressed/)
})

test('compare on the same case set reports no exclusions', () => {
  assert.doesNotMatch(compared(run(18), run(19)).text, /excluded|share/)
})

// --- Summary ------------------------------------------------------------------------------------

test('the summary carries the verdict, the scope gate, flaky cases with their note, and spend', () => {
  const data = run(15, {}, [erroredTrial('happy-b', 20, 'provider said no')])
  const metrics = computeMetrics(data)
  const text = renderSummary(data, metrics, judge(data, metrics, null))
  assert.match(text, /\*\*Passed\*\* \(exit 0\) against the absolute floor/)
  assert.match(text, /\| `refuse-\*` \| 10 \| 10 \| 0 \| 0 \| 0 \| 1\.00 \[/)
  assert.match(text, /\*\*happy-b\*\* \(15\/20, flaky\): why it matters/)
  assert.match(text, /happy-b #21: provider said no/)
  assert.match(text, /Estimated cost: \$[\d.]+ \(an estimate/)
  assert.match(text, /Cache reads \(the cache guard\): /)
})
