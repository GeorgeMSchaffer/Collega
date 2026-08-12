# Sprint 1: Bug Triage Quick Wins + Bookkeeping Reconciliation

**Status:** Complete (2026-08-10)
**Sequence:** 1 of 4 — see `SPEC/95-next-sprints.md` for the full sequence and how these sprints relate.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

> **Outcome (2026-08-10):** Delivered on branch `feature/sprint-01-bug-triage-quick-wins`, merged to `dev`. The bookkeeping audit found that — contrary to the "may already be done" note — 6 of 7 items still needed real work (only add-button right-alignment and the idea edit-input widths were already satisfied). All addressed items were moved to `COMPLETED` in `SPEC/Bug Triage.md`. Client build clean; full suite 474 green; live-verified as demo Org Admin (Site-Admin-only bits verified by code+build). One new bug was discovered and filed to `Bug Triage.md` TODO: the idea-type/business-impact migration fails its FK when applied over a DB that already has idea rows.

## Goal
Every small, mechanical Bug Triage item is fixed and verified; `SPEC/Bug Triage.md`'s `TODO`/`COMPLETED` bookkeeping is fully caught up (some items already appear fixed in `SPEC/archive/implementation-agent-tracker-archive.md` but are still listed under `TODO` — that mismatch gets closed here first, since it's the cheapest way to find out how much of this sprint is already done).

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend Developer | 0 | No backend changes expected — all items are client-only |
| UI/UX → Client Developer | 1 (single worktree, small items batched) | Small enough to batch into one slice rather than one worktree per item |
| QA Developer | 1 (verification pass, not a parallel worktree) | Confirms each fix against its Bug Triage wording, not full regression |
| **Total** | **2** | |

## Sprint Backlog
| Priority | Item | Notes | Dependencies |
|---|---|---|---|
| P0 | **Bookkeeping audit first**: for each `TODO` item below, check whether `SPEC/archive/implementation-agent-tracker-archive.md` already claims it done (e.g. "Add new" right-align, Back button extension) — if code confirms it, move straight to `COMPLETED` in `SPEC/Bug Triage.md` with a verification note instead of re-building it | Do this before touching code — may shrink this sprint significantly | None |
| P0 | Fix Custom Fields "New Field" button — navigates to the organizations list instead of the field-create form | Real bug, not a polish item | None |
| P0 | Archived checkbox placement: move to just right of the search field, on every list page that has one | | None |
| P1 | Back button: confirm/finish "above the search field, left-aligned" on every list page, and that it returns to the originating page (not just to a fixed parent) | May already be done per `b73a5af`/`79bd619` — verify against exact wording | None |
| P1 | "Add New" button: confirm uniform label text ("Add New") + right alignment on every list page, incl. the Idea Types page named explicitly in Bug Triage | May already be done per the 2026-08-10 tracker entry — verify, don't re-build if so | None |
| P1 | `/settings` page: capitalize the first letter of every word in settings links (title case) | | None |
| P1 | Home page: remove the "Platform Administration" section — leave boards + activity feed only | | None |
| P1 | Idea edit-mode form inputs: single inputs full-width, two-column rows 50%/50% (currently too squished) | Verify whether the T-UI-3 drawer rebuild already fixed this as a side effect before scheduling new work | None |

> Ideas-list **sorting** was moved out of this sprint into Sprint 3 (List Filter Parity + Server-Side Sort), since the "extend the API" decision makes it server-side work that belongs with the filter query-param changes.

## Planned Capacity vs. Sprint Load
Likely lighter than it looks — several items may already be done and just need the bookkeeping audit to confirm. Don't front-load effort estimates until that audit runs.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Bookkeeping audit finds most items already fixed, leaving little real work | Low — good outcome, just re-scope this sprint down and pull forward from Sprint 2 | Run the audit as the literal first task, before assigning any other work |
| "Add New" / Back button fixes conflict with the new drawer pattern about to land in Sprint 2 | Rework risk if Sprint 2 changes the same list-page chrome | This sprint ships first and fully merges before Sprint 2 (drawer rollout) starts; the drawer sprint builds on top of this sprint's state, not in parallel. The two consecutive list-page sprints are now adjacent so all admin list-page churn settles together |

## Definition of Done
- [ ] Each `Bug Triage.md` `TODO` item addressed above is either fixed-and-verified or confirmed-already-fixed, and moved to `COMPLETED` with a dated verification note
- [ ] Client build 0 warnings/errors; full test suite green
- [ ] No regressions in existing list-page search/pagination (`ListToolbar`)
