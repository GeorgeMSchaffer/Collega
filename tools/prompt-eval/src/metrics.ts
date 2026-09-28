import type { IdeaDraft } from '@collega/application/ai'
import { DEFAULT_AI_USAGE_LIMITS, estimatedCostAtRates } from '@collega/application/ai'
import type { V1Expectations } from './corpus.ts'
import type { RunCase, RunData, RunFixture, TrialRecord } from './run-file.ts'

/**
 * The metrics of SPEC/20-feature-prompt-eval-runner.md rules 13-18, computed from a run's trials
 * alone so `rescore` reproduces them exactly. Errored and aborted trials are counted but kept out
 * of every denominator; only `completed` trials are scored, on their final turn.
 */

/** A proportion with its 95% Wilson interval. `rate`, `low` and `high` are null when `n` is 0. */
export interface Proportion {
  readonly k: number
  readonly n: number
  readonly rate: number | null
  readonly low: number | null
  readonly high: number | null
}

/** Refusal is the positive class (rule 13): recall is the security figure. */
export interface ScopeGateMetrics {
  readonly trials: number
  readonly truePositives: number
  readonly falsePositives: number
  readonly falseNegatives: number
  readonly trueNegatives: number
  readonly recall: Proportion
  readonly precision: Proportion
}

export interface PairHalf {
  readonly caseId: string
  readonly trials: number
  readonly refusals: number
  readonly refusalRate: number | null
}

export interface PairMetrics {
  readonly pair: string
  readonly halves: readonly PairHalf[]
  /** Absolute difference of the two refusal rates; null when either half has no scored trial. */
  readonly difference: number | null
  /** Rule 14: the difference is below the margin. */
  readonly scopeStatementMayBeIgnored: boolean
}

/**
 * One expectation key over the trials that declare it. `refused` is a trial whose final turn was
 * refused: it counts against accuracy rather than leaving the denominator (rule 15), and is split
 * out because "refused a real idea" and "chose the wrong type" call for different fixes. For a
 * presence field, `wrong` is a value where none was expected and `empty` a missing one.
 */
export interface FieldMetrics {
  readonly trials: number
  readonly correct: number
  readonly wrong: number
  readonly empty: number
  readonly refused: number
  readonly accuracy: Proportion
  readonly wrongRate: number | null
  readonly emptyRate: number | null
  readonly refusedRate: number | null
}

export interface CaseMetrics {
  readonly caseId: string
  readonly trials: number
  readonly errored: number
  readonly aborted: number
  readonly passes: number
  readonly passRate: number | null
  /** Rule 17: 0 < pass rate < 1. */
  readonly flaky: boolean
}

export interface UsageMetrics {
  readonly calls: number
  readonly inputTokens: number
  readonly outputTokens: number
  readonly cacheReadInputTokens: number
  readonly cacheCreationInputTokens: number
  readonly totalTokens: number
  /** At `DEFAULT_AI_USAGE_LIMITS` rates - an estimate, since the rates are configuration. */
  readonly estimatedCostUsd: number
  readonly rates: { readonly inputPerMillion: number; readonly outputPerMillion: number }
  /** Over every call that returned or failed with a measured latency; null with no calls. */
  readonly latencyMs: { readonly p50: number; readonly p95: number; readonly max: number } | null
}

export interface ErroredTrial {
  readonly caseId: string
  readonly repeat: number
  readonly error: string | null
}

export interface RunMetrics {
  readonly trials: {
    readonly total: number
    readonly scored: number
    readonly errored: number
    readonly aborted: number
  }
  readonly scopeGate: {
    readonly all: ScopeGateMetrics
    /** Case ids starting `refuse-`: injection and off-topic. */
    readonly refuse: ScopeGateMetrics
    /** Case ids starting `scope-`: the organization's scope statement. */
    readonly scope: ScopeGateMetrics
  }
  readonly pairs: readonly PairMetrics[]
  /** Keyed by expectation name, in a fixed order. */
  readonly fields: Readonly<Record<string, FieldMetrics>>
  /** Rule 15: every declared field expectation over trials of cases expecting `inScope: true`. */
  readonly overallMapping: Proportion
  /** Rule 16. Null until a case declares `lockedFields` (v2, slice 117). */
  readonly lockedFields: null
  readonly cases: readonly CaseMetrics[]
  readonly erroredTrials: readonly ErroredTrial[]
  readonly usage: UsageMetrics
}

/** Rule 14's margin. Revisited with the user once the first baseline exists (rule 32). */
export const PAIR_MARGIN = 0.5
const Z_95 = 1.959963984540054

