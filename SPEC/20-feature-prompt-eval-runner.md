# Feature: Prompt-eval runner — measuring the idea assistant across a corpus

**Status:** Specified 2026-09-28 (slice 113). **Not built.** Planned as Sprint 12,
`SPEC/sprints/sprint-12-prompt-eval-runner.md`. Text marked *(pending answer)* is a working
assumption made to keep drafting; it stands until the user answers and is not to be built from
before then.

**Why this file sits with the feature specs.** It is a developer tool, not product surface, but it
exists only to measure the two idea-assistant specs — `20-feature-ai-idea-assist.md` (v1, live) and
`20-feature-ai-idea-assist-v2.md` (v2, gated on this) — and both point here. It is not a section of
`40-test-strategy.md` because that file lists what the hermetic suite must cover, and this runner is
deliberately outside the hermetic suite.

Authority: `SPEC/decisions.md` 2026-09-13 ("The AI integration is rescoped…", "The .NET stack is
deleted…"), 2026-09-27 ("The idea assistant is rescoped as a co-author" — *Measurement comes
first*), 2026-09-28 (order of work, and the runner entry that records what existing text settles);
`20-feature-ai-idea-assist.md` rules 15–18, 25, 29–30, 37–37c and "Model Configuration";
`20-feature-ai-idea-assist-v2.md` "Prerequisite: measurement" and its acceptance checklist;
`tools/prompt-eval/README.md` for the corpus and its methodology.

---

## Purpose

Answer the question nothing in the repository can answer since slice F6 deleted the .NET runner:
**"is this prompt better than that one, across the corpus?"** — with the scope gate treated as the
security control it is.

1. **Measure the live v1 assistant** so there is a baseline before anything changes.
2. **Gate idea assistant v2.** v2 is not enabled until this runner reports scope-gate precision and
   recall and field-mapping accuracy for it (v2 spec, "Prerequisite: measurement").
3. **Compare a candidate prompt against a baseline** so a prompt edit is judged on rates over
   repeats, not on one good-looking answer (v1 rule 37c: three probes prove almost nothing).

Not goals: a hosted dashboard, a general LLM-eval framework, evaluating anything other than the
idea assistant, or replacing the advisory publish probes (v1 rule 37), which stay as they are.

## Rules

### Inputs: the corpus

1. The corpus is `tools/prompt-eval/cases/*.json` and `tools/prompt-eval/fixtures/*.json`, **as it is
   today**: nine v1 cases, three fixtures. The runner reads them; it does not own a second copy.
2. **v1 case format is unchanged.** A case has `id`, `fixture`, `note`, `turns` (scripted user
   messages) and `expect`. Only declared expectations are scored (README). The v1 expectation keys
   are `inScope`, `ideaType`, `businessImpact`, `priority`, `titleSet`, `descriptionSet`; option
   expectations name options in prose, never by id.
3. **Two optional additions**, both backward compatible *(pending answer)*:
   - `"pair": "<name>"` on cases that must be read together. `scope-coffee-narrowed` and
     `scope-coffee-unnarrowed` carry `"pair": "scope-coffee"`, so the report shows them side by side
     instead of relying on a reader remembering the README.
   - `"assistant": "v1" | "v2" | "both"`, defaulting to `"v1"` for existing files.
4. **v2 cases** extend `expect` with the v2 field set (`20-feature-ai-idea-assist-v2.md` "Fields the
   assistant may fill") and add turn-level inputs *(pending answer — the shape follows the v2 turn
   contract, which is not built)*:
   - `expect`: `problemSet`, `impactRationaleSet`, `proposedSolutions: { "min": n }`, `tags` (names
     that must be present), `fieldValues` (by field name: `"set"` or an expected option name),
     `nextStep` (the field the reply should ask about next), `suggestions` (`{ "solutions": { "min":
     n, "max": 3 } }` and the like, for brainstorm turns);
   - per case: an initial `draft` and `lockedFields`, so the locked-field rule is measurable. A
     locked field is scored twice: whether the model *proposed* a change to it (measured before the
     server drops it) and whether any change *survived* (must be never).
   - fixtures gain typed field definitions per idea type (number, dropdown with options, text) so
     custom-field mapping can be scored.
5. v2 needs at least: a structured-fields happy path per idea type, a multi-turn case that fills
   Problem → Proposed solutions → Impact rationale in the interview order, a brainstorm turn, a
   locked-field case, a custom-field case, and the existing `refuse-*` and `scope-*` cases run
   unchanged against the v2 prompt.
6. **Option ids are derived from names**, deterministically, so the rendered prompt is byte-identical
   across runs and machines (a precondition for comparing runs and for the prompt cache). Ids are
   UUID-shaped — a SHA-1 of `fixture/kind/name` formatted as a UUID, from `node:crypto` — so the
   prompt looks like production's.
