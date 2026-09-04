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
| `01` redesign direction | in progress | **Closed** 2026-09-03: comp P is canonical, built on Tailwind + shadcn/ui; and Question C is answered — Loop, decision records, commitment strip and Triage Mode are in as **Wave G** (starts when F1 is green), momentum / duplicate clustering / vote budget are not. The ticket's Question B answer (Comp C) is withdrawn; its Question D answer (Tailwind) stands, with shadcn/ui on top. |
| `02` deployment target | open | **Answered** 2026-09-03: Vercel for both apps, Prisma Postgres in production. Nest runs serverless — no in-process state. |
| `03` what ports | open | **Answered** 2026-08-31: everything ports, View As isolated. |
| `04` validation strategy | open | **Answered** 2026-08-31: golden contract tests; Wave A runs before Sprint 8 closes. |
| `05` Prisma introspection | open | **Answered** 2026-09-04 by running it: `findings/05-prisma-introspection.md`. No global query filters exist; columns, keys, FKs and plain indexes round-trip exactly; three partial unique indexes are lost silently. |
| `06` schema reshape scope | blocked by 05 | **Unblocked** 2026-09-04. Open, with a defined job: re-add the three partial indexes as raw SQL, decide enum representation for all nine converters, rename introspected relation fields. |
| `07` View As ambient identity | open | **Answered** 2026-09-04: `findings/07-nest-ambient-identity.md`. `AsyncLocalStorage` behind a singleton port, seeded in middleware and filled by the auth guard; not Nest request-scoped providers. Chokepoint lint-enforced. |
| `08` auth / session model | blocked by 07 | **Unblocked** 2026-09-04. Open, and genuinely free — the Nest design is the same under all three options; `07` §6.4 imposes only that the credential name the real user. |
| `09` Next ↔ Nest boundary | open | **Answered** 2026-08-31: HTTP only. |
| `10` test suite fate | blocked by 04 | **Answered** 2026-09-03: discard the .NET suite; golden contract tests plus fresh per-slice Vitest, written by a QA agent. |
| `11` spec reconciliation | open | Open. |
| `12` assemble the plan | blocked | **Done**: `SPEC/50-typescript-migration.md` + `SPEC/sprints/sprint-09-typescript-conversion.md`. |

Also settled since the map was charted, and relevant to E6: Outcome ↔ Issue cardinality is
**single-parent** (`decisions.md` 2026-09-02).

Three tickets remain open, none of them blocked: `06` (schema reshape scope) and `08` (auth and
session model), both unblocked on 2026-09-04 by the `05`/`07` research pair and both now
decisions for the user rather than research, and `11` (spec reconciliation), which lands as F5.

The research findings live in `findings/`. They are measurements and recommendations, not
decisions — a ticket's banner says which.

## Ticket `01` conflict — resolved 2026-09-03

`issues/01-redesign-direction.md` carries a "Resolution in progress (2026-09-01)" section
written on the map branch after `decisions.md` had locked comp P. The user ruled on
2026-09-03: **comp P is canonical**, built on **Tailwind CSS + shadcn/ui** — so the ticket's
Question B answer (Comp C carried forward) is withdrawn and its Question D answer (Tailwind)
stands, with shadcn/ui named on top. The ticket file is left as written; the decision log wins.
Question C — Loop plus comp N's decision records, commitment strip and triage mode as net-new
scope — is still an open question for the plan's estimate.

## What was not ported from `feature/068`, and why

- `SPEC/mockups/comp-k-material-workspace.html`, `comp-l-canvas-board.html`,
  `comp-m-editorial-continuum.html`, `comp-n-decision-desk.html`, `comp-01c-scope.html`,
  `SPEC/UI-Feedback.md` — a separate comp lineage that `dev`'s comp set (D through P) has
  superseded; `dev` already has different files named comp K, L, M and N. Recoverable from
  the branch if the conflict above is decided in their favour.
- `src/prisma.md` — contains a live-looking Prisma Postgres connection string with an API
  key. **Never merge it; rotate the key.** It is in that branch's history on GitHub.
- Everything else on that branch is `dev` as of 2026-08-30 minus twenty-five later commits.
