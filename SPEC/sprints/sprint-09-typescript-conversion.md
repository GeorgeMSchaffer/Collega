# Sprint 9 — TypeScript Stack Conversion

Status: **not scheduled.** Blocked by Sprint 7.5 and Sprint 8, per settled constraint 3.
Written 2026-08-31.

**Full plan, slice inventory, collision model, and estimate: `SPEC/50-typescript-migration.md`.**
This file is the execution wrapper only — sequencing, role assignment, and the definition
of done. It deliberately does not restate the plan.

---

## The one thing that does not wait for this sprint

**Wave A (golden capture) runs before or during Sprint 8**, not here.
**Started 2026-08-31** by decision — see `SPEC/decisions.md`. It is live work now,
tracked against Sprint 8's calendar rather than this sprint's.

It records request/response pairs for all 81 endpoints across all four roles against the
**live .NET API**. Once Sprint 8 closes and the .NET stack is retired, that capture is no
longer possible and the conversion loses its only oracle.

Wave A touches `tools/golden/` only — it collides with nothing in Sprint 7.5 or Sprint 8
and can run alongside them. Schedule it against Sprint 8's calendar, not this one.

| Slice | Owns |
|---|---|
| A1 capture harness | `tools/golden/` |
| A2 golden corpus | `tools/golden/fixtures/` — 81 endpoints × 4 roles, error paths included |
| A3 replay harness | `tools/golden/replay/` |

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

- ~~**Outcome ↔ Issue cardinality**~~ — **answered 2026-09-02: single-parent.** E6 is
  no longer blocked. See `SPEC/decisions.md`.
- **Ticket `10`** (test suite fate) — was blocked on `04`, which is now answered.
- **Tickets `01` (component library), `02`, `05`, `06`, `07`, `08`, `11`** on the
  conversion map.
- **Branch reconciliation** — the map lives on `feature/068-typescript-conversion-map`,
  the plan on `feature/066-delivery-comps-and-spec`.