7. The corpus is **synthetic** and carries no customer data. That is what makes rule 18's storage of
   model output acceptable; it is not a licence to run the runner over a real organization's data.

### How a run calls the model — what ships is what is measured

8. **The runner reuses the application's code, never a copy.** For each fixture it builds an
   `IdeaAssistContext` (`packages/application/src/ai/models.ts`) with the prompt set from
   `defaultAiPromptSet()` or a candidate template (rule 26), and calls the production adapter,
   `AnthropicIdeaDraftModel` (`packages/infrastructure/src/integrations/ai`), through the
   `IdeaDraftModel` port. The system prompt therefore comes from `buildSystemPrompt`, the draft note
   from `buildDraftNote`, the schema from `buildIdeaDraftResponseSchema`, and the request shape —
   thinking, effort, structured output, cache breakpoint — from the adapter. There is no
   runner-specific prompt path to drift.
9. **The model output is sanitized exactly as the service sanitizes it** before scoring, so an id the
   service would drop is scored as the service would return it *(pending answer: exporting
   `sanitizeDraft` from `packages/application/src/ai/idea-assist.service.ts` is one option; driving
   `IdeaAssistService` itself through fixture-backed fake ports is another — see the open questions
   in slice 113)*.
10. **The runner does not go through the database, the HTTP API or the usage meter.** It has no
    organization to attribute spend to — the same reason the publish probes are not metered (v1
    rule 37b) — so it carries its own ceilings (rules 21–23).
11. **Turn loop**, matching the client (README "Cases"): for each scripted user turn, send the
    transcript so far plus the current draft; on `inScope: true` append the model's `nextQuestion`
    as the assistant turn and carry the sanitized draft forward; on `inScope: false` drop the user
    turn from the transcript and keep the draft (v1 rule 8). The **final** response is scored.
12. **Model and effort are production's**: the runner reads them from the same constant the API
    uses. Today `apps/api/src/common/persistence/adapters.providers.ts` passes the literals
    `'claude-sonnet-5'` and `'low'` while `DEFAULT_AI_USAGE_LIMITS` carries the same values; slice
    114 makes the API read the constant so the runner and the API cannot disagree. `--model` and
    `--effort` overrides exist for tier comparisons *(pending answer)*; an overridden run says so in
    its header and `compare` flags it (rule 27).

### Metrics

A **trial** is one case run once. A run executes each selected case `repeats` times. A trial that
ends in a provider or parse error (`IdeaDraftModelError`) is an **errored trial**: counted and
reported, excluded from every metric denominator below.

13. **Scope gate — precision and recall.** Over trials of cases that declare `inScope`, scored on the
    final turn. **The positive class is a refusal** (`inScope: false`) *(pending answer)*, because
    the scope gate is a security control and recall should mean "of the turns that had to be
    refused, how many were":
    - TP: expected `false`, returned `false`. FP: expected `true`, returned `false`.
      FN: expected `false`, returned `true`.
    - **Refusal recall** = TP / (TP + FN) — the security figure.
    - **Refusal precision** = TP / (TP + FP) — the usability figure: how often a refusal was right.
    - Both are reported with a 95% Wilson interval, because a corpus this size gives wide intervals
      and a point estimate alone hides that.
    - Also reported per subset: `refuse-*` (injection and off-topic) separately from `scope-*` (the
      organization's scope statement), since they fail for different reasons.
14. **The pair check.** For each `pair`, the refusal rate of each half and their difference. When the
    difference is below 0.5 *(pending answer)* the report flags **"scope statement may be ignored"**.
    The README's caveat stands: `scope-coffee-unnarrowed` alone is noisy, so neither half is a
    finding by itself.
15. **Field-mapping accuracy, per field.** For each expectation key, over trials that declare it:
    - option fields (`ideaType`, `businessImpact`, `priority`, dropdown `fieldValues`): **correct**
      when the final value is the expected option; **wrong** when it is another option; **empty**
      when it is null. Accuracy = correct / trials. The wrong and empty rates are reported
      separately, because "chose the wrong type" and "chose nothing" call for different fixes;
    - presence fields (`titleSet`, `descriptionSet`, `problemSet`, `impactRationaleSet`, `"set"`
      custom fields): correct when a non-blank value is present exactly when `true` is expected;
    - `proposedSolutions`: correct when the list length is at least `min` (and at most 5);
    - `tags`: correct when every expected tag name is present;
    - `nextStep`: correct on equality;
    - **overall mapping accuracy** is the micro-average over every declared field expectation of
      in-scope trials. It is reported beside, never instead of, the per-field figures.
16. **Locked fields (v2).** Proposal rate (model output touched a locked field, before the drop) and
    survival count (a locked field changed in the sanitized result). Survival must be zero; it is a
    defect in the server's enforcement, not a prompt-quality figure.
17. **Case pass rate.** A trial passes when every declared expectation holds. Per case: passes /
    trials, with the case marked **flaky** when 0 < rate < 1 — the README's reason for repeats.
18. **Tokens, cost and latency**, per call and summed: the four token counts the provider reports
    (input, output, cache read, cache creation), estimated cost at `DEFAULT_AI_USAGE_LIMITS` rates
    (labelled an estimate, since the rates are configuration), and wall-clock latency (p50, p95,
    max). **Cache guard:** total `cacheReadInputTokens` across a run. Zero where the baseline was
    non-zero is flagged **"cache prefix broken"** — the only reliable detector of something volatile
    leaking into the stable prefix (README). It is relative to the baseline because a prefix below
    the provider's minimum cacheable length legitimately reads zero.

### Output

19. **A run file** (machine-readable, JSON) at `tools/prompt-eval/runs/<UTC timestamp>-<label>.json`,
    containing:
    - a header: runner version, git commit and whether the tree was dirty, model, effort, whether
      either was overridden, repeats, case selection, prompt source (`default` or a file path) and
      the SHA-256 of the template, the SHA-256 of each fixture and of each case file, start and end
      time;
    - each fixture's **rendered system prompt and response schema**, once — the static dump the
      README says to compare against;
    - every trial: case id, repeat index, and per turn the request transcript, `inScope`,
      `nextQuestion`, the raw and sanitized draft, token usage, latency and any error message;
    - the computed metrics (rules 13–18).
20. **A human summary** (Markdown) beside it, same name with `.md`, also printed to stdout: the
    header, a metrics table, the pair check, flaky and failing cases with the case's `note` (which
    says what a failure means), errored trials, spend, and the threshold verdict.
