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
- Current state: Backend Developer slice (T002-T004) complete and awaiting Code Reviewer approval before merge to `dev`; QA Developer baseline smoke-test harness still not yet launched.
- Last updated: 2026-08-06

## In Progress
- Baseline smoke-test harness for boot and error-envelope behavior. (QA Developer — not yet relaunched)

## Ready Next
- QA Developer: baseline smoke tests for boot and error-envelope behavior, against the Backend Developer's T002-T004 branch (`worktree-agent-aaf13a8bec89965bf`, merged from `dev` at `84f9af7`). `Program` is exposed as a public partial class in `src/Collega.API/Program.cs` for `WebApplicationFactory`-based integration tests.
- Code Reviewer: review the T002-T004 branch before it merges to `dev`.

## Completed
- T001 Create the solution structure and project references.
- T002 Add the EF Core DbContext, migrations, and audit storage foundations. (Backend Developer) `CollegaDbContext` (audit events only, per Epic 1 scope — no feature entities), `audit_events` table mapping, `EfAuditEventWriter` implementing `IAuditEventWriter`, `InitialCreate` migration generated and applied successfully against a live throwaway SQL Server 2022 container (schema verified via `INFORMATION_SCHEMA.COLUMNS`), then torn down. Design-time `IDesignTimeDbContextFactory` added because ASP.NET Core minimal-hosting auto-discovery of `Program.cs` was not resolving `appsettings.Development.json`-based configuration for `dotnet ef` reliably in this environment.
- T003 Implement shared `/api/v1` routing conventions and problem-details error handling. (Backend Developer) `ApiVersionRoutePrefixConvention` prefixes every controller route with `api/v1` (contract's path versioning) without repeating it per controller. `AddCollegaProblemDetails()` wires `AddProblemDetails()` + `UseExceptionHandler()` + `UseStatusCodePages()` so every non-2xx response (401/403/404/500, not just validation failures) is rendered as `application/problem+json` with `type`/`title`/`status`/`detail`/`instance` populated. Verified live via curl: unknown route returns a populated problem-details 404.
- T004 Implement API request validation plumbing and OpenAPI scaffolding. (Backend Developer) Custom `RequiredField`/`MaxLengthField`/`MinLengthField`/`RangeField`/`EmailFormat`/`AllowedValues` attributes in `Collega.API/Validation` produce the exact contract wording templates (e.g. "Message is required.") instead of framework defaults; a custom `InvalidModelStateResponseFactory` returns a `ValidationProblemDetails` envelope with an `errors` object keyed by **camelCase** field name (translated from the C# ModelState path, e.g. `Assignees[0].UserId` -> `assignees[0].userId`) to match contract JSON field names — flagged below as a judgment call. Swagger/OpenAPI given an explicit title/version. A diagnostics-only `HealthController` (`GET /api/v1/health`) and `DiagnosticsController` (`POST /api/v1/diagnostics/echo`) were added purely to prove the pipeline end-to-end (not product features); later epics should feel free to remove `DiagnosticsController` once real resource controllers exist to exercise validation.
- UI/UX Developer: 4 HTML review comps for design sign-off before any Blazor work starts, built directly (not via a background agent, after the first attempt was interrupted). See `SPEC/mockups/comp-a-review-01-login-and-auth.html`, `-02-admin-orgs-users.html`, `-03-board-kanban.html`, `-04-idea-detail.html`. Awaiting user review before Client Agent tasks (T040-T045) begin.

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
