# Sprint 6.5: Bug fixes and element tweaks

**Status:** Intake — **open for items, not ready to execute.** The list is deliberately incomplete: the user is testing the View As (Act As) feature and will add findings as they go. Do not start execution until the user says the list is closed.
**Sequence:** runs **after Sprint 6, before Sprint 7** — see `SPEC/95-next-sprints.md`. Numbered 6.5 rather than renumbering 7 and 8, so existing cross-references to `sprint-07-*` and `sprint-08-*` stay valid.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Precedence

**This sprint supersedes all other sprints** (user decision, 2026-08-14). Sprints 7 (AI idea assist) and 8 (Azure deployment) do not start until this one completes. The reasoning is the same one behind `CLAUDE.md`'s pre-feature triage gate, applied at sprint scale: accumulated defects and rough edges get harder to attribute once more feature work lands on top of them, and Sprint 8 in particular ships whatever state the product is in to a real deployment.

## Goal

Clear the accumulated bug and tweak queue — correctness defects, UI/UX rough edges, and small element adjustments — rather than build new capability. This is a paydown sprint, not a feature sprint.

## Intake

**This file is the single home for items during this period.** `SPEC/Bug Triage.md` is emptied into it; per `CLAUDE.md`, an item promoted into a sprint plan is deleted from the queue rather than kept in both. Add new findings directly to the Scope table below.

Two sources feed it:

1. **User testing of Act As** — in progress. The Site Admin's org-content path changed substantially in Sprint 6 (View As became the only route to creating boards, ideas, comments and upvotes), so this is the first real exercise of that flow. Expect the bulk of the list to come from here.
2. **Carried-over engineering items** — anything found during Sprint 6 that was deliberately not fixed inside an already-large diff.

## Scope

| # | Item | Source | Size |
|---|---|---|---|
| 1 | **`ViewAsAuth` test harness leaks impersonation state.** The five API-test `CreateOrganizationAsync` helpers end in `ActAsOrgAdminAsync`, so a test body silently continues as an Org Admin of whichever organization was created *last*. This already forced two workarounds inside the change that introduced it — `CollaborationTests` re-targets in one test and reorders org creation in another. It also injects an extra `OrgAdmin` into every test organization, so future assertions on membership, View As candidate lists, or notification fan-out will quietly include a phantom user. **Suggested fix:** the helper leaves the client as the Site Admin and tests opt into `ActAsOrgAdminAsync` explicitly. Measured blast radius: 5 test classes, 82 `CreateOrg*` call sites across 61 facts — which is why it was deferred rather than folded into Sprint 6. | Sprint 6 code review (2026-08-14) | Medium |
| — | _Act As testing findings land here._ | User testing | TBD |

## Definition of Done

- [ ] User confirms the intake list is closed
- [ ] Every item in the Scope table is fixed or explicitly deferred with a reason
- [ ] `dotnet build Collega.sln` clean and `dotnet test Collega.sln` green, run twice (this project has produced a false flakiness signal before — one green run is not evidence)
- [ ] Any behavior change is reflected in the canonical `SPEC/*.md` first, then tests, then implementation
- [ ] Code Reviewer sign-off
- [ ] `SPEC/implementation-agent-tracker.md` and `SPEC/95-next-sprints.md` updated
