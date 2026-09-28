import type { Proportion, RunMetrics } from './metrics.ts'
import type { RunData } from './run-file.ts'
import { proportion } from './summary.ts'
import {
  EXIT_PASS,
  EXIT_THRESHOLDS_FAILED,
  fmt,
  gatedMetrics,
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
 * then rule 32. Unlike runs warn and never fail on their own.
 */
export function compareRuns(
  baseline: ComparedRun,
  candidate: ComparedRun,
): { text: string; exitCode: 0 | 1 } {
  const out: string[] = []
  out.push(`Baseline   ${baseline.path}`)
  out.push(`Candidate  ${candidate.path}`)
  out.push(
    `Templates  ${baseline.run.header.prompt.templateSha256.slice(0, 12)} -> ${candidate.run.header.prompt.templateSha256.slice(0, 12)}`,
  )

  const warnings = unlikeRuns(baseline.run, candidate.run)
  for (const [side, run] of [
    ['baseline', baseline.run],
    ['candidate', candidate.run],
  ] as const) {
    if (run.header.status !== 'completed') warnings.push(`the ${side} run was ${run.header.status}`)
  }
  if (warnings.length > 0) {
    out.push('')
    out.push('Warning: these runs are not like with like.')
    for (const w of warnings) out.push(`  ! ${w}`)
  }

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

  const found = regressions(baseline.metrics, candidate.metrics)
  out.push('')
  if (found.length === 0) {
    out.push('No regression.')
  } else {
    out.push(`Regressed (${found.length}):`)
    for (const r of found) out.push(`  x ${r.metric}: ${r.detail}`)
  }
  return { text: out.join('\n'), exitCode: found.length === 0 ? EXIT_PASS : EXIT_THRESHOLDS_FAILED }
}

function cell(p: Proportion | undefined): string {
  return p === undefined ? '-' : proportion(p)
}

function delta(a: number | null, b: number | null): string {
  if (a === null || b === null) return '-'
  const d = b - a
  return `${d >= 0 ? '+' : ''}${d.toFixed(2)}`
}
