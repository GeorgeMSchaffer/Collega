# Collega Implementation Agent Tracker

## Purpose
Track the implementation work that should be executed from the reset baseline, what is currently active, and what is ready next.

## Reset Notice
- Implementation progress has been intentionally reset.
- Treat this tracker as the authoritative execution baseline for starting over.
- Prior implementation history has been cleared from this document on purpose.

## Current Status
- Current implementation slice: Auth Agent (T005-T011)
- Current owner: Multi-agent team (Backend Developer, QA Developer) in isolated worktrees; UI/UX Developer is sitting out this round by user direction — another UI comp review pass happens after backend slices land, before any Client Agent work starts.
- Current state: Epic 1 Foundation (T001-T004) merged into `dev`. Auth Agent slice (T005-T011) started 2026-08-07: Backend Developer implementing login/hashing/lockout/seed-Site-Admin/forced-password-change/audit/temp-password-reset; QA Developer writing black-box API contract tests in parallel. Next slices after Auth merges, in dependency order: Tenant Administration Agent (T012-T019) → Workflow Configuration Agent (T020-T024) → Collaboration Agent (T025-T036) → Events Agent (T037-T039). Client Agent (T040-T045, C6-Kanban) stays blocked on UI comp sign-off throughout.
- Last updated: 2026-08-07

## In Progress
- Backend Developer: Auth Agent slice, T005-T011 (see `SPEC/20-feature-auth.md`). Worktree branched off `dev`.
- QA Developer: Auth Agent slice, black-box API contract tests against `SPEC/30-Contracts.md`'s auth endpoints. Worktree branched off `dev`. Expected red until Backend Developer's branch merges (same pattern as Epic 1 Foundation).

## Ready Next
- QA Developer: re-run `tests/Collega.API.Tests/SmokeTests.cs` now that Backend Developer's T002-T004 has merged — `NonSuccessResponse_UsesProblemDetailsEnvelope` was red pending the problem-details pipeline, which now exists (including `UseStatusCodePages()`, which directly addresses the gap QA flagged). Code Reviewer verified this manually during merge (see below); a real QA re-run/extension is still the next step.
- Resolved via user spec-audit session (2026-08-06): default status set stays the canonical 5 (New/Pending, In Review, In Progress, Client Review, Complete). `comp-c-review-05-admin-statuses.html` and `comp-c-review-03-board-list.html` have both been updated to use the canonical 5 (in canonical order, with a distinct color per status: New/Pending slate, In Review amber, In Progress blue, Client Review purple, Complete green) — the prior illustrative 4-status set (New, Research In Process, In Review, Complete) is gone from both comps. Comp 5's example retired status is now "Won't Do" (an org-added custom status), since Client Review is now one of the 5 actives. Neither comp is locked yet.
- Also resolved same session: the client UI direction pivot (Comp A → Comp C, full-page Idea Detail instead of an overlay) has been propagated into all canonical specs that referenced the old overlay pattern (`20-feature-client-ui.md`, `20-feature-client-ui-revisions.md`, `20-feature-ideas-and-engagement.md`, `20-feature-user-defined-fields.md`, `30-Contracts.md`, `40-test-strategy.md`, `50-technical-implementation-plan.md`, `70-delivery-backlog.md`, `85-implementation-timeline.md`, `Specs Overview.md`). `30-Contracts.md`'s notification `ideaLink` format was also corrected to `/ideas/{ideaId}/edit` to match `20-feature-notifications.md` (it still had the superseded `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` format). Client Agent tasks (T040-T045, C6-Kanban) can now be scoped against current specs once the review comps lock.
- Resolved via follow-up user interview (2026-08-07), all four items previously flagged as open:
  1. **Status Color/SortOrder**: adopted into the canonical spec now (not deferred). `20-feature-boards-and-statuses.md` gains `Status.Color` (hex/CSS, max 20 chars, drives the swimlane color dot and idea-card status chip) and `Status.SortOrder` (int, organization-level catalog order — distinct from a board's own independently-reorderable swimlane order). Default `Color`/`SortOrder` values for the 5 canonical default statuses are still unassigned — open item, see `SPEC/60-spec-q-and-a-backlog.md`.
  2. **Last-status minimum vs. board's 2-swimlane minimum**: resolved by raising the organization-wide active-status minimum to 2 (matching a board's own minimum), rather than the 1-active-option minimum used for Idea Type/Business Impact. A delete that would drop an organization below 2 active statuses is now rejected regardless of whether that status is referenced as a swimlane. Recorded in `20-feature-boards-and-statuses.md`.
  3. **`SPEC/25-client-ui.md`**: deleted. It had no unique content beyond what `20-feature-client-ui.md`/`20-feature-client-ui-revisions.md` already cover more accurately.
  4. **C6-Kanban vs. the `/ideas` list page**: resolved as keep-both — `/ideas` remains a cross-board list/search surface alongside the per-board Kanban/list view. C6-Kanban's task wording below no longer implies replacing `/ideas`.

