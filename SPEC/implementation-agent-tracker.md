# Collega Implementation Agent Tracker

## Purpose
Track the implementation work that should be executed from the reset baseline, what is currently active, and what is ready next.

## Reset Notice
- Implementation progress has been intentionally reset.
- Treat this tracker as the authoritative execution baseline for starting over.
- Prior implementation history has been cleared from this document on purpose.

## Current Status
- Current implementation slice: Epic 1 Foundation
- Current owner: Multi-agent team (Backend Developer, QA Developer, UI/UX Developer, Code Reviewer) in isolated worktrees
- Current state: In Progress
- Last updated: 2026-08-06

## In Progress
- T002 Add the EF Core DbContext, migrations, and audit storage foundations. (Backend Developer)
- T003 Implement shared `/api/v1` routing conventions and problem-details error handling. (Backend Developer)
- T004 Implement API validation plumbing and OpenAPI scaffolding. (Backend Developer)

## Ready Next
- (T002-T004 above)

## Completed
- T001 Create the solution structure and project references.
- UI/UX Developer (superseded): 4 Comp A-style HTML review comps in `SPEC/mockups/comp-a-review-*.html`. Comp A was the client UI direction at the time; the user has since pivoted to Comp C ("Fluent Editorial") as the chosen direction, so these are kept for history only and are not implementation targets.
- UI/UX Developer: 4 Comp C-style HTML review comps for design sign-off before any Blazor work starts, per the pivot to Comp C. See `SPEC/mockups/comp-c-review-01-login-and-auth.html`, `-02-admin-orgs-users.html`, `-03-board-list.html`, `-04-idea-detail.html`. None locked yet — all four open for review. Idea detail changed from a two-pane overlay (Comp A) to a full-page article layout (Comp C) — same underlying behavior from the specs, different visual metaphor.
- UI/UX Developer: comp 3 (`comp-c-review-03-board-list.html`) now offers both a **List view** (Comp C's native grouped list-sections by status) and a **Swim Lane view** (Jira/Trello-style Kanban columns, functional drag-and-drop between columns) via a per-role toggle, for both the User and Read Only roles. Both views represent the same 48 ideas — it's a display preference, not two data models. Not locked yet.
- UI/UX Developer: new comp `comp-c-review-05-admin-statuses.html` for status configuration — this is new spec territory (canonical `SPEC/20-feature-boards-and-statuses.md` doesn't yet list a Color or Sort Order field on Status; only Name and CRUD/soft-delete are canonical today). Comp covers: status list (table, drag-to-reorder, consistent with the Orgs/Users list pattern), New/Edit status form (Name text field max 25 chars, Color via preset swatch picker + custom hex, Sort Order via drag or nudge arrows), and a dedicated "last-status guard" edge case showing Delete disabled with a tooltip when only one active status remains. Uses the user's proposed default set (New, Research In Process, In Review, Complete) as illustrative data — the canonical default list in `SPEC/20-feature-boards-and-statuses.md` (currently New/Pending, In Review, In Progress, Client Review, Complete) has not been updated yet pending confirmation. Also flagged and still open: the last-status minimum (1, confirmed by the user) technically means a board could be left unable to satisfy its existing 2-swimlane minimum — noted in the comp, not yet resolved in the canonical spec. Not locked yet.
- QA Developer: Epic 1 baseline smoke-test harness in `tests/Collega.API.Tests` (`Infrastructure/CollegaApiFactory.cs` + `SmokeTests.cs`), using `Microsoft.AspNetCore.Mvc.Testing`. Added a testing-only `public partial class Program {}` shim to `src/Collega.API/Program.cs`. Result: 1 passed (`Application_Boots_And_Responds_To_Requests`), 1 red as expected (`NonSuccessResponse_UsesProblemDetailsEnvelope` — no problem-details middleware exists yet, that's Backend's T003). Open risk flagged for Backend Developer/reviewer: a problem-details pipeline wired only through `UseExceptionHandler` + explicit `Problem()`/`ValidationProblem()` results will NOT catch a 404 for a completely unmatched route (this test's scenario) — that also needs something like `UseStatusCodePagesWithReExecute`. If T003 only covers the exception path, this test will still be red after merge; that's a real contract-vs-implementation gap to resolve, not a test to loosen.

## Progress Notes
- Restart baseline established on 2026-08-06.
- Rebuild execution history from this point forward as implementation resumes.

## Backlog By Slice

### Foundation Agent
- T001 Create the solution structure and project references.
- T002 Add the EF Core DbContext, migrations, and audit storage foundations.
- T003 Implement shared `/api/v1` routing conventions and problem-details error handling.
- T004 Implement API validation plumbing and OpenAPI scaffolding.

### Auth Agent
- T005 Implement login request handling with optional organization resolution.
- T006 Implement password hashing and verification.
- T007 Enforce password complexity, inactive-account denial, and 5-in-15 lockout rules.
- T008 Seed the global Site Admin from an environment-provided initial credential.
- T009 Implement forced first-login password change.
- T010 Emit audit events for authentication outcomes and password changes.
- T011 Implement admin-issued temporary password reset as the P1 extension path.

### Tenant Administration Agent
- T012 Implement organization create, detail, list, edit, and archive flows.
- T013 Provision default statuses and one default board during organization creation.
- T014 Implement organization-scoped user create, detail, list, and edit flows.
- T015 Enforce one organization and one role for each non-Site Admin user.
- T016 Enforce globally unique email addresses.
- T017 Support `Active` and `Inactive` user states.
- T018 Prevent the last Org Admin from removing their own admin access or deactivating themselves.
- T019 Emit audit events for organization and user administration actions.

### Workflow Configuration Agent
- T020 Implement organization-scoped status create, update, list, and soft-delete flows.
- T021 Implement board create, update, list, and detail flows.
- T022 Enforce minimum two swimlanes per board.
- T023 Support board subsets of organization statuses.
- T024 Persist swimlane reorder immediately after drag-and-drop.

### Collaboration Agent
- T025 Implement idea create, detail, list, update, and status change flows.
- T026 Enforce title and description limits.
- T027 Implement default left-most-swimlane status assignment on create.
- T028 Implement tag autocomplete after 2 characters.
- T029 Implement tag normalization, uniqueness, and merge-on-concurrency behavior.
- T030 Implement organization-scoped email-based mention resolution for ideas and comments.
- T031 Implement comment create, edit, delete, and chronological retrieval flows.
- T032 Implement upvote toggle with one active upvote per user per idea.
- T033 Restrict upvote removal to the user who cast it.
- T034 Allow board-configured Users to move any idea on an eligible board.
- T035 Keep completed ideas editable and collaborative.
- T036 Emit audit events for idea creation, edits, status changes, comments, and upvotes.

### Events Agent
- T037 Emit notification events for idea mentions, comment mentions, idea comments, and status changes.
- T038 Persist canonical idea links on notification events.
- T039 Keep outbound email delivery explicitly deferred outside MVP.

### Client Agent
- T040 Build the login flow for globally unique email credentials.
- T041 Build first-login password change and inactive-account UI states.
- T042 Build the Admin section for organizations and users.
- T043 Build board and status administration workflows.
- T044 Build idea detail, tags, mentions, comments, and upvote workflows.
- T045 Reflect Site Admin, Org Admin, User, and Read Only boundaries in the UI.
- C6-Kanban Replace `/ideas` list with Kanban swimlane board: board picker (localStorage persist), compact cards (title/priority/assignee/upvote), title-click opens in-context detail overlay (Cancel/Save/Move in Board), New Idea button (hidden for ReadOnly), search by title/tag/assignee, filter chips, card drag to `MoveIdeaStatusAsync` (optimistic + rollback), admin column reorder to `UpdateStatusAsync` (immediate-save on drop + rollback), HTML5 DnD desktop-only, components in `Shared/Kanban/`.

### Hardening Agent
- T046 Align OpenAPI with the written contracts.
- T047 Implement unit tests from the test strategy.
- T048 Implement integration tests for auth, organization scope, and collaboration flows.
- T049 Implement contract tests for schema and problem-details error behavior.
- T050 Verify seed behavior, organization bootstrap, audit generation, and deferred-scope boundaries end-to-end.
- T051 Implement Development-only demo environment seed and startup gating.
- T052 Validate demo seed idempotency and seeded graph coverage with automated tests.

## Notes For Next Agent
- Start with Foundation tasks T001 through T004.
- Use `Specs Overview.md` as the behavior entrypoint and `30-Contracts.md` for endpoint and payload authority.
- Keep this document updated whenever a task starts or completes.
