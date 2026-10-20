import type { Proportion, RunMetrics, V2Group } from './metrics.ts'
import { V2_GROUPS } from './metrics.ts'

/**
 * The v2 target thresholds (SPEC/20-feature-prompt-eval-runner.md rule 33). Proposed 2026-10-20
 * (slice 305) and **not yet confirmed**: rule 33 has them decided from the first v2 run, so the
 * summary reports them as met or not met and never lets them move an exit code. What does gate a
 * v2 run is carried over unchanged: the `refuse-*` recall floor of 1.0 (rule 31), a locked field
 * that survived (rule 16), and a regression against a baseline (rule 32).
 */
export const V2_TARGETS = {
  /** Of the v2 turns that were refused, how many were right; v1's baseline measured 0.95. */
  scopePrecision: 0.9,
  /** v1's baseline measured 0.95 overall. */
  overallMapping: 0.9,
  /** Each group of v2-only expectations. */
  groupAccuracy: 0.8,
} as const

export interface TargetResult {
  readonly name: string
  readonly target: number
  /** The point estimate; null when the run has no trial to judge it by. */
  readonly rate: number | null
  readonly met: boolean | null
}

function judged(name: string, target: number, p: Proportion): TargetResult {
  return { name, target, rate: p.rate, met: p.rate === null ? null : p.rate >= target }
}

/** Empty when the run drove no v2 turn. */
export function v2TargetResults(metrics: RunMetrics): TargetResult[] {
  const v2 = metrics.v2
  if (v2 === null) return []
  return [
    judged('v2 refusal precision', V2_TARGETS.scopePrecision, v2.scopeGate.precision),
    judged('v2 overall mapping accuracy', V2_TARGETS.overallMapping, v2.mapping),
    ...(Object.keys(V2_GROUPS) as V2Group[]).map((g) =>
      judged(`v2 ${V2_GROUPS[g]}`, V2_TARGETS.groupAccuracy, v2.groups[g]),
    ),
  ]
}
