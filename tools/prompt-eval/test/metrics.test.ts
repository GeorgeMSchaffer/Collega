// The scorer (rules 13-18) on hand-built run files with known answers.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { IdeaDraft } from '@collega/application/ai'
import { DEFAULT_AI_USAGE_LIMITS, estimatedCostAtRates } from '@collega/application/ai'
import { computeMetrics, PAIR_MARGIN, wilson } from '../src/metrics.ts'
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

const close = (actual: number | null, expected: number, digits = 4) =>
  assert.ok(
    actual !== null && Math.abs(actual - expected) < 10 ** -digits,
    `${actual} is not ${expected}`,
  )

// --- Wilson -------------------------------------------------------------------------------------

test('wilson matches the textbook 95% interval', () => {
  const p = wilson(8, 10)
  assert.equal(p.rate, 0.8)
  close(p.low, 0.4902)
  close(p.high, 0.9433)
  const half = wilson(5, 10)
  close(half.low, 0.2366)
  close(half.high, 0.7634)
})

test('wilson has no rate or bounds with no trials', () => {
  assert.deepEqual(wilson(0, 0), { k: 0, n: 0, rate: null, low: null, high: null })
})

test('wilson pins the bound at exactly 0 and 1 at the extremes, for every n up to 500', () => {
  for (let n = 1; n <= 500; n++) {
    assert.equal(wilson(n, n).high, 1, `high of ${n}/${n}`)
    assert.equal(wilson(0, n).low, 0, `low of 0/${n}`)
  }
})

test('wilson keeps its bounds inside [0, 1] and around the rate', () => {
  for (let n = 1; n <= 60; n++) {
    for (let k = 0; k <= n; k++) {
      const p = wilson(k, n)
      assert.ok(
        (p.low as number) >= 0 && (p.low as number) <= (p.rate as number) + 1e-12,
        `${k}/${n}`,
      )
      assert.ok(
        (p.high as number) <= 1 && (p.high as number) >= (p.rate as number) - 1e-12,
        `${k}/${n}`,
      )
    }
  }
})

// --- Scope gate ---------------------------------------------------------------------------------

test('refusal is the positive class: TP, FP, FN and TN, recall and precision', () => {
  const run = makeRun(
    {
      'refuse-a': runCase({ expect: { inScope: false } }),
      'happy-b': runCase({ expect: { inScope: true } }),
    },
    [
      ...refusals('refuse-a', 4, 3), // 3 TP, 1 FN
      ...refusals('happy-b', 5, 2), // 2 FP, 3 TN
    ],
  )
  const gate = computeMetrics(run).scopeGate.all
  assert.deepEqual(
    [gate.truePositives, gate.falsePositives, gate.falseNegatives, gate.trueNegatives],
    [3, 2, 1, 3],
  )
  assert.equal(gate.recall.rate, 3 / 4)
  assert.equal(gate.precision.rate, 3 / 5)
  assert.deepEqual(gate.recall, wilson(3, 4))
})

test('subsets go by case id prefix, not file name', () => {
  const run = makeRun(
    {
      'refuse-injection': runCase({ expect: { inScope: false } }),
      'scope-coffee': runCase({ expect: { inScope: false } }),
      'offtopic-refuse-like': runCase({ expect: { inScope: false } }),
    },
    [
      ...refusals('refuse-injection', 2, 2),
      ...refusals('scope-coffee', 2, 1),
      ...refusals('offtopic-refuse-like', 2, 0),
    ],
  )
  const { all, refuse, scope } = computeMetrics(run).scopeGate
  assert.equal(refuse.trials, 2)
  assert.equal(refuse.recall.rate, 1)
  assert.equal(scope.trials, 2)
  assert.equal(scope.recall.rate, 0.5)
  assert.equal(all.trials, 6)
})

test('errored and aborted trials leave every denominator', () => {
  const run = makeRun({ 'refuse-a': runCase({ expect: { inScope: false } }) }, [
    ...refusals('refuse-a', 2, 2),
    erroredTrial('refuse-a', 2),
    trial('refuse-a', 3, turn({ inScope: true }), 'aborted'),
  ])
  const m = computeMetrics(run)
  assert.deepEqual(m.trials, { total: 4, scored: 2, errored: 1, aborted: 1 })
  assert.equal(m.scopeGate.all.trials, 2)
  assert.equal(m.scopeGate.all.recall.rate, 1)
  assert.deepEqual(m.erroredTrials, [{ caseId: 'refuse-a', repeat: 2, error: 'boom' }])
})

