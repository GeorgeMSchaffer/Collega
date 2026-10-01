# Sprint 13 — MVP release

**Status:** Not started (planned 2026-09-30; scope questions answered the same day).

**Goal:** close the last code and spec gaps, then cut the TypeScript stack over to Vercel
production. Every feature epic is merged; what remains is a QA debt, one contract defect, the golden
triage (F1), a spec bookkeeping pass, and the cutover (F4). Authority: `SPEC/50-cutover-runbook.md`;
`SPEC/decisions.md` 2026-09-30 ("What the MVP release includes") and 2026-09-29 ("How the cutover
is run"); `SPEC/05-product-definition.md` §6–8.

**Order.** Slices 136–139 run in parallel, each in its own worktree off `dev`; 140 starts once
they are merged. Bug Triage `TODO` is empty (checked 2026-09-30).

**Out of this sprint** (decided 2026-09-30, or already deferred): the shared store behind the auth
rate limiter and the account lockout (before the first real tenant, not before cutover); the
registration enumeration fix; Outcomes' backend; slice 116, the v1 prompt baseline (blocked on the
evaluation key); status categories and status-change times (Home's "not tracked yet" tiles,
`SPEC/ideas-inbox.md`); Wave G; anything in `SPEC/ideas-inbox.md`.

**No UI/UX work.** No slice changes a screen.

## Slices

| # | Slice | Role | Depends on | Scope |
|---|---|---|---|---|
| 136 | Spec bookkeeping and the demo-seed contract | Backend (docs) | — | Status lines: Sprints 10 and 11 merged (slices 099–112) and their files archived, `95-next-sprints.md` updated; Sprint 9's status line (Wave F only: F1, F4). `05` §7's replay figures from slice 131 (360 / 66 / 21 / 29), §8 item 8 marked built (slices 129, 130), item 7 resolved. `05` §6.3 items 4–5 rewritten against `apps/web` (comp P/R, shadcn/ui), not Blazor. The demo-seed routes: a contract for `POST /demo-seed` and `/demo-seed/reset` written from the code, and `90-definition-of-done.md`'s exception (they answer only where `COLLEGA_ALLOW_DEMO_SEED` is set; Production never sets it); the demo-seed controller's header comment says `403`, not absent. Documentation only. |
| 137 | View As candidates grouped by organization | Backend | — | `contracts/view-as.md` requires the candidate list grouped by organization; the API orders by last name and does not group (slice 131's three unexplained golden cases). Fix in application/API to the contract, including its order within a group. Tests by QA in 139 or the slice's own QA follow-up. |
| 138 | Close F1: accept the deliberate golden differences | Backend | — | Record in `tools/golden/src/accepted.ts`, each with its reason and `decided: 2026-09-30`: the export's three new columns (4 cases) and the demo seed's delivery module promoting ideas out of the Discovery board list (14 cases, cascading through the ideas and comments scenarios). Replay on a fresh seed after 137 merges; the expected remainder is 0 unexplained. F1 closed in `50-typescript-migration.md` and the Sprint 9 file. |
| 139 | QA for slices 129, 130, 132 and 137 | QA | 137 for its part | Per `SPEC/40-test-strategy.md`, each rule checked by breaking it. **129:** the idle deadline, the minute-28 warning and countdown, Stay signed in resetting only the browser clock, explicit sign-out with no notice, absolute expiry from the cookie's `exp`, cross-tab sync through `lib/session-signal.ts` incl. the `localStorage` fallback, the dev-only timing overrides. **130:** drag and arrows post one dense reorder, optimistic order and rollback on refusal, `aria-busy`/`aria-disabled`, focus return, the live announcement, hidden for non-admin roles, the archived board. **132:** Home's readers and tiles per role, the Site Admin roll-up fan-out, the AI settings and usage screens on the API. **137:** grouping and order. Playwright suite green. |
| 140 | F4: the cutover | Owner + any | 136–139 | `SPEC/50-cutover-runbook.md`, end to end. **Owner:** staging Prisma Postgres provisioned and Preview's `DATABASE_URL` pointed at it (clears today's no-go); a new production database; env vars per project; `collega` Root Directory `apps/web`, Output override off, framework Next.js; `collega-api` `maxDuration` 60 s, Vercel Authentication off; Node 24.x; backup retention. **Go/no-go** §1 on the release commit, recorded. Release through `sync/<date>` into `dev` and `main` (§2), then the first-day checks (§4); the old database deleted once the release is confirmed. F4 and Sprint 9 closed. |

Every slice: its own worktree off `dev`, `pnpm check` green, Code Reviewer approval, merge to
`dev`, tracker updated. Contracts stay read-only for 137–139; 136 is the slice that writes one.
