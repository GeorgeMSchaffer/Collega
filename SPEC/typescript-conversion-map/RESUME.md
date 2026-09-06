# Resume here

Rewritten 2026-09-06. The charting session this file was originally written for
(2026-08-30) is long over — **all twelve tickets but one are decided, and the conversion
is executing.** Read this, then `SPEC/sprints/sprint-09-typescript-conversion.md`.

## Where you are

**Sprint 9 — the TypeScript conversion — is the ACTIVE sprint.** The destination is no
longer a costed plan; that plan exists (`SPEC/50-typescript-migration.md`) and is being
executed against.

Branch: `dev`. The map was ported off `feature/068-typescript-conversion-map` on
2026-09-03 and lives here; that branch is history.

| | |
|---|---|
| Tickets decided | **11 of 12** |
| Still open | **`11` spec reconciliation** — lands as F5, gates nothing |
| Wave A (the oracle) | **Complete** — 447 cases, all 81 endpoints, replaying clean |
| Wave 0 (foundation) | **Unblocked 2026-09-04**, this is the frontier |
| Waves B–G | Not started |

## Do this first

**Wave 0, slice S0.1 — the monorepo skeleton.** It is strictly serial and blocks
everything after it. `SPEC/50-typescript-migration.md` §5 states what it owns.

Wave 0's three slices run one at a time, in order:

| Slice | Owns |
|---|---|
| **S0.1** | root configs, `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, layer-boundary lint, CI task graph |
| **S0.2** | `packages/infrastructure/prisma/**` — `db pull`, deliberate reshape, generated client, per-feature seed composition. **Freezes the schema.** |
| **S0.3** | `packages/{domain,application}/src/common/**`, `apps/api/src/common/**` — error model, result types, pagination, auth guard skeleton, `AsyncLocalStorage` request context |

## Two things S0.1 and S0.2 owe that are easy to miss

**S0.2 owes three partial unique indexes as raw SQL.** `prisma db pull` drops them
*silently* — it says nothing, and `migrate diff` reports an empty migration, because the
engine does not model them. One of the three is what makes "at most one open View As
session per user" a database guarantee rather than a race. S0.2 must add them as raw SQL
in the first migration **plus a test that fails if any is absent**.
Detail: `findings/05-prisma-introspection.md`.

**Identity is `AsyncLocalStorage`, not Nest request scope.** The store is seeded in
middleware — a guard cannot open one, because `canActivate` returns before the handler
runs — filled by the auth guard, and read through a **singleton** provider with lazy
getters implementing the `CurrentUserContext` port. An absent store must **throw**, not
read as anonymous, or `ensureNotDirectSiteAdmin` passes for background work. On Vercel the
new hazard is **module-scope identity caching**, which serves one user's identity to the
next in a warm container. The chokepoint gets lint enforcement plus one exact-equality
architecture test, because documentation did not prevent this bug class before.
Detail: `findings/07-nest-ambient-identity.md`.

## The deadline that is still live

**Cutover deletes the .NET solution, and the golden corpus can never be recorded again
after that.** Until Wave F, `dotnet run` and `dotnet test` must keep working even though
no development happens on them. A change that breaks the API's boot path is a problem, not
a curiosity. Re-capture only against a freshly seeded database — `tools/golden/README.md`
explains why.

## Settled — do not re-litigate

Plan not build is **over**; this is the build. Motive is hiring + ecosystem so the whole
stack moves · estimated in agent-slices · Vitest + Playwright, not Cypress · big-bang
cutover · Prisma introspect then reshape · Turborepo + pnpm with lint-enforced layer
boundaries · **UI is comp P on Tailwind v4 + shadcn/ui**, comp Q is the reference
rendering · **Vercel + Prisma Postgres**, so Nest is serverless and keeps no in-process
state · **the .NET test suite is discarded** · net-new scope is **Wave G**, after F1 ·
**Outcome ↔ Issue is single-parent**.

Full detail and rationale in `map.md` and `SPEC/decisions.md`.

## Comp status — settled, nothing outstanding

**Comp P is locked and canonical** (2026-09-03), and the shipped Blazor client was ported
to it so the conversion starts from a settled baseline: four files, 46 screens, every one
at four roles and four states. **Comp Q** re-renders the same fragments on Tailwind v4 +
shadcn/ui and is the reference for Wave E; `_build/build_q.py` carries the component map.

Comps J–N are history. J was rejected outright — *"I don't think a dark theme is
appropriate for a business user type application"* — and deleted; it is recoverable at
`0e2bd39`. The six feature concepts N carried were triaged on ticket `01` Question C: Loop,
decision records, commitment strip and Triage Mode are **in, as Wave G**; momentum,
duplicate clustering and vote budget are **out**.

## The estimate

`SPEC/50-typescript-migration.md` §6: **~66–82 slices, ~18–33M tokens for the port,
centred near 22M**, plus Wave G's ~10 slices. Confidence is low on the multiplier and
moderate on the slice count. This does not fit in one session and was never expected to.