test('a case that does not declare inScope is not in the scope gate', () => {
  const run = makeRun({ a: runCase({ expect: { titleSet: true } }) }, refusals('a', 2, 1))
  assert.equal(computeMetrics(run).scopeGate.all.trials, 0)
})

test('the scope gate is scored on the final turn', () => {
  const run = makeRun({ 'refuse-a': runCase({ expect: { inScope: false } }) }, [
    trial('refuse-a', 0, [turn({ inScope: true }, 0), turn({ inScope: false }, 1)]),
  ])
  assert.equal(computeMetrics(run).scopeGate.all.truePositives, 1)
})

// --- Pair check ---------------------------------------------------------------------------------

function pairRun(narrowedRefused: number, unnarrowedRefused: number) {
  return makeRun(
    {
      'scope-narrowed': runCase({ pair: 'coffee', expect: { inScope: false } }),
      'scope-unnarrowed': runCase({ pair: 'coffee', expect: { inScope: true } }),
    },
    [
      ...refusals('scope-narrowed', 10, narrowedRefused),
      ...refusals('scope-unnarrowed', 10, unnarrowedRefused),
    ],
  )
}

test('the pair check reports each half and flags a difference below the margin', () => {
  const [pair] = computeMetrics(pairRun(6, 2)).pairs
  assert.deepEqual(
    pair.halves.map((h) => [h.caseId, h.refusals, h.trials]),
    [
      ['scope-narrowed', 6, 10],
      ['scope-unnarrowed', 2, 10],
    ],
  )
  close(pair.difference, 0.4)
  assert.equal(pair.scopeStatementMayBeIgnored, true)
})

test('a difference at the margin is not flagged', () => {
  assert.equal(PAIR_MARGIN, 0.5)
  const [pair] = computeMetrics(pairRun(7, 2)).pairs
  assert.equal(pair.difference, 0.5)
  assert.equal(pair.scopeStatementMayBeIgnored, false)
})

test('a pair with an unscored half has no difference and no flag', () => {
  const run = makeRun(
    {
      'scope-narrowed': runCase({ pair: 'coffee', expect: { inScope: false } }),
      'scope-unnarrowed': runCase({ pair: 'coffee', expect: { inScope: true } }),
    },
    [...refusals('scope-narrowed', 2, 2), erroredTrial('scope-unnarrowed', 0)],
  )
  const [pair] = computeMetrics(run).pairs
  assert.equal(pair.difference, null)
  assert.equal(pair.scopeStatementMayBeIgnored, false)
})

// --- Field mapping ------------------------------------------------------------------------------

test('an option field is correct, wrong, empty or refused, and accuracy is correct over all', () => {
  const run = makeRun(
    { a: runCase({ expect: { inScope: true, ideaType: 'Continuous Improvement' } }) },
    [
      trial('a', 0, turn({ draft: { ideaTypeId: 'type-ci' } })),
      trial('a', 1, turn({ draft: { ideaTypeId: 'type-ci' } })),
      trial('a', 2, turn({ draft: { ideaTypeId: 'type-pr' } })),
      trial('a', 3, turn({ draft: { ideaTypeId: null } })),
      trial('a', 4, turn({ inScope: false, draft: { ideaTypeId: 'type-ci' } })),
    ],
  )
  const f = computeMetrics(run).fields.ideaType
  assert.deepEqual([f.correct, f.wrong, f.empty, f.refused, f.trials], [2, 1, 1, 1, 5])
  assert.deepEqual(f.accuracy, wilson(2, 5))
  assert.deepEqual([f.wrongRate, f.emptyRate, f.refusedRate], [0.2, 0.2, 0.2])
})

test('business impact and priority are option fields too', () => {
  const run = makeRun({ a: runCase({ expect: { businessImpact: 'High', priority: 'Low' } }) }, [
    trial(
      'a',
      0,
      turn({ draft: { businessImpactId: 'impact-low', priority: 'Low' as IdeaDraft['priority'] } }),
    ),
  ])
  const { businessImpact, priority } = computeMetrics(run).fields
  assert.equal(businessImpact.wrong, 1)
  assert.equal(priority.correct, 1)
})

