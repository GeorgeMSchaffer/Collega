# Sprint 9 — TypeScript Stack Conversion

Status: **ACTIVE — this is the current sprint (2026-09-04).** Sprint 8 was cancelled and
Sprint 7.5 closed the same day; .NET development has stopped. Wave 0 is unblocked — tickets
`06` and `08` were decided 2026-09-04, and `08` was the last thing gating it.
Written 2026-08-31, activated 2026-09-04.

**Full plan, slice inventory, collision model, and estimate: `SPEC/50-typescript-migration.md`.**
This file is the execution wrapper only — sequencing, role assignment, and the definition
of done. It deliberately does not restate the plan.

---

## Wave A is already done

**Complete 2026-09-03**: 447 cases over all 81 endpoints at four roles and anonymous,
recorded from the live .NET API and replaying 447/447 clean. Committed under
`tools/golden/` — it *is* the oracle.

It ran ahead of this sprint deliberately, because it can only be recorded against a live
.NET API. That deadline has not gone away, it has moved: **cutover deletes the .NET
solution**, and after that the recording can never be made again. So until Wave F,
`dotnet run` and `dotnet test` must keep working even though no development happens on
them — a change that breaks the API's boot path is still a problem.

Re-capture only if the API surface changes, and against a freshly seeded database
(`tools/golden/README.md` explains why, and how).

| Slice | Owns | State |
|---|---|---|
| A1 capture harness | `tools/golden/` | **Done 2026-09-03** |
| A2 golden corpus | `tools/golden/fixtures/` — 81 endpoints × 4 roles, error paths included | **Open — needs the running .NET API and a freshly seeded database** |
| A3 replay harness | `tools/golden/replay/` | **Done 2026-09-03** |

A2 is now the whole of Wave A's remaining risk. The harness generates the case grid
(`golden scaffold`), refuses to record a case still marked `todo`, and reports coverage
against the endpoint list it reads from the controllers — so what is left is filling in
request bodies against a running API, and running the capture. `tools/golden/README.md`.

---

## Wave sequencing

Waves run in order. Slices *within* a wave run concurrently up to the stated ceiling,
which is set by path collisions (see the plan's §4) and throttled further by review
throughput.

| Wave | What | Max concurrent | Starts when |
|---|---|---:|---|
| A | Golden capture | 2 | **Started 2026-08-31** — must finish before Sprint 8 closes |
| 0 | Foundation: monorepo, Prisma schema, kernel | **1 (serial)** | Sprint 8 complete |
| B | Domain + Application, 7 feature partitions | 7 | S0.3 merged |
| C | Infrastructure: repositories, integrations | 2 | S0.2 merged |
| D | API, mirroring B's partition | 7 | per-partition, as each B*n* merges |
| E | Web — **E0 design system first, alone** | 6 after E0 | E0 merged; D*n* merged for the routes it calls |
| F | Validation, data migration, cutover | 3 → 1 | D complete, E complete |

D*n* does not wait for all of Wave B — it waits for **B*n***. The partitions are
independent, so partition 3 can be in D while partition 5 is still in B.

## Role assignment

Maps onto `CLAUDE.md`'s multi-agent worktree workflow. Every implementer gets its own
worktree branched off `dev`; the Code Reviewer gates each branch before merge and is not
a parallel implementer.

| Role | Waves |
|---|---|
| Backend Developer | A, 0, B, C, D |
| UI/UX Developer | E (sits out A, 0, B, C, D entirely) |
| QA Developer | F1, F2, and per-slice Vitest coverage throughout — **not written by the agent that wrote the code under test** |
| Code Reviewer | every wave, gating every merge |

**Recommended concurrency: 3–5 implementers plus 1 reviewer**, not the collision ceiling.
The ceiling says what is *safe*; the reviewer says what is *sustainable*.

## Standing rules for every slice

1. **Own your globs.** An agent that needs to edit a path it does not own stops and
   escalates. It does not edit it.
2. **The Prisma schema is frozen after S0.2.** Changes go through a dedicated schema
   amendment slice, one at a time, never inside a feature slice.
3. **`SPEC/30-Contracts.md` is read, never edited**, by Waves D and E. Contract changes
   are an escalation.
4. **The tracker is updated at merge time**, by whoever merges, never inside a worktree.
5. Once merged into `dev`, **delete both the worktree and the branch.**

## Definition of done

Beyond `SPEC/90-definition-of-done.md`:

- **F1 green** — all 81 endpoints × 4 roles replay clean against Nest. This is the gate;
  nothing cuts over before it.
- **F2 green** — the adapted Playwright suite passes against the comp P UI.
- Layer boundaries pass lint (`eslint-plugin-boundaries`), including the rule that
  `apps/web` never imports `packages/application`.
- The standard demo seed (2 orgs, 8 users, 4 boards, 44 ideas) exists in the new stack.
- F4's rollback window is **stated**, and F3 has answered in writing whether the data
  transform is reversible.

## Open before this sprint can start

Answered 2026-09-03 and no longer gating: `01` (comp P on Tailwind + shadcn/ui, and
Question C — Wave G), `02` (Vercel + Prisma Postgres), `10` (discard the .NET suite).
All three are in `SPEC/decisions.md`.

Still open on the conversion map:

- **`05` Prisma introspection fidelity** and **`07` View As ambient identity** — the two
  AFK research tickets. Neither has started. `06` (schema reshape scope) waits on `05`,
  `08` (auth / session model) waits on `07`, and **`08` gates Wave 0**.
- **`11` spec reconciliation.**
