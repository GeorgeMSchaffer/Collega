# Sprint 6.5: Bug fixes and element tweaks

**Status:** In Progress (started 2026-08-14) — **intake closed by the user**, seven items in scope plus one closed with no change. See the Scope table.
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
| 2 | **View As has only one of its two locked entry points — P1, it is why the feature reads as missing.** D-PLACE (locked 2026-08-11) specified a **page-header `View as…` control _and_ a rail avatar-menu item**, "both, for discoverability — it's the Site Admin's mutation path." Only the rail item was built (`Layout/NavRail.razor:70`, gated on `ShowViewAs`); no page-header control exists anywhere in the client, and that string is the sole `View as…` in the codebase. The only way in today is clicking the avatar at the bottom of the 64px rail and opening a popover — precisely the discoverability failure "both" was meant to prevent. The user could not find the feature on `dev` at all (2026-08-14), which is the bug report. **Scope confirmed narrow — the rail entry point works** (user-verified on `dev`, 2026-08-14): the drawer opens, the picker lists users, and a session starts. So nothing underneath is broken and this is *only* the missing second control, not a symptom of a deeper fault. **Not a design question either:** placement is already drawn in `SPEC/mockups/comp-c-review-10-view-as.html`. Reuse the existing `_canViewAs` gate from `Layout/MainLayout.razor:75-77` and the existing `OnOpenViewAs` callback rather than adding a second gate. | User testing (2026-08-14) | Small |
| 3 | **Password inputs need a show/hide toggle** on the right of the field. Affects `Login.razor:47`, `Register.razor:48`, `ChangePassword.razor:33/37/41`, `Profile.razor:101/106/110` (all `FluentTextField` + `TextFieldType.Password`) and `OrganizationUsers.razor:261` (a raw `<input type="password">`). Nine fields across five pages, two different input primitives — so extract one shared component rather than patching each site. | User testing (2026-08-14) | Small |
| 4 | **List-page command row is misaligned.** Every list page renders `<div class="backrow"><BackButton /></div>` above a separate `<div class="cmdbar">`, so Back sits on its own line above search. Wanted: one vertically-aligned row — **Back leftmost, then search, then "Add New" rightmost**. Identical markup on all five pages (`Settings`, `OrganizationUsers`, `StatusesAdmin`, `IdeaTypesAdmin`, `FieldDefinitionsAdmin`), so fix the shared CSS/structure once. | User testing (2026-08-14) | Small |
| 5 | **List-page content container is not full width.** The card/table wrapper on list pages does not fill the available width. | User testing (2026-08-14) | Small |
| 6 | **Seed output.** The auth and demo seed commands create users silently, so there is no way to see what exists for testing or debugging. Emit the created users (email + role + organization) at startup. This is also what closed the "seed a Site Admin per org" item below — the users were already there and correctly org-assigned; they just were not visible. | User testing (2026-08-14) | Small |
| 7 | **Create form becomes a right slide-in drawer on all list pages.** Today all five use the centered `CreateModalShell`; detail/edit already use `DrawerShell`. **This reverses a locked decision** — Comp C locked "right slide-in drawer (detail + inline edit) with a centered create modal" (`client/CLAUDE.md`, Sprint 2 rollout). User decision 2026-08-14: create becomes a drawer too. **Spec first** per `CLAUDE.md`: update `SPEC/20-feature-client-ui.md` and `src/Collega.Client/CLAUDE.md` before touching components. Note the original report named only the Orgs page as wrong; investigation showed all five are identical, so "make Orgs match the others" would have been a no-op — the reversal is the actual intent. | User testing (2026-08-14) | Medium |

### Closed with no change

- **"Demo seed should seed a Site Admin per org, and users should be assigned to the org."** Already true, and partly impossible as written: `StartupSeeder` gives every demo org an OrgAdmin (`orgadmin@{slug}.demo.collega.test`) plus two Users, all correctly org-assigned, and a global demo Site Admin. **Site Admin is global by the product model and cannot belong to an organization** (`00-project-brief.md`, `10-requirements.md`), so a per-org Site Admin would be a model change, not a seed change. Confirmed with the user 2026-08-14: the real need was visibility, which is item 6.

## Definition of Done

- [ ] User confirms the intake list is closed
- [ ] Every item in the Scope table is fixed or explicitly deferred with a reason
- [ ] `dotnet build Collega.sln` clean and `dotnet test Collega.sln` green, run twice (this project has produced a false flakiness signal before — one green run is not evidence)
- [ ] Any behavior change is reflected in the canonical `SPEC/*.md` first, then tests, then implementation
- [ ] Code Reviewer sign-off
- [ ] `SPEC/implementation-agent-tracker.md` and `SPEC/95-next-sprints.md` updated