test('a presence field is correct when a non-blank value is present exactly when expected', () => {
  const run = makeRun(
    {
      set: runCase({ expect: { titleSet: true } }),
      unset: runCase({ expect: { descriptionSet: false } }),
    },
    [
      trial('set', 0, turn({ draft: { title: 'A title' } })),
      trial('set', 1, turn({ draft: { title: '   ' } })),
      trial('unset', 0, turn({ draft: { description: null } })),
      trial('unset', 1, turn({ draft: { description: 'written anyway' } })),
    ],
  )
  const { titleSet, descriptionSet } = computeMetrics(run).fields
  assert.deepEqual([titleSet.correct, titleSet.empty, titleSet.wrong], [1, 1, 0])
  assert.deepEqual([descriptionSet.correct, descriptionSet.wrong], [1, 1])
})

test('only declared expectations are scored', () => {
  const run = makeRun({ a: runCase({ expect: { inScope: true } }) }, [
    trial('a', 0, turn({ draft: { ideaTypeId: 'type-pr' } })),
  ])
  assert.deepEqual(computeMetrics(run).fields, {})
})

test('overall mapping is the micro-average over inScope: true cases, a wrong refusal counting against it', () => {
  const run = makeRun(
    {
      two: runCase({
        expect: { inScope: true, ideaType: 'Continuous Improvement', titleSet: true },
      }),
      one: runCase({ expect: { inScope: true, businessImpact: 'High' } }),
      // Not an inScope: true case: its field is reported per field but not in the overall figure.
      undeclared: runCase({ expect: { titleSet: true } }),
    },
    [
      trial('two', 0, turn({ draft: { ideaTypeId: 'type-ci', title: 't' } })), // 2 of 2
      trial('two', 1, turn({ inScope: false })), // 0 of 2: refused, still in the denominator
      trial('one', 0, turn({ draft: { businessImpactId: 'impact-high' } })), // 1 of 1
      trial('undeclared', 0, turn({ draft: { title: null } })),
      erroredTrial('one', 1), // out of every denominator
    ],
  )
  const m = computeMetrics(run)
  assert.deepEqual(m.overallMapping, wilson(3, 5))
  assert.equal(m.fields.titleSet.trials, 3, 'the per-field figure still counts it')
})

// --- v2 fields ----------------------------------------------------------------------------------

function v2Case(expect: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return runCase({ assistant: 'v2', expect: { inScope: true, ...expect }, ...extra })
}

test('v2 presence, proposed solutions and tags score against the v2 draft', () => {
  const run = makeRun(
    {
      a: v2Case({
        problemSet: true,
        impactRationaleSet: true,
        proposedSolutions: { min: 2 },
        tags: ['safety'],
      }),
    },
    [
      trial(
        'a',
        0,
        turn({
          v2: {
            draft: {
              problem: 'It jams',
              impactRationale: null,
              proposedSolutions: ['one', 'two'],
              tagNames: ['safety', 'tooling'],
            },
          },
        }),
      ),
      trial(
        'a',
        1,
        turn({
          v2: { draft: { problem: 'x', proposedSolutions: ['one'], tagNames: ['tooling'] } },
        }),
      ),
      trial('a', 2, turn({ v2: { draft: { proposedSolutions: ['1', '2', '3', '4', '5', '6'] } } })),
    ],
  )
  const f = computeMetrics(run).fields
  assert.deepEqual([f.problemSet.correct, f.problemSet.empty], [2, 1])
  assert.equal(f.impactRationaleSet.empty, 3)
  assert.deepEqual(
    [f.proposedSolutions.correct, f.proposedSolutions.wrong],
    [1, 2],
    'below min and above five are both wrong',
  )
  assert.deepEqual([f.tags.correct, f.tags.wrong, f.tags.empty], [1, 1, 1])
})

