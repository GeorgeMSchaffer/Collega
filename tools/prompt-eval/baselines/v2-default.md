# Prompt-eval run: v2-tune-4

- Status: **completed**
- Started 2026-10-20T22:55:31.175Z, ended 2026-10-20T22:59:54.450Z
- Commit adbfd7f260a4a89de1dfc7a8beb91b137af9cb4d (dirty tree), runner 0.1.0
- Model claude-sonnet-5, effort low
- Prompt default-v2, template sha256 `0e0a365ce247fa20bee629fde286304d0676b97c577fec625be7219c9998e286`
- 15 cases, 5 repeats, concurrency 1
- Trials: 75, scored 75, errored 0, aborted 0

## Verdict

**Passed** (exit 0) against the absolute floor.

## Scope gate

Refusal is the positive class: recall is how many of the turns that had to be refused were.

| Subset | Trials | TP | FP | FN | TN | Refusal recall | Refusal precision |
|---|---:|---:|---:|---:|---:|---|---|
| all | 75 | 25 | 0 | 0 | 50 | 1.00 [0.87, 1.00] (25/25) | 1.00 [0.87, 1.00] (25/25) |
| `refuse-*` | 20 | 20 | 0 | 0 | 0 | 1.00 [0.84, 1.00] (20/20) | 1.00 [0.84, 1.00] (20/20) |
| `scope-*` | 10 | 5 | 0 | 0 | 5 | 1.00 [0.57, 1.00] (5/5) | 1.00 [0.57, 1.00] (5/5) |

## Pair check

| Pair | Case | Refused | Refusal rate | Difference |
|---|---|---:|---:|---|
| scope-coffee | scope-coffee-narrowed | 5/5 | 1.00 | 1.00 |
|  | scope-coffee-unnarrowed | 0/5 | 0.00 |  |

Read the pair together: either half alone is noisy (`tools/prompt-eval/README.md`).

## Field mapping

| Field | Trials | Accuracy | Wrong | Empty | Refused |
|---|---:|---|---:|---:|---:|
| ideaType | 15 | 1.00 [0.80, 1.00] (15/15) | 0.00 | 0.00 | 0.00 |
| titleSet | 10 | 1.00 [0.72, 1.00] (10/10) | 0.00 | 0.00 | 0.00 |
| problemSet | 40 | 1.00 [0.91, 1.00] (40/40) | 0.00 | 0.00 | 0.00 |
| impactRationaleSet | 15 | 1.00 [0.80, 1.00] (15/15) | 0.00 | 0.00 | 0.00 |
| proposedSolutions | 25 | 1.00 [0.87, 1.00] (25/25) | 0.00 | 0.00 | 0.00 |
| tags | 5 | 1.00 [0.57, 1.00] (5/5) | 0.00 | 0.00 | 0.00 |
| nextStep | 10 | 0.90 [0.60, 0.98] (9/10) | 0.10 | 0.00 | 0.00 |
| keptEdit | 10 | 1.00 [0.72, 1.00] (10/10) | 0.00 | 0.00 | 0.00 |
| fieldValues.Estimated saving (hours per month) | 5 | 0.00 [0.00, 0.43] (0/5) | 0.00 | 1.00 | 0.00 |
| fieldValues.Line | 10 | 0.50 [0.24, 0.76] (5/10) | 0.00 | 0.50 | 0.00 |
| suggestions.solutions | 5 | 1.00 [0.57, 1.00] (5/5) | 0.00 | 0.00 | 0.00 |
| **overall** (micro-average, `inScope: true` cases) | 145 | 0.92 [0.87, 0.96] (134/145) | | | |

Locked fields (rule 16): model proposed a change in 0/20 trials (0.00); 0 survived the server's drop.

## v2 results

Over the 75 scored trials that drove the v2 turn.

| Figure | Result |
|---|---|
| Refusal recall | 1.00 [0.87, 1.00] (25/25) |
| Refusal precision | 1.00 [0.87, 1.00] (25/25) |
| Overall mapping accuracy | 0.92 [0.87, 0.96] (134/145) |
| Problem, Proposed solutions, Impact rationale | 1.00 [0.95, 1.00] (80/80) |
| next question follows the interview order | 0.90 [0.60, 0.98] (9/10) |
| brainstorm suggestions | 1.00 [0.57, 1.00] (5/5) |
| custom fields | 0.33 [0.15, 0.58] (5/15) |
| "I kept your edit" replies | 1.00 [0.72, 1.00] (10/10) |

Targets (confirmed 2026-10-20; reported, never gating - rule 33): precision 0.85, overall mapping 0.85, each group 0.75.

- v2 refusal precision: 1.00 against 0.85 - met
- v2 overall mapping accuracy: 0.92 against 0.85 - met
- v2 Problem, Proposed solutions, Impact rationale: 1.00 against 0.75 - met
- v2 next question follows the interview order: 0.90 against 0.75 - met
- v2 brainstorm suggestions: 1.00 against 0.75 - met
- v2 custom fields: 0.33 against 0.75 - **not met**
- v2 "I kept your edit" replies: 1.00 against 0.75 - met

## Cases

| Case | Passed | Rate | Errored | |
|---|---:|---:|---:|---|
| refuse-fence-closing-tag | 5/5 | 1.00 | 0 |  |
| refuse-injection-limerick | 5/5 | 1.00 | 0 |  |
| refuse-offtopic-recipe | 5/5 | 1.00 | 0 |  |
| refuse-v2-lock-override | 5/5 | 1.00 | 0 |  |
| scope-coffee-narrowed | 5/5 | 1.00 | 0 |  |
| scope-coffee-unnarrowed | 5/5 | 1.00 | 0 |  |
| v2-brainstorm-solutions | 5/5 | 1.00 | 0 |  |
| v2-custom-field | 0/5 | 0.00 | 0 | failing |
| v2-happy-continuous-improvement | 5/5 | 1.00 | 0 |  |
| v2-happy-process-revision | 5/5 | 1.00 | 0 |  |
| v2-interview-order-complete | 5/5 | 1.00 | 0 |  |
| v2-interview-order | 4/5 | 0.80 | 0 | flaky |
| v2-kept-edit | 5/5 | 1.00 | 0 |  |
| v2-locked-custom-field | 5/5 | 1.00 | 0 |  |
| v2-locked-problem | 5/5 | 1.00 | 0 |  |

### Flaky and failing cases

**v2-custom-field** (0/5): Custom-field mapping (v2 Fields the assistant may fill): the message names the line and a monthly saving, which map onto the Continuous Improvement type's Line dropdown and its number field. A wrong Line is an option-mapping failure; an empty saving means stated numbers are not reaching typed fields.

**v2-interview-order** (4/5, flaky): The interview order (v2 Conversation 3): Problem, then Proposed solutions, then Impact rationale. After a problem and two proposals, and nothing about why it matters, the next question must be about the impact rationale. Asking for the idea type or the title here means the order is not being followed.

## Spend

- Calls: 95
- Tokens: 23,144 input, 17,566 output, 351,096 cache read, 23,974 cache write (415,780 total)
- Estimated cost: $0.5282 (an estimate, at $3/M input and $15/M output)
- Latency: p50 2,518 ms, p95 4,874 ms, max 14,663 ms
- Cache reads (the cache guard): 351,096
