import type { Proportion, RunMetrics, ScopeGateMetrics } from './metrics.ts'
import type { RunData } from './run-file.ts'
import { fmt, type Verdict } from './verdict.ts'

/** The human summary of rule 20: written beside the run file and printed to stdout. */
export function renderSummary(run: RunData, metrics: RunMetrics, verdict: Verdict): string {
  const h = run.header
  const out: string[] = []
  const overridden = (flag: boolean) => (flag ? ' (overridden)' : '')

  out.push(`# Prompt-eval run: ${h.label}`)
  out.push('')
  out.push(`- Status: **${h.status}**${h.abortReason ? ` (${h.abortReason})` : ''}`)
  out.push(`- Started ${h.startedAt}, ended ${h.endedAt}`)
  out.push(
    `- Commit ${h.git.commit ?? 'unknown'}${h.git.dirty ? ' (dirty tree)' : ''}, runner ${h.runnerVersion}`,
  )
  out.push(
    `- Model ${h.model}${overridden(h.modelOverridden)}, effort ${h.effort}${overridden(h.effortOverridden)}`,
  )
  out.push(`- Prompt ${h.prompt.source}, template sha256 \`${h.prompt.templateSha256}\``)
  out.push(
    `- ${h.cases.length} cases${h.caseSelection ? ` (selected: ${h.caseSelection.join(', ')})` : ''}, ${h.repeats} repeats, concurrency ${h.concurrency}`,
  )
  out.push(
    `- Trials: ${metrics.trials.total}, scored ${metrics.trials.scored}, errored ${metrics.trials.errored}, aborted ${metrics.trials.aborted}`,
  )
  out.push('')

  out.push('## Verdict')
  out.push('')
  out.push(verdictLine(verdict))
  for (const reason of verdict.invalidReasons) out.push(`- Invalid: ${reason}`)
  for (const failure of verdict.failures)
    out.push(`- Failed: ${failure.metric} - ${failure.detail}`)
  for (const warning of verdict.warnings) out.push(`- Warning: ${warning}`)
  out.push('')

  out.push('## Scope gate')
  out.push('')
  out.push(
    'Refusal is the positive class: recall is how many of the turns that had to be refused were.',
  )
  out.push('')
  out.push('| Subset | Trials | TP | FP | FN | TN | Refusal recall | Refusal precision |')
  out.push('|---|---:|---:|---:|---:|---:|---|---|')
  const gate = (name: string, g: ScopeGateMetrics) =>
    out.push(
      `| ${name} | ${g.trials} | ${g.truePositives} | ${g.falsePositives} | ${g.falseNegatives} | ${g.trueNegatives} | ${proportion(g.recall)} | ${proportion(g.precision)} |`,
    )
  gate('all', metrics.scopeGate.all)
  gate('`refuse-*`', metrics.scopeGate.refuse)
  gate('`scope-*`', metrics.scopeGate.scope)
  out.push('')

  if (metrics.pairs.length > 0) {
    out.push('## Pair check')
    out.push('')
    out.push('| Pair | Case | Refused | Refusal rate | Difference |')
    out.push('|---|---|---:|---:|---|')
    for (const p of metrics.pairs) {
      const flag = p.scopeStatementMayBeIgnored ? ' **scope statement may be ignored**' : ''
      p.halves.forEach((half, i) => {
        out.push(
          `| ${i === 0 ? p.pair : ''} | ${half.caseId} | ${half.refusals}/${half.trials} | ${fmt(half.refusalRate)} | ${i === 0 ? `${fmt(p.difference)}${flag}` : ''} |`,
        )
      })
    }
    out.push('')
    out.push('Read the pair together: either half alone is noisy (`tools/prompt-eval/README.md`).')
    out.push('')
  }

  out.push('## Field mapping')
  out.push('')
  out.push('| Field | Trials | Accuracy | Wrong | Empty | Refused |')
  out.push('|---|---:|---|---:|---:|---:|')
  for (const [field, m] of Object.entries(metrics.fields)) {
    out.push(
      `| ${field} | ${m.trials} | ${proportion(m.accuracy)} | ${fmt(m.wrongRate)} | ${fmt(m.emptyRate)} | ${fmt(m.refusedRate)} |`,
    )
  }
  out.push(
    `| **overall** (micro-average, \`inScope: true\` cases) | ${metrics.overallMapping.n} | ${proportion(metrics.overallMapping)} | | | |`,
  )
  out.push('')
  const locked = metrics.lockedFields
  if (locked === null) {
    out.push('Locked fields: no case in this run declares them.')
  } else {
    out.push(
      `Locked fields (rule 16): model proposed a change in ${locked.proposals}/${locked.trials} trials (${fmt(locked.proposalRate)}); ${locked.survivals} survived the server's drop${locked.survivals > 0 ? ` - **a defect**: ${locked.survived.join('; ')}` : ''}.`,
    )
  }
  out.push('')

  out.push('## Cases')
  out.push('')
  out.push('| Case | Passed | Rate | Errored | |')
  out.push('|---|---:|---:|---:|---|')
  for (const c of metrics.cases) {
    const mark = c.flaky ? 'flaky' : c.passRate !== null && c.passRate < 1 ? 'failing' : ''
    out.push(
      `| ${c.caseId} | ${c.passes}/${c.trials} | ${fmt(c.passRate)} | ${c.errored} | ${mark} |`,
    )
  }
  const attention = metrics.cases.filter((c) => c.passRate !== null && c.passRate < 1)
  if (attention.length > 0) {
    out.push('')
    out.push('### Flaky and failing cases')
    for (const c of attention) {
      out.push('')
      out.push(
        `**${c.caseId}** (${c.passes}/${c.trials}${c.flaky ? ', flaky' : ''}): ${run.cases[c.caseId]?.note ?? ''}`,
      )
    }
  }
  out.push('')

  if (metrics.erroredTrials.length > 0) {
    out.push('## Errored trials')
    out.push('')
    for (const t of metrics.erroredTrials) {
      out.push(`- ${t.caseId} #${t.repeat + 1}: ${t.error ?? 'no message'}`)
    }
    out.push('')
  }

  const u = metrics.usage
  out.push('## Spend')
  out.push('')
  out.push(`- Calls: ${u.calls}`)
  out.push(
    `- Tokens: ${n(u.inputTokens)} input, ${n(u.outputTokens)} output, ${n(u.cacheReadInputTokens)} cache read, ${n(u.cacheCreationInputTokens)} cache write (${n(u.totalTokens)} total)`,
  )
  out.push(
    `- Estimated cost: $${u.estimatedCostUsd.toFixed(4)} (an estimate, at $${u.rates.inputPerMillion}/M input and $${u.rates.outputPerMillion}/M output)`,
  )
  out.push(
    u.latencyMs === null
      ? '- Latency: no calls'
      : `- Latency: p50 ${n(u.latencyMs.p50)} ms, p95 ${n(u.latencyMs.p95)} ms, max ${n(u.latencyMs.max)} ms`,
  )
  out.push(`- Cache reads (the cache guard): ${n(u.cacheReadInputTokens)}`)
  out.push('')

  return out.join('\n')
}

export function verdictLine(verdict: Verdict): string {
  const against = verdict.baseline === null ? 'the absolute floor' : `baseline ${verdict.baseline}`
  if (!verdict.valid) return `**Not a valid run** (exit 2), judged against ${against}.`
  if (verdict.failures.length > 0) {
    return `**Thresholds failed** (exit 1): ${verdict.failures.length} failure(s) against ${against}.`
  }
  return `**Passed** (exit 0) against ${against}.`
}

export function proportion(p: Proportion): string {
  return p.rate === null ? '-' : `${fmt(p.rate)} [${fmt(p.low)}, ${fmt(p.high)}] (${p.k}/${p.n})`
}

function n(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}
