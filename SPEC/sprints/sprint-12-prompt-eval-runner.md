# Sprint 12 — Prompt-eval runner

**Status:** Not started (planned 2026-09-28; slice 113's questions answered the same day).

**Goal:** a TypeScript runner for the `tools/prompt-eval` corpus that measures the live v1 idea
assistant, commits a baseline, compares a candidate prompt against it, and is ready to measure v2
before v2 is enabled. Authority: `SPEC/20-feature-prompt-eval-runner.md`; `SPEC/decisions.md`
2026-09-13 (the AI rescope and the runner lost in F6), 2026-09-27 ("Measurement comes first") and
2026-09-28 (the order of work, what existing decisions settle about the runner, and the answers
to its open questions);
`20-feature-ai-idea-assist-v2.md` "Prerequisite: measurement".

**Order.** After Sprint 11, before idea assistant v2 (answered 2026-09-28). Every question the spec
left open was answered 2026-09-28 with the recommended option.

**No CI in this sprint** (answered 2026-09-28): runs are local and the summary goes with the review.

**Out of this sprint:** idea assistant v2 itself (its prompt, turn contract and UI), a live v2 run
(it needs the v2 turn, so it lands with v2), the advisory publish probes (v1 rule 37, unchanged),
per-organization keys (tracker rule 30), and any hosted dashboard.

**No UI/UX work.** The runner is a command-line tool; that role sits out.

## Slices

Numbered 114–118. Slice 113 is the spec slice; `feature/112-qa-follow-ups` used 112 without a
tracker row.

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 114 | Runner core: corpus, turn loop, run file, ceilings | Backend | 113 answered | `tools/prompt-eval` becomes the workspace member `@collega/prompt-eval` (added to `pnpm-workspace.yaml`; Node type stripping, `node:test`, no new external dependency; workspace dependencies on `@collega/application` and `@collega/infrastructure`). Corpus loader with hand-written validation of cases and fixtures, and the two optional case keys (`pair`, `assistant`), with `"pair": "scope-coffee"` added to the two coffee cases. Fixture → `IdeaAssistContext` with name-derived UUID-shaped ids from `node:crypto`. The turn loop through the `IdeaDraftModel` port on `AnthropicIdeaDraftModel`, with the draft passed through `sanitizeDraft`, exported from `packages/application/src/ai/idea-assist.service.ts` for this; `--model`/`--effort` overrides recorded in the run header; `--yes` required above 100 planned calls; defaults of 5 repeats, 200 calls, 1,000,000 tokens and concurrency 1. `--dry-run`, `dump-prompt`, `--case`, `--repeats`, `--concurrency`, `--prompt-file` (both placeholders required), `--max-calls` and `--max-tokens` checked before each call, the run file of spec rule 19 in `runs/` (gitignored), and the key read from the environment or root `.env` and never written anywhere. The API's model and effort read from `DEFAULT_AI_USAGE_LIMITS` instead of literals in `adapters.providers.ts`, so the runner and the API share one source. Exit codes 0/1/2. No tests (slice 118). |
| 115 | Metrics, summary, compare and rescore | Backend | 114 | Spec rules 13–18: refusal precision and recall with refusal as the positive class and 95% Wilson intervals, split `refuse-*` / `scope-*`; the pair check; per-field mapping accuracy with wrong and empty rates and the micro-averaged overall figure; case pass rates and flaky marking; tokens, estimated cost at `DEFAULT_AI_USAGE_LIMITS` rates, latency p50/p95/max, the cache guard. The Markdown summary (rule 20). `rescore <run>`. `compare <baseline> <candidate>` with the like-with-like warnings (rule 34). The absolute floor and the relative regression rule (rules 30–32); `compare` flags an overridden model or effort. No tests (slice 118). |
| 116 | The v1 baseline and the operating manual | Backend | 115 | One live run of the v1 corpus at the default repeats with production's model, effort and `SYSTEM_PROMPT_TEMPLATE`, under the dedicated evaluation key (never production's); promoted to `tools/prompt-eval/baselines/v1-default.json` with its summary. `tools/prompt-eval/README.md` rewritten from "there is no runner" to how to run, compare and promote a baseline, keeping the methodology sections; the `hostile-catalog` note's stale pointer to the deleted .NET prompt builder corrected to `fence()` in `packages/application/src/ai/prompt-builder.ts` and `dump-prompt`. The first run's figures reported to the user, who confirms or adjusts the thresholds against them (spec rules 30–32). |
| 117 | The v2 case format and v2 cases | Backend | 115 | Spec rules 3–5 and 15–16: the v2 `expect` keys, `draft` and `lockedFields` per case, typed field definitions in the fixtures; the v2 cases the spec lists (structured fields per idea type, the interview order, a brainstorm turn, a locked field, a custom field), with the `refuse-*` and `scope-*` cases marked `"both"`. The scorer handles every v2 key from a run file, so the v2 figures and the locked-field survival check are ready before the v2 turn exists. The v2 model call itself is **not** built here: it is the v2 sprint's, and the first live v2 run is part of v2's enablement. |
| 118 | QA for the prompt-eval runner | QA | 114–117 | Per `SPEC/40-test-strategy.md`, hermetic, `node:test`, each rule checked by breaking it: corpus validation refuses a malformed case, an unknown fixture, an option name the fixture lacks and a template missing a placeholder; ids are stable across runs and the rendered prompt is byte-identical; the turn loop drops a refused turn and carries the draft (the adapter built with a fake client, never a real one); a ceiling stops the run, marks it aborted and exits 2; errored trials leave the denominators; precision, recall, intervals, per-field accuracy, wrong and empty rates, flaky marking and the pair check on hand-built run files with known answers; `compare` warns on each unlike field and exits 1 on each regression kind; the cache guard; `rescore` equals the original; no key in the run file, summary or stdout, including when the SDK error echoes a request; `--dry-run` and `rescore` work with no key set; nothing in `pnpm check` reaches a provider. The v2 scorer on hand-built v2 run files, including a surviving locked field failing the run. |

Every slice: its own worktree off `dev`, `pnpm check` green, Code Reviewer approval, merge to
`dev`, tracker updated.
