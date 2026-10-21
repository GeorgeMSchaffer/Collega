# Collega: status report and implementation plan

As of 2026-10-19, `dev` at `f617bd20` (local; nothing pushed). Source: `SPEC/implementation-agent-tracker.md`, `SPEC/decisions.md`, `git log`.
This is a working note, not a canonical spec.

## 1. Status

**Complete:** Sprints 1–7.5, 10, 11, 12 (Sprint 8 cancelled). Sprint 14 (board pull-in). Backlog add-issue and quick-add rows (185–195, 210–211). Board References foundation and backend rounds 1–3 (196–200, 220–249, 260, 277, 278, 280). Outcomes backend (`1d1775fa`, `5467d1b8`, `9feb9bf2`).

**Merged this round (2026-10-19):**

| Slice | What | Commit |
|---|---|---|
| 278 | Seven comp U answers recorded in `decisions.md` and the contracts | `2babeede` |
| 280 | Final lane cannot reference (422), Effort cannot be cleared in a reference lane (422), no repeat auto-create, plus three read additions | `221fadeb` |
| 281 | QA debt: 14 web test files and a DB-free View As order test (24 of 26 mutations caught) | `2127172e` |
| 282 | `SITE_ADMIN_PASSWORD` no longer required at API runtime; `phase` on the idea list item | `17950211` |

The Outcomes tracker row was stale ("backend next"). It is corrected.

**In flight:** nothing.

**Blocked on the owner:**
- Cutover (slice 140) is a no-go. It will happen after the Board References UI (owner decision 2026-10-19). Owner-side deployment steps remain.
- Three proposed read shapes need confirming (see section 2).

**Quality gate:**
- `pnpm check` is red on this machine. 48 web tests fail because Node 26's built-in `localStorage` breaks jsdom. The repo pins Node 24.20.0. With `NODE_OPTIONS=--no-experimental-webstorage` the web suite passes (1,103 tests).
- `fieldsets.integration` "demo reset" fails on a seeded database on `dev` (pre-existing; CI skips it).
- Infrastructure integration tests were last run on a scratch Postgres: 489 of 490 pass.

## 2. Decisions needed from the owner

1. Confirm the three proposed read shapes (written into the contracts as "proposed, owner to confirm"): per-idea `metrics` on the Outcome read, `hiddenTaskCount` on pull candidates, `GET /ideas/{id}/activity`.
2. Does the Outcome breakdown need an item key? The spec asks for one; `OutcomeIdea` has no `itemKey`.
3. The tracker's "two duplicated audit writes in `board-service.ts`": which writes? The agent found only repeated helper code.
4. Install Node 24.20.0 (`pnpm env use --global 24.20.0`)?
5. Sprint header and chips are included in the UI round (owner 2026-10-19), but the backend cannot support them. Approve a spec-then-backend slice for sprints (section 3, step 1).

## 3. Implementation plan

Roles: Backend, QA, UI/UX, Reviewer (gates every merge), each in its own worktree off `dev`. The orchestrator updates the tracker.

**Step 0: owner unblockers (no agents).** Decisions 1–4 above; install Node 24.20.0 so `pnpm check` is green.

**Step 1: parallel, no file overlap**

| Track | Role | Scope |
|---|---|---|
| A | Backend (spec first) | **Sprint contracts for work boards.** Gaps: sprints per board "not built"; no sprint field on the board card read; header counts for tasks and ideas unspecified; no route to put a task in a sprint (`PUT /ideas/{id}/sprint` belongs to the retired Delivery phase); no backlog read for the Sprint | Backlog toggle. Write the contract, owner confirms, then implement. |
| B | QA | Tests for slice 280: final-lane guard, effort-null guard, no repeat auto-create (status move, pull, `ideaMoves`), activity read, `hiddenTaskCount`, per-idea metrics. Include live-DB tests. |
| C | QA | Tests for the Outcomes backend (none exist): authorization (direct Site Admin refused), reorder, grouping, rollup, audit payloads. |
| D | Backend (small) | If decision 2 says yes, add `itemKey` to `OutcomeIdea`. Tidy `board-service.ts` audit helpers if decision 3 identifies them. |

**Step 2: UI, after Step 1 merges and the owner has confirmed the shapes.** Per comps T and U. Slices stack in this order:

1. Statuses page: reference selector (disabled on Final lanes), auto-create switch, Final and reference guards, key prefix.
2. Board work: item keys, Effort bar, lock and "Waiting on N tasks", up-front refusals (locked card, no Effort, blocked), reference pill on lane headers.
3. Parent drawer: tasks section, add task, task drawer, blockers, completion prompt, Org Admin "Move anyway" with reason.
4. Value: metric types settings, metric values, Outcome totals, pull picker with hidden-task count, idea activity.
5. Work board sprint header and chips (needs Track A).
6. Outcomes UI: Roadmap off the `delivery.ts` fixture.

Each UI slice is followed by a QA slice, then Reviewer, then merge.

**Step 3: release**
1. `pnpm check` plus Playwright on a scratch database, and a fresh golden replay (regression detector, not a gate).
2. Cutover per `SPEC/50-cutover-runbook.md`: new Production database, rebuild check, PRs, merge to `main`, build logs, smoke checks. Owner steps stay with the owner.

**After release:** Idea assistant v2 (unblocked; baseline committed); Home gaps; board edge cases; account-lockout and registration risks; Wave G is revisited.

## 4. Risks

- Sprint contracts are the critical path for UI slice 5 and could delay a complete first release. Fallback: ship without the sprint header and chips, as the comp originally allowed. That reverses the owner's 2026-10-19 call, so it needs the owner's say.
- The new backend reads have been run against a real database but have no dedicated tests until Track B lands.
- Browser verification is thin. Quick-add rows and the Backlog add drawer were never exercised in a browser; the field form's type select may reset after a refused submit.
- Agents in sandboxed worktrees sometimes cannot run the toolchain (the Outcomes agent could not run pnpm). Reviewers must run the gate themselves.