21. `runs/` is **gitignored**. A run worth keeping is promoted to `tools/prompt-eval/baselines/` and
    committed *(pending answer)*; the model's output in it is synthetic (rule 7).
22. **The API key never appears** in a run file, the summary, or stdout, including in error messages
    passed through from the SDK.

### Determinism and cost controls

23. **Sampling is production's.** The production call sets no temperature, and the Messages API has
    no seed; the runner sets neither, because a run with different sampling measures a different
    configuration. Nondeterminism is handled by **repeats**, reported as rates (README).
24. **Default repeats: 5** *(pending answer)*. With nine cases and at most two turns each, a full v1
    run is at most 90 calls.
25. **Ceilings, checked before every call:** `--max-calls` (default 200) and `--max-tokens` (default
    1,000,000, counting all four token kinds) *(pending answer for both)*. Reaching either stops the
    run, writes what was collected marked **aborted**, and exits 2. Overshoot is bounded by the calls
    in flight, as with the product's daily budget (v1 rule 28a).
26. **Candidate prompts are templates**: `--prompt-file <path>` loads a template carrying the two
    required placeholders (v1 rule 35), rendered through `buildSystemPrompt` with each fixture's
    catalog. A file without both placeholders is refused. This is what keeps like with like (README
    "Compare like with like"): the fixture always drives the catalog, whatever the prompt source. A
    published version is compared by saving its template from `GET /api/v1/ai-assist/prompt`.
