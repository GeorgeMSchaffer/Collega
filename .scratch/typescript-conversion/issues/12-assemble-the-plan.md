# 12 — Assemble the costed plan

Type: task
Status: open
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11

## Question

The destination artifact. Not a decision — the assembly of every decision above into the document this map exists to produce.

Produces, under `SPEC/`:

- **Sequenced slices**, each sized to one worktree agent session, in dependency order
- **An estimate in agent-slices** per slice, with the measured ~61,000-line baseline as the denominator and its confidence interval stated plainly
- **The validation strategy from `04` woven in as real slices** — including the ones that must run *before or during* Sprint 8, while the .NET API is still alive to record golden responses against. This is the only part of the effort that cannot be scheduled after Sprint 8 closes.
- **Cutover mechanics and rollback posture**, given big-bang was chosen (decision 6)
- **What is explicitly not being converted**

Should land as a numbered canonical spec plus a sprint file in `SPEC/sprints/`, matching how every prior epic here was planned. Update `SPEC/implementation-agent-tracker.md` when it does.

## Estimate hygiene

The estimate is the deliverable, so state its assumptions where a reader will actually see them:

- Which tickets' answers it depends on, and what changes if any of them is revisited
- That the baseline was **measured from the tree on `origin/dev`**, not read from a tracker — both tracker lineages were wrong about client size when this map was charted, and the estimate should not inherit that
- That agent-slices are a planning unit, not a promise of wall-clock time

## First-pass token estimate (2026-08-30, low confidence)

Anchored on the only real measurement available — the five comp agents run during charting, which averaged **~95 tokens per delivered line**, with browser-verified work costing roughly **1.6×** inspection-only work.

**Finishing this map** (tickets 01–12, producing the plan document): the two research tickets are the heavy ones at perhaps 150–250k each; grilling tickets are conversation at 50–100k each. **Call it 1.5–2.5M tokens.** Small, and the current authorized scope.

**Executing the conversion** (downstream, not yet authorized): the ~61,000-line baseline probably lands as ~40–45k lines of TypeScript including tests, since TS is terser and Prisma absorbs much of EF's configuration. At the comp rate that is ~4M — but that rate is greenfield single files with no integration. A rewrite re-reads the C# it replaces, debugs across package boundaries, and passes a review gate per slice; realistic multiplier **2–4×**.

Cross-checked against the chosen unit: ~70–90 slices (Application 10–12, Client 15–20, Infrastructure 8–10, API 8–10, tests 10–15, plus setup, auth, validation and specs) at ~200k per implementation slice is 14–18M, plus ~5M for review agents.

**Both roads land near the same place: ~15–30M tokens, centered around 20M.**

Three open tickets swing this materially:

- **`04`** — golden-capturing and replaying 81 endpoints adds ~2–3M on its own. Cheaper to skip, much riskier.
- **`10`** — porting 16,615 lines of tests case-by-case is expensive; re-deriving from spec is cheaper and discards the edge cases that caught the Sprint 5 defects.
- **`09`** — HTTP-only keeps slices cleanly partitioned; direct package imports blur the boundary and inflate integration debugging, which is exactly where the multiplier lives.
- **`01` Question C** — every adopted feature concept is net-new scope on top of the rewrite, not part of it.

Confidence: **low** on the multiplier, **moderate** on the slice count. Deliberately not converted to currency — that needs current per-model pricing checked rather than guessed.