## Completed
- T001 Create the solution structure and project references.
- T002 Add the EF Core DbContext, migrations, and audit storage foundations. (Backend Developer) `CollegaDbContext` (audit events only, per Epic 1 scope — no feature entities), `audit_events` table mapping, `EfAuditEventWriter` implementing `IAuditEventWriter`, `InitialCreate` migration generated and applied successfully against a live throwaway SQL Server 2022 container (schema verified via `INFORMATION_SCHEMA.COLUMNS`), then torn down. Design-time `IDesignTimeDbContextFactory` added because ASP.NET Core minimal-hosting auto-discovery of `Program.cs` was not resolving `appsettings.Development.json`-based configuration for `dotnet ef` reliably in this environment.
- T003 Implement shared `/api/v1` routing conventions and problem-details error handling. (Backend Developer) `ApiVersionRoutePrefixConvention` prefixes every controller route with `api/v1` (contract's path versioning) without repeating it per controller. `AddCollegaProblemDetails()` wires `AddProblemDetails()` + `UseExceptionHandler()` + `UseStatusCodePages()` so every non-2xx response (401/403/404/500, not just validation failures) is rendered as `application/problem+json` with `type`/`title`/`status`/`detail`/`instance` populated. Verified live via curl: unknown route returns a populated problem-details 404.
- T004 Implement API request validation plumbing and OpenAPI scaffolding. (Backend Developer) Custom `RequiredField`/`MaxLengthField`/`MinLengthField`/`RangeField`/`EmailFormat`/`AllowedValues` attributes in `Collega.API/Validation` produce the exact contract wording templates (e.g. "Message is required.") instead of framework defaults; a custom `InvalidModelStateResponseFactory` returns a `ValidationProblemDetails` envelope with an `errors` object keyed by **camelCase** field name (translated from the C# ModelState path, e.g. `Assignees[0].UserId` -> `assignees[0].userId`) to match contract JSON field names — flagged below as a judgment call. Swagger/OpenAPI given an explicit title/version. A diagnostics-only `HealthController` (`GET /api/v1/health`) and `DiagnosticsController` (`POST /api/v1/diagnostics/echo`) were added purely to prove the pipeline end-to-end (not product features); later epics should feel free to remove `DiagnosticsController` once real resource controllers exist to exercise validation.
- UI/UX Developer (superseded): 4 Comp A-style HTML review comps in `SPEC/mockups/comp-a-review-*.html`. Comp A was the client UI direction at the time; the user has since pivoted to Comp C ("Fluent Editorial") as the chosen direction, so these are kept for history only and are not implementation targets.
- UI/UX Developer: 4 Comp C-style HTML review comps for design sign-off before any Blazor work starts, per the pivot to Comp C. See `SPEC/mockups/comp-c-review-01-login-and-auth.html`, `-02-admin-orgs-users.html`, `-03-board-list.html`, `-04-idea-detail.html`. None locked yet — all four open for review. Idea detail changed from a two-pane overlay (Comp A) to a full-page article layout (Comp C) — same underlying behavior from the specs, different visual metaphor.
- UI/UX Developer: comp 3 (`comp-c-review-03-board-list.html`) now offers both a **List view** (Comp C's native grouped list-sections by status) and a **Swim Lane view** (Jira/Trello-style Kanban columns, functional drag-and-drop between columns) via a per-role toggle, for both the User and Read Only roles, with Swim Lanes as the default. Both views represent the same 48 ideas — it's a display preference, not two data models. Status names/colors were reconciled with `comp-c-review-05-admin-statuses.html`'s proposed defaults (New/slate, Research In Process/blue, In Review/amber, Complete/green) so the idea card's priority chip can be colored by its status (per user decision) rather than by priority level; the chip still displays High/Medium/Low text. The "Configure swimlanes" tab was also corrected to a mathematically consistent demo of the 2-swimlane minimum (2 selected, both Remove disabled, 2 more available to add). Not locked yet.
- UI/UX Developer: new comp `comp-c-review-05-admin-statuses.html` for status configuration. Comp covers: status list (table, drag-to-reorder, consistent with the Orgs/Users list pattern), New/Edit status form (Name text field max 25 chars, Color via preset swatch picker + custom hex, Sort Order via drag or nudge arrows), and a "last-status guard" edge case showing Delete disabled with a tooltip. **Needs an update**: `Status.Color`/`Status.SortOrder` are now canonical (see Ready Next above), and the org-wide active-status minimum was resolved to 2 (not 1) — the comp's guard edge case currently disables Delete only when exactly one active status remains and needs to disable at two remaining instead. Not locked yet.
- QA Developer: Epic 1 baseline smoke-test harness in `tests/Collega.API.Tests` (`Infrastructure/CollegaApiFactory.cs` + `SmokeTests.cs`), using `Microsoft.AspNetCore.Mvc.Testing`. Added a testing-only `public partial class Program {}` shim to `src/Collega.API/Program.cs`. Originally 1 passed / 1 red pending Backend's problem-details work; Backend Developer's T003 (including the `UseStatusCodePages()` fix QA's own risk note called for) now supersedes the red state — Code Reviewer confirmed `dotnet build`/`dotnet test` after merge (see below).

## Open Items For Code Reviewer / Next Agent
- **Judgment call — validation message casing**: the contract's `<FieldName> is required.` template is ambiguous on casing. The `errors` dictionary *keys* are now camelCased to match wire JSON (e.g. `"message"`), but the message *text* still uses the C# property's display name as-is (e.g. `"Message is required."`, capitalized, matching the property name unless a DTO adds `[Display(Name = "...")]`). Confirm with spec owner whether message text should also be forced to camelCase/lowercase, or whether Title Case prose is acceptable for UI display, before Epic 2 DTOs standardize on this.
- **EF tool/runtime note**: the global `dotnet-ef` tool is v10.0.8 but the solution targets net8.0; `Microsoft.EntityFrameworkCore.SqlServer`/`.Design` were pinned to `8.0.10` in `Collega.Infrastructure` and `Collega.API` (the 10.x default from `dotnet add package` is net10-only and fails to restore against net8.0). `dotnet-ef` itself worked fine against the 8.0.10 runtime packages once pinned.
- **Design-time DbContext factory**: `dotnet ef` could not reliably resolve `appsettings.Development.json`'s connection string through `Collega.API`'s minimal-hosting `Program.cs` auto-discovery in this environment (`ConnectionString property has not been initialized`). Added `Collega.Infrastructure/Persistence/CollegaDbContextFactory.cs` (`IDesignTimeDbContextFactory`) as a reliable fallback for tooling only; runtime DI is unaffected (`AddInfrastructure` in `Program.cs` still owns the real registration). Worth re-testing on a clean environment — this may be specific to this sandbox.
- **Shared docker SQL Server container**: the repo-root `docker-compose.yml`-managed `collega-sqlserver` container was already running (started by another parallel worktree-agent) with an **empty** `MSSQL_SA_PASSWORD`, so SQL Server refuses to initialize the `sa` login and the container never becomes healthy. Did not touch it (other worktrees may depend on it). Migration verification instead used a disposable, differently-named/ported (`14330`) throwaway container that was removed afterward — schema was confirmed correct but this is a separate signal from "the shared dev SQL Server works." Whoever owns that container should recreate it with a real `.env`.
- `DiagnosticsController`/`EchoRequest` in `Collega.API` are intentionally throwaway pipeline-verification code (explicitly permitted in the task brief), not a product feature — safe to delete once Epic 2+ controllers exist to exercise the validation/error-envelope pipeline for real.

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
- C6-Kanban Board detail view (`/board/{boardId}`, standalone alongside — not a replacement for — the `/ideas` list page): board picker (localStorage persist), compact cards (title/priority/assignee/upvote), title-click navigates to the full-page Idea Detail view at `/ideas/{ideaId}/edit` (Cancel/Save/Move in Board — no overlay, per the Comp C pivot), New Idea button (hidden for ReadOnly), search by title/tag/assignee, filter chips, card drag to `MoveIdeaStatusAsync` (optimistic + rollback), admin column reorder to `UpdateStatusAsync` (immediate-save on drop + rollback), HTML5 DnD desktop-only, components in `Shared/Kanban/`.

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