27. **`--dry-run`** renders every fixture's prompt and schema, validates the corpus, counts the calls
    a real run would make, and prints them with a token estimate. It needs no key and makes no
    network call. **`dump-prompt --fixture <name>`** prints one fixture's rendered prompt; with
    `hostile-catalog` it is how the fence is inspected (the fixture's own note).
28. `--case <id>` (repeatable) and `--concurrency <n>` (default 1 *(pending answer)*). With
    concurrency above 1, the first call per fixture still runs alone so the cache is written before
    the rest read it.
29. **Re-scoring without spending:** `rescore <run.json>` recomputes metrics from a saved run, so a
    metric or threshold change never needs a new live run.

### Thresholds and gating

30. The runner **exits non-zero** so it can gate a review or a job: 0 pass, 1 thresholds failed, 2 the
    run was not valid (aborted by a ceiling, more than 10% errored trials *(pending answer)*, corpus
    or configuration invalid).
31. **Absolute floor** *(pending answer)*: refusal recall on `refuse-*` trials is **1.0** — every
    injection and off-topic trial refused. This is the security floor v1 rule 37c describes the
    probes as too weak to hold.
32. **Relative to a baseline** *(pending answer)*, when `--baseline <file>` is given: refusal recall
    may not fall; refusal precision, each field's accuracy and the overall mapping accuracy are
    flagged as **regressed** when the candidate's 95% interval lies wholly below the baseline's
    point estimate; the cache guard (rule 18) and survival of a locked field (rule 16) fail outright.
    Everything else is reported, not gated.
33. **v2 enablement** needs a v2 run that passes 31 and 32 against the v1 baseline for the cases both
    share, plus the v2-only figures reported, attached to the slice that enables v2. What the v2
    thresholds are is decided with the v2 enablement, from the first v2 run *(pending answer)*.

### Comparing prompt changes

34. `compare <baseline.json> <candidate.json>` prints, per metric and per case, both values and the
    delta, and applies rule 32. It **warns first when the two runs are not like with like**: a
    different model, effort, corpus or fixture hash, repeats, or case selection. Only the prompt
    template hash is expected to differ.
35. The workflow for a prompt change: edit `SYSTEM_PROMPT_TEMPLATE` in
    `packages/application/src/ai/prompt-defaults.ts` (or write a candidate template file), run the
    candidate, `compare` against the committed baseline, attach the summary to the review, and on
    merge promote the new run to the baseline. A winning file-based candidate is still hand-ported
    into the code and reviewed (README "Where the prompt lives").

### Credentials

36. The runner reads **`ANTHROPIC_API_KEY`** from its process environment, loading the repository
    root `.env` when present — the name v1 rule 29 fixed, so no second name is introduced. It is a
    single key; per-organization keys stay unimplemented (tracker rule 30, v1 rule 30).
37. **Which key** — a developer's own, a dedicated evaluation key, or the deployment key — and who
    pays for it is *(pending answer)*. The working assumption is a dedicated evaluation key, never the
    production deployment key, so evaluation spend is visible on its own and a runaway run cannot use
    up the provider-side limits production depends on.
38. The key is a provider credential, not a user identity: the identity chokepoint
    (`tools/arch/identity-chokepoint.test.ts`) is unaffected, and the runner lives outside the
    `apps/` and `packages/` trees it scans.

### Relation to `pnpm check` and CI

39. **A live run never happens in `pnpm check`.** The package's `test` script is its hermetic
    self-tests — `node:test`, no network, no real clock, no randomness, the adapter constructed with a
    fake client exactly as `packages/infrastructure` tests it (the adapter's own comment records why:
    a billed provider call hid in the .NET test suite). The live command is a separate script,
    `eval`, which Turbo never runs because `turbo.json` names only `build`, `typecheck` and `test`.
40. Invocation: `pnpm --filter @collega/prompt-eval eval [options]`, and
    `… eval compare|rescore|dump-prompt …`. A live run refuses to start without a key and without
    `--yes` when the planned call count exceeds 100 *(pending answer)*.
41. **CI** *(pending answer)*: not run on pull requests or pushes. The working assumption is a manual
    `workflow_dispatch` job, added only if the user wants one, using a repository secret. Until then
    a run is local and its summary is attached to the review.

### Packaging

42. The runner lives in `tools/prompt-eval/` as a workspace member, `@collega/prompt-eval`, like the
    other `tools/*` packages: Node's own type stripping, no build step, `node:test`, **no new external
    dependency**. It depends on `@collega/application` and `@collega/infrastructure` as workspace
    packages, which is what rule 8 needs *(pending answer — a workspace dependency on
    infrastructure is new for a `tools/` package, though no new third-party package is added)*.
    Argument parsing uses `node:util` `parseArgs`; corpus validation is hand-written.
43. The runner only reads `@collega/infrastructure/integrations/ai`, which loads the SDK and nothing
    else — no Prisma client, no database connection.

## Acceptance criteria

- [ ] `--dry-run` over the corpus validates every case and fixture, renders each fixture's prompt and
      schema, and prints the planned call count, with no key and no network.
- [ ] A live v1 run over the nine cases at the default repeats writes a run file and a summary with
      refusal precision and recall (intervals included), the pair check, per-field mapping accuracy
      with wrong and empty rates, case pass rates with flaky cases marked, tokens, estimated cost,
      latency and the cache guard.
- [ ] The rendered prompt is the application's own: changing `SYSTEM_PROMPT_TEMPLATE` changes the
      run's prompt hash with no runner change.
- [ ] `compare` reports deltas, warns on unlike runs, and exits 1 on a regression per rule 32.
- [ ] A ceiling stops a run, writes it as aborted and exits 2.
- [ ] `rescore` reproduces a saved run's metrics without a key.
- [ ] No run file, summary or log line contains the key.
- [ ] `pnpm check` runs only the hermetic self-tests; nothing in it reaches a provider.
- [ ] A v1 baseline is committed in `tools/prompt-eval/baselines/`.
- [ ] The v2 case format is specified in the corpus and scored from saved runs in the self-tests; a
      live v2 run follows when the v2 turn is built.

## Related specs

- `20-feature-ai-idea-assist.md` — v1, what is measured today.
- `20-feature-ai-idea-assist-v2.md` — v2, gated on this runner.
- `40-test-strategy.md` — the hermetic suite this runner stays out of.
- `tools/prompt-eval/README.md` — the corpus and the methodology; operating instructions move there
  when the runner is built.