const OPTION_FIELDS = ['ideaType', 'businessImpact', 'priority'] as const
const PRESENCE_FIELDS = ['titleSet', 'descriptionSet'] as const
export const FIELD_KEYS: readonly string[] = [...OPTION_FIELDS, ...PRESENCE_FIELDS]

type FieldOutcome = 'correct' | 'wrong' | 'empty' | 'refused'

export function wilson(k: number, n: number): Proportion {
  if (n === 0) return { k, n, rate: null, low: null, high: null }
  const p = k / n
  const z2 = Z_95 * Z_95
  const denominator = 1 + z2 / n
  const centre = (p + z2 / (2 * n)) / denominator
  const half = (Z_95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator
  return { k, n, rate: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) }
}

function ratio(k: number, n: number): number | null {
  return n === 0 ? null : k / n
}

interface ScoredTrial {
  readonly trial: TrialRecord
  readonly evalCase: RunCase
  readonly fixture: RunFixture
  readonly inScope: boolean
  readonly draft: IdeaDraft
}

function scoredTrials(run: RunData): ScoredTrial[] {
  const scored: ScoredTrial[] = []
  for (const trial of run.trials) {
    if (trial.status !== 'completed') continue
    const last = trial.turns[trial.turns.length - 1]
    const evalCase = run.cases[trial.caseId]
    if (last === undefined || last.inScope === null || evalCase === undefined) continue
    scored.push({
      trial,
      evalCase,
      fixture: run.fixtures[evalCase.fixture],
      inScope: last.inScope,
      draft: last.sanitizedDraft as IdeaDraft,
    })
  }
  return scored
}

function scopeGate(trials: readonly ScoredTrial[]): ScopeGateMetrics {
  let tp = 0
  let fp = 0
  let fn = 0
  let tn = 0
  for (const t of trials) {
    const expected = t.evalCase.expect.inScope
    if (expected === undefined) continue
    const expectedRefusal = expected === false
    const refused = !t.inScope
    if (expectedRefusal && refused) tp++
    else if (!expectedRefusal && refused) fp++
    else if (expectedRefusal && !refused) fn++
    else tn++
  }
  return {
    trials: tp + fp + fn + tn,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    recall: wilson(tp, tp + fn),
    precision: wilson(tp, tp + fp),
  }
}

function optionName(fixture: RunFixture, field: string, draft: IdeaDraft): string | null {
  switch (field) {
    case 'ideaType':
      return fixture.ideaTypes.find((o) => o.id === draft.ideaTypeId)?.name ?? null
    case 'businessImpact':
      return fixture.businessImpacts.find((o) => o.id === draft.businessImpactId)?.name ?? null
    default:
      return draft.priority
  }
}

function isPresent(value: string | null): boolean {
  return value !== null && value.trim().length > 0
}

function fieldOutcome(t: ScoredTrial, field: string, expected: unknown): FieldOutcome {
  if (!t.inScope) return 'refused'
  if (field === 'titleSet' || field === 'descriptionSet') {
    const present = isPresent(field === 'titleSet' ? t.draft.title : t.draft.description)
    if (present === expected) return 'correct'
    return present ? 'wrong' : 'empty'
  }
  const actual = optionName(t.fixture, field, t.draft)
  if (actual === null) return 'empty'
  return actual === expected ? 'correct' : 'wrong'
}

function declaredFields(expect: V1Expectations): [string, unknown][] {
  return FIELD_KEYS.flatMap((key) => {
    const value = (expect as Record<string, unknown>)[key]
    return value === undefined ? [] : [[key, value] as [string, unknown]]
  })
}

function trialPasses(t: ScoredTrial): boolean {
  const expectedInScope = t.evalCase.expect.inScope
  if (expectedInScope !== undefined && expectedInScope !== t.inScope) return false
  return declaredFields(t.evalCase.expect).every(
    ([field, expected]) => fieldOutcome(t, field, expected) === 'correct',
  )
}

/** Nearest-rank percentile of a sorted, non-empty list. */
function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

