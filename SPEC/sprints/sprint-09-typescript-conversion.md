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
| A2 golden corpus | `tools/golden/fixtures/` — 81 endpoints × 4 roles, error paths included | **Done 2026-09-03** — 447 cases committed, plus `manifest.json` |
| A3 replay harness | `tools/golden/replay/` | **Done 2026-09-03** |

Wave A carries no remaining risk. Re-capture only if the API surface changes, and only
while the .NET API still exists — `tools/golden/README.md` names the two deliberate
coverage gaps and explains why the capture needs a freshly seeded database.

---

## Wave sequencing

Waves run in order. Slices *within* a wave run concurrently up to the stated ceiling,
which is set by path collisions (see the plan's §4) and throttled further by review
throughput.

| Wave | What | Max concurrent | Starts when |
|---|---|---:|---|
| A | Golden capture | 2 | **Complete 2026-09-03** — ran ahead, against the live .NET API |
| 0 | Foundation: monorepo, Prisma schema, kernel | **1 (serial)** | **Complete 2026-09-06** — S0.1, S0.2, S0.3 all merged |
| B | Domain + Application, 7 feature partitions | 7 | S0.3 merged — **B1-B3 merged 2026-09-06; B4-B7 open** |
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

## Wave 0 — complete 2026-09-06

| Slice | Delivered |
|---|---|
| **S0.1** | Six workspace packages with subpath exports, `tsconfig.base.json`, the Biome layer-boundary overrides, and `tools/boundaries` asserting the 6x5 matrix fires in both directions. Also fixed two things that made the gate meaningless: `pnpm check` ran lint in **zero** packages, and Biome's LF formatting against a CRLF checkout failed every file on Windows. |
| **S0.2** | 25 models introspected, **9 enums promoted**, and the **three partial unique indexes hand-written** into the baseline — `db pull` drops them silently and `migrate diff` reports an empty migration. `packages/infrastructure/test/partial-indexes.test.ts` fails if any goes missing. The whole baseline was applied to a scratch database and diffed against the original. **The schema is now frozen.** |
| **S0.3** | The `CurrentUserContext` port, the `AsyncLocalStorage` store, its singleton lazy-getter adapter, `runAs`, the request-context middleware, the auth guard skeleton, the branded `Attribution` type with `attributeAudit`, `ensureNotDirectSiteAdmin`, the error model and pagination — plus the nine domain enums and the identity chokepoint (Biome override + `tools/arch/identity-chokepoint.test.ts`). |

**Wave B and Wave C are now unblocked.**

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
- Layer boundaries pass lint — `biome.json` overrides since 2026-09-06 (`decisions.md`),
  including the rule that `apps/web` never imports `packages/application`, and
  `tools/boundaries` asserting that those overrides actually fire.
- The standard demo seed (2 orgs, **10 users**, 4 boards, 44 ideas) exists in the new stack.
  Ten is 2 orgs × 4 accounts (one Org Admin, two User, one Read Only) plus the configured
  Site Admin and the Development-only convenience Site Admin.
- F4's rollback window is **stated**, and F3 has answered in writing whether the data
  transform is reversible.

## Open before this sprint can start

**Nothing.** Eleven of the conversion map's twelve tickets are decided; the twelfth does
not gate any wave.

Answered 2026-09-03 (`SPEC/decisions.md`): `01` (comp P on Tailwind + shadcn/ui, and
Question C — Wave G), `02` (Vercel + Prisma Postgres), `10` (discard the .NET suite).

Answered 2026-09-04, which is what unblocked Wave 0:

- **`05` Prisma introspection fidelity** — no EF global query filters exist, so org scoping
  ports as ordinary Application-layer code. Introspection silently drops **three partial
  unique indexes**; S0.2 owes them as raw SQL plus a test that fails if any is absent.
  `typescript-conversion-map/findings/05-prisma-introspection.md`.
- **`07` View As ambient identity** — `AsyncLocalStorage` behind a singleton `CurrentUserContext`
  port, seeded in middleware (a guard cannot open the store) and filled by the auth guard,
  with the chokepoint lint-enforced.
  `typescript-conversion-map/findings/07-nest-ambient-identity.md`.
- **`06` schema reshape scope** — forced reshapes only, plus promoting all nine enum
  converters. S0.2 does **not** lay down Wave G's entities, so Wave G buys a schema
  amendment slice.
- **`08` auth / session model** — option C: Nest issues the httpOnly session cookie and Next
  stays a pure client; the cross-origin setup is accepted as the cost. This was the last
  thing gating Wave 0.

Still open, and deliberately not gating: **`11` spec reconciliation**, which lands as F5.