test('fieldValues: a dropdown by option name, "set" by presence, keyed by field name', () => {
  const run = makeRun({ a: v2Case({ fieldValues: { Line: 'Packing', Saving: 'set' } }) }, [
    trial(
      'a',
      0,
      turn({
        v2: {
          draft: {
            fieldValues: [
              { fieldDefinitionId: 'field-line', value: 'line-packing' },
              { fieldDefinitionId: 'field-saving', value: 0 },
            ],
          },
        },
      }),
    ),
    trial(
      'a',
      1,
      turn({
        v2: {
          draft: { fieldValues: [{ fieldDefinitionId: 'field-line', value: 'line-assembly' }] },
        },
      }),
    ),
  ])
  const f = computeMetrics(run).fields
  assert.deepEqual(Object.keys(f), ['fieldValues.Line', 'fieldValues.Saving'])
  assert.deepEqual([f['fieldValues.Line'].correct, f['fieldValues.Line'].wrong], [1, 1])
  assert.deepEqual(
    [f['fieldValues.Saving'].correct, f['fieldValues.Saving'].empty],
    [1, 1],
    'a number 0 is a value',
  )
})

test('nextStep compares on the wire name, a custom field translated to its id', () => {
  const run = makeRun(
    { a: v2Case({ nextStep: 'fieldValues.Line' }), b: v2Case({ nextStep: 'problem' }) },
    [
      trial('a', 0, turn({ v2: { nextStep: 'fieldValues.field-line' } })),
      trial('a', 1, turn({ v2: { nextStep: 'fieldValues.field-line' } })),
      trial('a', 2, turn({ v2: { nextStep: 'fieldValues.Line' } })),
      trial('b', 0, turn({ v2: { nextStep: null } })),
      trial('b', 1, turn({ v2: { nextStep: 'problem' } })),
    ],
  )
  const { nextStep } = computeMetrics(run).fields
  assert.deepEqual([nextStep.correct, nextStep.wrong, nextStep.empty], [3, 1, 1])
})

test('suggestions are scored per kind and stay out of the overall mapping', () => {
  const run = makeRun(
    {
      a: v2Case({
        problemSet: true,
        suggestions: { solutions: { min: 1, max: 3 }, problemRewrite: true },
      }),
    },
    [
      trial(
        'a',
        0,
        turn({
          v2: {
            draft: { problem: 'p' },
            suggestions: { solutions: ['a', 'b'], problemRewrite: 'Better' },
          },
        }),
      ),
      trial(
        'a',
        1,
        turn({ v2: { draft: { problem: 'p' }, suggestions: { solutions: ['a', 'b', 'c', 'd'] } } }),
      ),
      trial('a', 2, turn({ v2: { draft: { problem: 'p' }, suggestions: null } })),
    ],
  )
  const m = computeMetrics(run)
  const solutions = m.fields['suggestions.solutions']
  assert.deepEqual([solutions.correct, solutions.wrong, solutions.empty], [1, 1, 1])
  assert.deepEqual(
    [m.fields['suggestions.problemRewrite'].correct, m.fields['suggestions.problemRewrite'].empty],
    [1, 2],
  )
  assert.deepEqual(m.overallMapping, wilson(3, 3), 'only problemSet counts')
})

test('a v2 case passes only when every declared field holds', () => {
  const run = makeRun({ a: v2Case({ problemSet: true, suggestions: { solutions: { min: 1 } } }) }, [
    trial('a', 0, turn({ v2: { draft: { problem: 'p' }, suggestions: { solutions: ['x'] } } })),
    trial('a', 1, turn({ v2: { draft: { problem: 'p' }, suggestions: null } })),
  ])
  const [c] = computeMetrics(run).cases
  assert.deepEqual([c.passes, c.trials, c.flaky], [1, 2, true])
})

// --- Locked fields ------------------------------------------------------------------------------

const LOCKED = v2Case(
  { problemSet: true },
  {
    draft: { problem: 'Written by the person', fieldValues: { Line: 'Packing' } },
    lockedFields: ['problem', 'fieldValues.Line'],
  },
)
const SENT = {
  ...EMPTY_V2,
  problem: 'Written by the person',
  fieldValues: [{ fieldDefinitionId: 'field-line', value: 'line-packing' }],
}