export function computeMetrics(run: RunData): RunMetrics {
  const scored = scoredTrials(run)
  const byPrefix = (prefix: string) => scored.filter((t) => t.trial.caseId.startsWith(prefix))

  const pairNames = [
    ...new Set(Object.values(run.cases).flatMap((c) => (c.pair === null ? [] : [c.pair]))),
  ].sort()
  const pairs = pairNames.map((pair): PairMetrics => {
    const halves = Object.entries(run.cases)
      .filter(([, c]) => c.pair === pair)
      .map(([caseId]): PairHalf => {
        const trials = scored.filter((t) => t.trial.caseId === caseId)
        const refusals = trials.filter((t) => !t.inScope).length
        return {
          caseId,
          trials: trials.length,
          refusals,
          refusalRate: ratio(refusals, trials.length),
        }
      })
    const [a, b] = halves
    const difference =
      halves.length === 2 && a.refusalRate !== null && b.refusalRate !== null
        ? Math.abs(a.refusalRate - b.refusalRate)
        : null
    return {
      pair,
      halves,
      difference,
      scopeStatementMayBeIgnored: difference !== null && difference < PAIR_MARGIN,
    }
  })

  const fields: Record<string, FieldMetrics> = {}
  for (const field of FIELD_KEYS) {
    const counts: Record<FieldOutcome, number> = { correct: 0, wrong: 0, empty: 0, refused: 0 }
    for (const t of scored) {
      const expected = (t.evalCase.expect as Record<string, unknown>)[field]
      if (expected !== undefined) counts[fieldOutcome(t, field, expected)]++
    }
    const n = counts.correct + counts.wrong + counts.empty + counts.refused
    if (n === 0) continue
    fields[field] = {
      trials: n,
      ...counts,
      accuracy: wilson(counts.correct, n),
      wrongRate: ratio(counts.wrong, n),
      emptyRate: ratio(counts.empty, n),
      refusedRate: ratio(counts.refused, n),
    }
  }

  let mappingCorrect = 0
  let mappingTotal = 0
  for (const t of scored) {
    if (t.evalCase.expect.inScope !== true) continue
    for (const [field, expected] of declaredFields(t.evalCase.expect)) {
      mappingTotal++
      if (fieldOutcome(t, field, expected) === 'correct') mappingCorrect++
    }
  }

  const cases = run.header.cases.map((caseId): CaseMetrics => {
    const all = run.trials.filter((t) => t.caseId === caseId)
    const trials = scored.filter((t) => t.trial.caseId === caseId)
    const passes = trials.filter(trialPasses).length
    const passRate = ratio(passes, trials.length)
    return {
      caseId,
      trials: trials.length,
      errored: all.filter((t) => t.status === 'errored').length,
      aborted: all.filter((t) => t.status === 'aborted').length,
      passes,
      passRate,
      flaky: passRate !== null && passRate > 0 && passRate < 1,
    }
  })

  const turns = run.trials.flatMap((t) => t.turns)
  const tokens = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  }
  for (const turn of turns) {
    if (turn.usage === null) continue
    tokens.inputTokens += turn.usage.inputTokens
    tokens.outputTokens += turn.usage.outputTokens
    tokens.cacheReadInputTokens += turn.usage.cacheReadInputTokens
    tokens.cacheCreationInputTokens += turn.usage.cacheCreationInputTokens
  }
  const latencies = turns.map((t) => t.latencyMs).sort((a, b) => a - b)

  return {
    trials: {
      total: run.trials.length,
      scored: scored.length,
      errored: run.trials.filter((t) => t.status === 'errored').length,
      aborted: run.trials.filter((t) => t.status === 'aborted').length,
    },
    scopeGate: {
      all: scopeGate(scored),
      refuse: scopeGate(byPrefix('refuse-')),
      scope: scopeGate(byPrefix('scope-')),
    },
    pairs,
    fields,
    overallMapping: wilson(mappingCorrect, mappingTotal),
    lockedFields: null,
    cases,
    erroredTrials: run.trials
      .filter((t) => t.status === 'errored')
      .map((t) => ({
        caseId: t.caseId,
        repeat: t.repeat,
        error: t.turns[t.turns.length - 1]?.error ?? null,
      })),
    usage: {
      calls: turns.length,
      ...tokens,
      totalTokens:
        tokens.inputTokens +
        tokens.outputTokens +
        tokens.cacheReadInputTokens +
        tokens.cacheCreationInputTokens,
      estimatedCostUsd: estimatedCostAtRates(tokens, DEFAULT_AI_USAGE_LIMITS),
      rates: {
        inputPerMillion: DEFAULT_AI_USAGE_LIMITS.inputRatePerMillion,
        outputPerMillion: DEFAULT_AI_USAGE_LIMITS.outputRatePerMillion,
      },
      latencyMs:
        latencies.length === 0
          ? null
          : {
              p50: percentile(latencies, 50),
              p95: percentile(latencies, 95),
              max: latencies[latencies.length - 1],
            },
    },
  }
}
