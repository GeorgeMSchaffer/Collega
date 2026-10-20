// The v2 targets and the v2 section of the summary: reported, never gating (rule 33).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeMetrics } from '../src/metrics.ts'
import { renderSummary } from '../src/summary.ts'
import { V2_TARGETS, v2TargetResults } from '../src/v2-targets.ts'
import { judge } from '../src/verdict.ts'
import { makeRun, runCase, trial, turn } from './helpers.ts'

const CASES = {
  a: runCase({ assistant: 'v2', expect: { inScope: true, problemSet: true } }),
}

function run(problems: number, total: number) {
  return makeRun(
    CASES,
    Array.from({ length: total }, (_, i) =>
      trial('a', i, turn({ v2: { draft: { problem: i < problems ? 'p' : null } } })),
    ),
  )
}

test('no targets for a run that never drove the v2 turn', () => {
  const plain = makeRun({ a: runCase({ expect: { inScope: true, titleSet: true } }) }, [
    trial('a', 0, turn()),
  ])
  assert.deepEqual(v2TargetResults(computeMetrics(plain)), [])
  assert.doesNotMatch(
    renderSummary(plain, computeMetrics(plain), judge(plain, computeMetrics(plain), null)),
    /## v2 results/,
  )
})

test('targets are met or not met on the point estimate, and groups without trials are unjudged', () => {
  const r = run(9, 10)
  const results = v2TargetResults(computeMetrics(r))
  const byName = new Map(results.map((t) => [t.name, t]))
  assert.equal(byName.get('v2 Problem, Proposed solutions, Impact rationale')?.met, true)
  assert.equal(byName.get('v2 overall mapping accuracy')?.met, true, '0.9 meets 0.9')
  assert.equal(byName.get('v2 custom fields')?.met, null)
  const worse = v2TargetResults(computeMetrics(run(7, 10)))
  assert.equal(
    worse.find((t) => t.name === 'v2 overall mapping accuracy')?.met,
    false,
    `0.7 is below ${V2_TARGETS.overallMapping}`,
  )
})

test('a missed v2 target is reported in the summary and does not change the exit code', () => {
  const r = run(5, 10)
  const m = computeMetrics(r)
  const verdict = judge(r, m, null)
  assert.equal(verdict.exitCode, 0)
  const summary = renderSummary(r, m, verdict)
  assert.match(summary, /## v2 results/)
  assert.match(summary, /v2 overall mapping accuracy: 0\.50 against 0\.9 - \*\*not met\*\*/)
})
