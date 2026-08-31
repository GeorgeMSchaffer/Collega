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