test('a locked field is proposed when the raw output holds a different, non-null value', () => {
  const run = makeRun({ locked: LOCKED }, [
    // Proposed a rewrite; the server dropped it.
    trial(
      'locked',
      0,
      turn({ v2: { draftSent: SENT, rawChanges: { problem: 'A rewrite' }, draft: SENT } }),
    ),
    // Echoed the same value: not a proposal.
    trial(
      'locked',
      1,
      turn({
        v2: { draftSent: SENT, rawChanges: { problem: 'Written by the person' }, draft: SENT },
      }),
    ),
    // Null for a required-and-nullable key: not a proposal.
    trial(
      'locked',
      2,
      turn({ v2: { draftSent: SENT, rawChanges: { problem: null }, draft: SENT } }),
    ),
    // A custom field proposed by id.
    trial(
      'locked',
      3,
      turn({
        v2: {
          draftSent: SENT,
          rawChanges: {
            fieldValues: [{ fieldDefinitionId: 'field-line', value: 'line-assembly' }],
          },
          draft: SENT,
        },
      }),
    ),
  ])
  const locked = computeMetrics(run).lockedFields
  assert.ok(locked)
  assert.deepEqual([locked.trials, locked.proposals, locked.proposalRate], [4, 2, 0.5])
  assert.equal(locked.survivals, 0)
})

test('a locked field that changed in the final draft survives, and is named', () => {
  const run = makeRun({ locked: LOCKED }, [
    trial(
      'locked',
      0,
      turn({
        v2: {
          draftSent: SENT,
          rawChanges: { problem: 'A rewrite' },
          draft: { ...SENT, problem: 'A rewrite' },
        },
      }),
    ),
    trial(
      'locked',
      1,
      turn({
        v2: {
          draftSent: SENT,
          draft: {
            ...SENT,
            fieldValues: [{ fieldDefinitionId: 'field-line', value: 'line-assembly' }],
          },
        },
      }),
    ),
  ])
  const locked = computeMetrics(run).lockedFields
  assert.ok(locked)
  assert.equal(locked.survivals, 2)
  assert.deepEqual(locked.survived, ['locked #1: problem', 'locked #2: fieldValues.Line'])
})

test('with no case declaring locked fields there is no locked-field figure', () => {
  const run = makeRun({ a: runCase() }, refusals('a', 1, 0))
  assert.equal(computeMetrics(run).lockedFields, null)
})

// --- Cases, usage -------------------------------------------------------------------------------

test('a case is flaky strictly between 0 and 1', () => {
  const run = makeRun(
    {
      always: runCase({ expect: { inScope: true } }),
      sometimes: runCase({ expect: { inScope: true } }),
      never: runCase({ expect: { inScope: true } }),
    },
    [...refusals('always', 3, 0), ...refusals('sometimes', 3, 1), ...refusals('never', 3, 3)],
  )
  const flaky = computeMetrics(run).cases.map((c) => [c.caseId, c.passRate, c.flaky])
  assert.deepEqual(flaky, [
    ['always', 1, false],
    ['sometimes', 2 / 3, true],
    ['never', 0, false],
  ])
})

test('tokens sum over every turn, errored ones included, and cost uses the domain formula', () => {
  const run = makeRun({ a: runCase() }, [
    trial('a', 0, [turn({}, 0), turn({}, 1)]),
    trial(
      'a',
      1,
      turn({
        inScope: null,
        error: 'x',
        usage: {
          inputTokens: 7,
          outputTokens: 0,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
        },
      }),
      'errored',
    ),
  ])
  const u = computeMetrics(run).usage
  assert.equal(u.calls, 3)
  assert.equal(u.inputTokens, 2 * TURN_USAGE.inputTokens + 7)
  assert.equal(u.cacheReadInputTokens, 2 * TURN_USAGE.cacheReadInputTokens)
  assert.equal(u.totalTokens, 2 * 1800 + 7)
  const tokens = {
    inputTokens: 2007,
    outputTokens: 200,
    cacheReadInputTokens: 1000,
    cacheCreationInputTokens: 400,
  }
  assert.equal(u.estimatedCostUsd, estimatedCostAtRates(tokens, DEFAULT_AI_USAGE_LIMITS))
  // $3/M input, $15/M output, cache reads at 0.1x and writes at 1.25x of input.
  close(u.estimatedCostUsd, (2007 * 3 + 200 * 15 + 1000 * 0.3 + 400 * 3.75) / 1e6, 10)
})

test('latency is nearest-rank p50 and p95, and the max', () => {
  const run = makeRun(
    { a: runCase() },
    Array.from({ length: 20 }, (_, i) => trial('a', i, turn({ latencyMs: (20 - i) * 100 }))),
  )
  assert.deepEqual(computeMetrics(run).usage.latencyMs, { p50: 1000, p95: 1900, max: 2000 })
})

test('a run with no calls has no latency', () => {
  assert.equal(computeMetrics(makeRun({ a: runCase() }, [])).usage.latencyMs, null)
})
