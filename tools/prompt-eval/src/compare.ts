import { computeMetrics, type Proportion, type RunMetrics } from './metrics.ts'
import type { RunData } from './run-file.ts'
import { proportion } from './summary.ts'
import {
  EXIT_INVALID,
  EXIT_PASS,
  EXIT_THRESHOLDS_FAILED,
  fmt,
  gatedMetrics,
  judge,
  lockedFieldFailures,
  regressions,
  unlikeRuns,
} from './verdict.ts'

export interface ComparedRun {
  readonly path: string
  readonly run: RunData
  readonly metrics: RunMetrics
}

/**
 * Rule 34: both values and the delta per metric and per case, after any like-with-like warning,
 * then rule 32. Unlike runs warn and never fail on their own; a run that is itself invalid under
 * rules 30-31 makes the comparison invalid (exit 2). Every figure is computed over the cases both
 * runs share (rule 33); validity is judged on each whole run, and no shared case is exit 2.
 */
export function compareRuns(
  wholeBaseline: ComparedRun,
  wholeCandidate: ComparedRun,
): { text: string; exitCode: 0 | 1 | 2 } {
  const out: string[] = []
  out.push(`Baseline   ${wholeBaseline.path}`)
  out.push(`Candidate  ${wholeCandidate.path}`)
  out.push(
    `Templates  ${wholeBaseline.run.header.prompt.templateSha256.slice(0, 12)} -> ${wholeCandidate.run.header.prompt.templateSha256.slice(0, 12)}`,
  )

  const invalid = (['baseline', 'candidate'] as const).flatMap((side) => {
    const { run, metrics } = side === 'baseline' ? wholeBaseline : wholeCandidate
    return judge(run, metrics, null).invalidReasons.map((reason) => `${side}: ${reason}`)
  })
  if (invalid.length > 0) {
    out.push('')
    out.push('Not a valid comparison: a run is not valid (rules 30-31).')
    for (const reason of invalid) out.push(`  x ${reason}`)
  }

  const warnings = unlikeRuns(wholeBaseline.run, wholeCandidate.run)
  if (warnings.length > 0) {
    out.push('')
    out.push('Warning: these runs are not like with like.')
    for (const w of warnings) out.push(`  ! ${w}`)
  }

  const candidateCases = new Set(wholeCandidate.run.header.cases)
  const shared = wholeBaseline.run.header.cases.filter((c) => candidateCases.has(c))
  const baselineOnly = wholeBaseline.run.header.cases.filter((c) => !shared.includes(c))
  const candidateOnly = wholeCandidate.run.header.cases.filter((c) => !shared.includes(c))
  if (shared.length === 0) {
    out.push('')
    out.push('Not judged: the runs share no case (exit 2).')
    return { text: out.join('\n'), exitCode: EXIT_INVALID }
  }
  const restrict = baselineOnly.length > 0 || candidateOnly.length > 0
  if (restrict) {
    out.push('')
    out.push(`Judged on the ${shared.length} case(s) both runs share (rule 33); excluded:`)
    if (baselineOnly.length > 0) out.push(`  - baseline only: ${baselineOnly.join(', ')}`)
    if (candidateOnly.length > 0) out.push(`  - candidate only: ${candidateOnly.join(', ')}`)
  }
  const baseline = restrict ? onShared(wholeBaseline, shared) : wholeBaseline
  const candidate = restrict ? onShared(wholeCandidate, shared) : wholeCandidate

  const rows: [string, Proportion | undefined, Proportion | undefined][] = []
  const before = new Map(gatedMetrics(baseline.metrics))
  const after = new Map(gatedMetrics(candidate.metrics))
  for (const metric of new Set([...before.keys(), ...after.keys()])) {
    rows.push([metric, before.get(metric), after.get(metric)])
  }
  rows.push(
    [
      'refusal recall (refuse-*)',
      baseline.metrics.scopeGate.refuse.recall,
      candidate.metrics.scopeGate.refuse.recall,
    ],
    [
      'refusal recall (scope-*)',
      baseline.metrics.scopeGate.scope.recall,
      candidate.metrics.scopeGate.scope.recall,
    ],
    [
      'refusal precision (scope-*)',
      baseline.metrics.scopeGate.scope.precision,
      candidate.metrics.scopeGate.scope.precision,
    ],
  )

  out.push('')
  out.push(`${'Metric'.padEnd(30)}${'Baseline'.padEnd(30)}${'Candidate'.padEnd(30)}Delta`)
  for (const [metric, a, b] of rows) {
    out.push(
      `${metric.padEnd(30)}${cell(a).padEnd(30)}${cell(b).padEnd(30)}${delta(a?.rate ?? null, b?.rate ?? null)}`,
    )
  }
  const ua = baseline.metrics.usage
  const ub = candidate.metrics.usage
  out.push(
    `${'cache reads'.padEnd(30)}${String(ua.cacheReadInputTokens).padEnd(30)}${String(ub.cacheReadInputTokens).padEnd(30)}${ub.cacheReadInputTokens - ua.cacheReadInputTokens}`,
  )
  out.push(
    `${'estimated cost (USD)'.padEnd(30)}${ua.estimatedCostUsd.toFixed(4).padEnd(30)}${ub.estimatedCostUsd.toFixed(4).padEnd(30)}${(ub.estimatedCostUsd - ua.estimatedCostUsd).toFixed(4)}`,
  )

  for (const pair of candidate.metrics.pairs) {
    const base = baseline.metrics.pairs.find((p) => p.pair === pair.pair)
    out.push(
      `${`pair ${pair.pair} difference`.padEnd(30)}${fmt(base?.difference ?? null).padEnd(30)}${fmt(pair.difference).padEnd(30)}${delta(base?.difference ?? null, pair.difference)}${pair.scopeStatementMayBeIgnored ? '  scope statement may be ignored' : ''}`,
    )
  }

  out.push('')
  out.push(`${'Case (pass rate)'.padEnd(30)}${'Baseline'.padEnd(30)}${'Candidate'.padEnd(30)}Delta`)
  const baseCases = new Map(baseline.metrics.cases.map((c) => [c.caseId, c]))
  for (const c of candidate.metrics.cases) {
    const b = baseCases.get(c.caseId)
    if (b === undefined) continue
    const label = (x: typeof c) =>
      `${x.passes}/${x.trials} ${fmt(x.passRate)}${x.flaky ? ' flaky' : ''}`
    out.push(
      `${c.caseId.padEnd(30)}${label(b).padEnd(30)}${label(c).padEnd(30)}${delta(b.passRate, c.passRate)}`,
    )
  }

  const lockedA = baseline.metrics.lockedFields
  const lockedB = candidate.metrics.lockedFields
  if (lockedA !== null || lockedB !== null) {
    const show = (l: typeof lockedA) =>
      l === null ? '-' : `${l.proposals}/${l.trials} proposed, ${l.survivals} survived`
    out.push('')
    out.push(`${'Locked fields'.padEnd(30)}${show(lockedA).padEnd(30)}${show(lockedB)}`)
  }

  const found = [
    ...regressions(baseline.metrics, candidate.metrics),
    ...lockedFieldFailures(candidate.metrics),
  ]
  out.push('')
  if (invalid.length > 0) {
    out.push('Not judged: a run is not valid (exit 2).')
    return { text: out.join('\n'), exitCode: EXIT_INVALID }
  }
  if (found.length === 0) {
    out.push('No regression.')
  } else {
    out.push(`Regressed (${found.length}):`)
    for (const r of found) out.push(`  x ${r.metric}: ${r.detail}`)
  }
  return { text: out.join('\n'), exitCode: found.length === 0 ? EXIT_PASS : EXIT_THRESHOLDS_FAILED }
}

/** The run with only the given cases' trials, and its metrics recomputed over them. */
function onShared(side: ComparedRun, cases: readonly string[]): ComparedRun {
  const keep = new Set(cases)
  const run: RunData = {
    ...side.run,
    header: { ...side.run.header, cases },
    cases: Object.fromEntries(Object.entries(side.run.cases).filter(([id]) => keep.has(id))),
    trials: side.run.trials.filter((t) => keep.has(t.caseId)),
  }
  return { ...side, run, metrics: computeMetrics(run) }
}

function cell(p: Proportion | undefined): string {
  return p === undefined ? '-' : proportion(p)
}

function delta(a: number | null, b: number | null): string {
  if (a === null || b === null) return '-'
  const d = b - a
  return `${d >= 0 ? '+' : ''}${d.toFixed(2)}`
}
