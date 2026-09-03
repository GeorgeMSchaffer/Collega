# TypeScript conversion map — reconciled copy

Ported to `dev` on 2026-09-03 from `feature/068-typescript-conversion-map` at `bf51d30`,
where it lived as `.scratch/typescript-conversion/`. This closes item 1 of
`SPEC/50-typescript-migration.md` §9 ("reconcile the branches"). The files are verbatim;
nothing below was edited on the way over. Read `RESUME.md`, then `map.md`, then `issues/`.

**Authority.** The map is the record of *how the questions were asked*. Where a ticket is
answered, the answer lives in `SPEC/decisions.md` and `SPEC/50-typescript-migration.md`,
and those win over a ticket's own `Status:` line, which was not updated after they landed.

## State of the twelve tickets as of the port

| Ticket | Map says | Actually |
|---|---|---|
| `01` redesign direction | in progress | **UI half closed** by the comp P lock (`decisions.md` 2026-08-31). Questions C and D carry a **conflicting** 2026-09-01 resolution — see below. |
| `02` deployment target | open | Open. |
| `03` what ports | open | **Answered** 2026-08-31: everything ports, View As isolated. |
| `04` validation strategy | open | **Answered** 2026-08-31: golden contract tests; Wave A runs before Sprint 8 closes. |
| `05` Prisma introspection | open | Open (AFK research; not started). |
| `06` schema reshape scope | blocked by 05 | Open. |
| `07` View As ambient identity | open | Open (AFK research; not started). |
| `08` auth / session model | blocked by 07 | Open. |
| `09` Next ↔ Nest boundary | open | **Answered** 2026-08-31: HTTP only. |
| `10` test suite fate | blocked by 04 | Takeable — its blocker is answered. |
| `11` spec reconciliation | open | Open. |
| `12` assemble the plan | blocked | **Done**: `SPEC/50-typescript-migration.md` + `SPEC/sprints/sprint-09-typescript-conversion.md`. |

Also settled since the map was charted, and relevant to E6: Outcome ↔ Issue cardinality is
**single-parent** (`decisions.md` 2026-09-02).

## ⚠ Conflict to resolve before Wave E — not resolved by this port

`issues/01-redesign-direction.md` carries a "Resolution in progress (2026-09-01)" section,
written on the map branch **after** `decisions.md` locked comp P on 2026-08-31. The two
disagree on three points and no one has reconciled them:

| Point | `decisions.md` on `dev` (2026-08-31) | Ticket `01` on the map branch (2026-09-01) |
|---|---|---|
| Visual direction (Q B) | **Comp P** locked: structure, IA, copy; palette open. `DESIGN.md` token layer. | "Carry **Comp C** Fluent Editorial forward"; the map branch's comp M ("Editorial Continuum", a *different* file from `dev`'s `comp-m-roadmap-single.html`) is the closest reference. K, L, N not selected. |
| Component library (Q D) | Open ("comp P is hand-rolled CSS on tokens and does not presume a library"). | **Answered: Tailwind rebuild, not Fluent UI React.** Reasoned; compatible with comp P, which is also hand-rolled on tokens. |
| Net-new scope (Q C) | Open; the plan §6 says adopting any of comp N's concepts is additive. | **Loop, Decision records, Commitment strip, Triage Mode are IN** (~10 agent-slices, 4 entities, 11 endpoints, 6 surfaces). Momentum, duplicate clustering, vote budget still open. |

Q D is a plain answer and can be adopted. Q B and Q C change what Wave E builds and what
the estimate covers, so they need a decision recorded in `decisions.md` — either the
2026-09-01 answers supersede the comp P lock, or they are withdrawn. Until then the plan
stands as written and comp P remains the locked direction.

## What was not ported from `feature/068`, and why

- `SPEC/mockups/comp-k-material-workspace.html`, `comp-l-canvas-board.html`,
  `comp-m-editorial-continuum.html`, `comp-n-decision-desk.html`, `comp-01c-scope.html`,
  `SPEC/UI-Feedback.md` — a separate comp lineage that `dev`'s comp set (D through P) has
  superseded; `dev` already has different files named comp K, L, M and N. Recoverable from
  the branch if the conflict above is decided in their favour.
- `src/prisma.md` — contains a live-looking Prisma Postgres connection string with an API
  key. **Never merge it; rotate the key.** It is in that branch's history on GitHub.
- Everything else on that branch is `dev` as of 2026-08-30 minus twenty-five later commits.
