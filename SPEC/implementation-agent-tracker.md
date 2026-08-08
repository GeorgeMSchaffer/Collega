# Collega Implementation Agent Tracker

## Purpose
Track the implementation work that should be executed from the reset baseline, what is currently active, and what is ready next.

## Reset Notice
- Implementation progress has been intentionally reset.
- Treat this tracker as the authoritative execution baseline for starting over.
- Prior implementation history has been cleared from this document on purpose.

## Current Status
- Current implementation slice: Tenant Administration Agent (T012-T019) **implemented** on branch `feature/003-tenant-administration` (build + tests green; not yet merged to `dev`). Auth Agent (T005-T011) previously **merged**. Workflow Configuration Agent (T020-T024) is next up.
- Current owner: no backend agent currently running. UI/UX Developer stays **paused**, but its blocker has cleared: the `comp-c-review-06-lockin-v4-combined.html` sign-off below was superseded by a further critique/fix round (`ui-ux-designer` agent, 2026-08-07), whose result — `comp-c-review-06-lockin-v5-final.html` — is now locked for Sign in, Home, Settings (Orgs/Users), Board List, Swim Lanes, and Idea Detail (see `SPEC/mockups/comp-c-review-06-critique-tracker.md` and `CLAUDE.md`'s "Locked (2026-08-07)" note). Spec updates landed via commit `0f8d246` ("UI critique fixes: lock-in v5 comp, Settings rename, contrast/action-bar fixes"). **UI/UX Developer implementation is no longer blocked on comp sign-off** — confirm with the user before spawning it, since a worktree/implementation pass is still a scoped decision, not automatic.
- Current state: Epic 1 Foundation (T001-T004) and Auth Agent (T005-T011) both merged into `dev`. QA is intentionally being deferred slice-by-slice — see "Ready Next (QA)" below — in favor of one full QA pass once more of the backend has landed. Code Reviewer was also skipped for the Auth Agent merge, by explicit user direction. Next slices, in dependency order: Tenant Administration Agent (T012-T019) → Workflow Configuration Agent (T020-T024) → Collaboration Agent (T025-T036) → Events Agent (T037-T039). Client Agent (T040-T045, C6-Kanban) can now be scoped against the locked v5-final comp.
- Last updated: 2026-08-08

## UI Comp Refinement Complete (2026-08-07, later same day)
The sign-off below (v4-combined) was provisional pending a further refinement pass the user had running in parallel. That pass is complete: `comp-c-review-06-lockin-v5-final.html` supersedes v4 as the locked reference, per `SPEC/mockups/comp-c-review-06-critique-tracker.md`'s decision log and fix status. `SPEC/20-feature-client-ui.md` and `SPEC/20-feature-client-ui-revisions.md` have been updated to point at v5-final instead of v4-combined, and the "Ideas rail icon not yet decided" gap flagged during the v4 sign-off below is resolved (v5 adds a dedicated Ideas icon).

## UI Comp Sign-Off (2026-08-07)
- User reviewed `comp-c-review-01/02/03/04/05` plus a new comparison round (`comp-c-review-06-lockin-v1-quiet-rail.html`, `-v2-warm-canvas.html`, `-v3-bold-ink.html`) and picked a combined direction: `comp-c-review-06-lockin-v4-combined.html`. This is now the locked chrome/color/spacing reference for Sign in, Home, Admin lists, Board List, and Idea Detail — see `CLAUDE.md`'s "Locked (2026-08-07)" note and `SPEC/20-feature-client-ui.md`/`SPEC/20-feature-client-ui-revisions.md` (Decision D4) for the spec-level updates.
- Two decisions reopened and re-resolved along the way:
  1. Nav chrome: user chose to **keep the 64px icon rail** (matching `CLAUDE.md`'s original description and all `comp-c-review-01..05` comps) over `SPEC/20-feature-client-ui.md`'s more recently-locked horizontal top-menu. `SPEC/20-feature-client-ui.md`'s NAVIGATION section and App-shell bullet still describe the horizontal-menu/gear-icon-Settings pattern and have **not yet been rewritten** for the rail — see Open Items below.
  2. Home dashboard: user chose the **richer** dashboard (board tiles + activity feed, comp-b-influenced) over the simpler MVP version locked as Decision D1. Recorded as Decision D4 in `SPEC/20-feature-client-ui-revisions.md`, and reflected in `SPEC/20-feature-client-ui.md`.
- Both remaining open items were resolved by the user later in the same session:
  1. **Swimlane card treatment**: **Flat** (pale lane, left-border priority accent per card, status dot in the lane header). Banded and Tinted were both dropped.
  2. **Header bar vs. rail avatar**: the separate `rgb(33,37,41)` header bar is dropped entirely; the rail's bottom avatar now owns Sign Out/Profile access.
- `SPEC/20-feature-client-ui.md` NAVIGATION and `SPEC/20-feature-client-ui-revisions.md` Header/Menu sections have been rewritten to reflect both. One gap surfaced during that rewrite: the rail comps never included a dedicated `Ideas` icon even though `/ideas` is a required route — flagged inline in `SPEC/20-feature-client-ui.md` at the time. **Resolved in the v5-final critique/fix round** (see "UI Comp Refinement Complete" above): the rail now includes a dedicated Ideas icon on every screen.

## In Progress
- Tenant Administration Agent (T012-T019) on branch `feature/003-tenant-administration`: **code-complete, build + 8 API integration tests green, not yet merged to `dev`.** Awaiting user decision on merge (and whether to run Code Reviewer/QA, both deferred per-slice by prior direction).

## Ready Next (QA)
- By user direction (2026-08-07): QA Developer's Auth Agent-slice contract-test pass was stopped mid-work and its worktree/branch discarded (only an uncommitted `FakeClock.cs` scaffold existed, no commits — nothing lost). QA is skipped per-slice for now; a **full QA pass across all merged backend slices** happens later once more of the backend has landed, rather than one QA worktree per slice.

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
- UI/UX Developer: comp 3 (`comp-c-review-03-board-list.html`) now offers both a **List view** (Comp C's native grouped list-sections by status) and a **Swim Lane view** (Jira/Trello-style Kanban columns, functional drag-and-drop between columns) via a per-role toggle, for both the User and Read Only roles, with Swim Lanes as the default. Both views represent the same 48 ideas — it's a display preference, not two data models. Status names/colors were originally reconciled here with an illustrative 4-status set (New/slate, Research In Process/blue, In Review/amber, Complete/green); that set was later replaced everywhere by the canonical 5 (New/Pending, In Review, In Progress, Client Review, Complete — see "Ready Next" below) so the idea card's priority chip can be colored by its status (per user decision) rather than by priority level; the chip still displays High/Medium/Low text. The "Configure swimlanes" tab was also corrected to a mathematically consistent demo of the 2-swimlane minimum (2 selected, both Remove disabled, 2 more available to add). This comp's List/Swim Lane treatment is now **locked** via `comp-c-review-06-lockin-v5-final.html` (see "UI Comp Refinement Complete" above); `comp-c-review-03-board-list.html` itself remains for history.
- UI/UX Developer: new comp `comp-c-review-05-admin-statuses.html` for status configuration. Comp covers: status list (table, drag-to-reorder, consistent with the Orgs/Users list pattern), New/Edit status form (Name text field max 25 chars, Color via preset swatch picker + custom hex, Sort Order via drag or nudge arrows), and a "last-status guard" edge case showing Delete disabled with a tooltip. **Needs an update**: `Status.Color`/`Status.SortOrder` are now canonical (see Ready Next above), and the org-wide active-status minimum was resolved to 2 (not 1) — the comp's guard edge case currently disables Delete only when exactly one active status remains and needs to disable at two remaining instead. Not locked yet.
- QA Developer: Epic 1 baseline smoke-test harness in `tests/Collega.API.Tests` (`Infrastructure/CollegaApiFactory.cs` + `SmokeTests.cs`), using `Microsoft.AspNetCore.Mvc.Testing`. Added a testing-only `public partial class Program {}` shim to `src/Collega.API/Program.cs`. Originally 1 passed / 1 red pending Backend's problem-details work; Backend Developer's T003 (including the `UseStatusCodePages()` fix QA's own risk note called for) now supersedes the red state — Code Reviewer confirmed `dotnet build`/`dotnet test` after merge (see below).
- **T005-T011 Auth Agent slice** (Backend Developer, merged `4579226` on top of `1976489`, 2026-08-07; no separate QA/Code Reviewer pass — merged directly by user direction). Built: `User`/`Organization` domain entities (deliberately minimal — full org/user admin CRUD is Tenant Administration Agent's job next, not built here), `PasswordPolicy`, `EmailNormalizer`, `TemporaryPasswordGenerator`; `AuthService`/`IAuthService` (login, change-password, register, temp-password issuance, get-current-user), `TokenAuthenticationService`; `Pbkdf2PasswordHasher` (BCL `Rfc2898DeriveBytes`, no new package), hand-built HS256 `JwtAccessTokenService` (BCL-only) implementing the JWT+`SecurityStamp` design from `SPEC/60-spec-q-and-a-backlog.md` decision 14; EF repositories, `StartupSeeder`, migration `AddAuthEntities`; `AuthController` (`POST /auth/login`, `GET /auth/me`, `POST /auth/change-password`, `POST /auth/register`), `UsersController` (`POST /users/{userId}/temporary-password`), custom `Bearer` auth handler, `SpacedDisplayNameMetadataProvider` implementing decision 15's Title Case validation wording. Removed Epic 1's throwaway `DiagnosticsController`/`EchoRequest`. `dotnet build Collega.sln`: 0 warnings/errors (independently re-verified before merge). Verified end-to-end via a throwaway integration test (login → me → wrong-password 401 → forced change → old token rejected post-change confirming `SecurityStamp` invalidation works → re-login → weak-password 400 → demo-user login → temp-password issuance/login/forced-change → invalid invite code 400 → 5-attempt lockout → 429), then deleted; real SQL Server was too slow to boot in-sandbox so InMemory-provider test host was used instead.
  - **Incident, disclosed and resolved**: the agent's own worktree tooling mistakenly ran `rm` against the shared main checkout instead of its worktree early on, deleting `DiagnosticsController.cs`/`EchoRequest.cs` there. It self-restored both from git history via raw filesystem writes (git commands were correctly sandbox-blocked outside its worktree) and flagged the incident. On merge, `EchoRequest.cs` was confirmed byte-identical to git history; `DiagnosticsController.cs`'s doc-comment had been reconstructed slightly short and was restored exactly via `git checkout --` before merging. Both files are deleted anyway by this same merge (superseded by real controllers), so this only mattered for the moment between the incident and the merge.
  - **Judgment calls, not yet reviewed by a human**:
    1. **Resolved 2026-08-07**: demo password `abc123!` (per `SPEC/10-requirements.md`) had no uppercase character and literally violated `PasswordPolicy`; the seeder had bypassed policy validation to honor the spec text verbatim. Per user decision, changed to `Abc123!` everywhere (specs + `StartupSeeder.DemoPassword`) — satisfies policy with no bypass needed. See `SPEC/60-spec-q-and-a-backlog.md` decision 16.
    2. The 5-in-15-minute lockout is a fixed-window approximation (resets on a >15min gap since the last failure), not a true sliding window.
    3. The failed attempt that *triggers* lockout returns `429` immediately rather than `401` then `429` on the next attempt — reasonable, but the contract doesn't spell out which.
    4. The JWT signing key is ephemeral per-process unless `Auth:TokenSigningKey` is configured — fine for a single dev instance, must be set explicitly before any multi-instance or long-uptime deployment.
    5. `PUT /auth/me` (profile self-edit) and the post-MVP self-service reset endpoints were deliberately not built — out of T005-T011 scope (self-service reset is explicitly deferred pending email delivery).
    6. `CollegaApiFactory` and `Collega.API.Tests.csproj` were modified (InMemory DB swap, test Site Admin env vars) so Epic 1's smoke tests keep passing against the new DB-backed startup.
    7. Login/register/me/temp-password response bodies reuse Application-layer result records directly as wire DTOs rather than separate API response types — a minor layering compromise worth a future hardening pass, not a spec violation.

- **T012-T019 Tenant Administration Agent slice** (branch `feature/003-tenant-administration`, 2026-08-08; code-complete, NOT yet merged). Built:
  - **Domain**: extended `Organization` (description, logo fields, profile fields, `Update`/`Archive`/`RegenerateInviteCode`); new `Status` (with `Color`/`SortOrder`/`IsDeleted`), `Board` (min-2-swimlanes invariant), `BoardSwimlane`; added `User.UpdateName` (self-service) and `User.Administer` (admin edit; rejects Site Admin role on org users, keeps org membership immutable).
  - **Application**: `IOrganizationService`/`OrganizationService` (list/create/detail/update/archive/invite-regenerate, Site-Admin vs Org-Admin scoping), `IUserService`/`UserService` (org-scoped create/detail/list/update, email uniqueness, Active/Inactive, **last-Org-Admin self-safeguard** on role/status change), `IOrganizationBootstrapService`/`OrganizationBootstrapService` (provisions the 5 default statuses + 1 default board), `PagedResult<T>`/`PageRequest`/`SortDirection` primitives, `IInviteCodeGenerator` abstraction, `IStatusRepository`/`IBoardRepository`, `AuthService.UpdateProfileAsync` (`PUT /auth/me`, closing Auth-slice judgment-call #5). Audit events emitted for org create/update/archive/invite-regen and user create/update/profile-update (T019).
  - **Infrastructure**: EF configs for the new entities + extended `OrganizationConfiguration`; `EfStatusRepository`/`EfBoardRepository`, extended org/user repos (paged list, `CountActiveOrgAdmins`, `InviteCodeExists`); `InviteCodeGenerator` (ambiguity-free alphabet); `StartupSeeder` now provisions defaults for demo orgs; migration `AddTenantAdministration` (adds org columns with `DEFAULT N''` for description; creates `statuses`/`boards`/`board_swimlanes`). Idempotent SQL script generated and inspected (valid DDL); not applied to a live DB this session.
  - **API**: `OrganizationsController` (org CRUD + archive + invite-regenerate + nested `/organizations/{id}/users` list/create), extended `UsersController` (`GET`/`PUT /users/{id}`), `PUT /auth/me`; contracts under `Contracts/Organizations` and `Contracts/Users` using the repo's validation attributes; DI wiring in `Program.cs`.
  - **Verification**: `dotnet build Collega.sln` 0 warnings/0 errors; `tests/Collega.API.Tests/TenantAdministrationTests.cs` (6 new integration tests via the InMemory host) + existing smoke tests = 8/8 green. List `search` intentionally untested against InMemory (uses `EF.Functions.Like`).
  - **Scope deferred (not in T012-T019 task list)**: binary logo upload (`PUT /organizations/{id}/logo` + thumbnailing), user CSV import (`POST .../users/import`), and organization AI-API-key management. Board/status *management* endpoints belong to the Workflow Configuration slice (T020-T024).
  - **Judgment calls, not yet reviewed by a human**:
    1. **Default status Color/SortOrder** (still a formal spec open item — `SPEC/60-spec-q-and-a-backlog.md`): used the locked-comp colors recorded in this tracker (New/Pending `#64748B`, In Review `#D97706`, In Progress `#2563EB`, Client Review `#7C3AED`, Complete `#16A34A`) and SortOrder `10,20,30,40,50`. Centralized in `OrganizationDefaults`; trivially changed if the user picks different values.
    2. **Last-Org-Admin safeguard scope**: enforced only on **self-action** (an Org Admin editing themselves), per T018 wording — a Site Admin may still demote/deactivate the last Org Admin. Modeled as a `400` (`ValidationAppException` keyed on `role`/`status`), not `403`.
    3. **Org detail/update visibility**: an Org Admin targeting another org gets `404` (not `403`) to avoid leaking existence; `User`/`Read Only` get `403`. Archive is Site-Admin-only (`403` otherwise) per org-and-users rule #8.
    4. **Status name length**: modeled as `nvarchar(100)` (persistence design) though `comp-c-review-05` hints max 25 — left for the Workflow Configuration slice to reconcile when it owns status validation.
    5. Default board opens with all 5 statuses as swimlanes, `allowUserStatusUpdate = true`, named "Ideas".

## Open Items For Code Reviewer / Next Agent
- **Judgment call — validation message casing: RESOLVED 2026-08-07.** Confirmed via user interview: `errors` dict keys stay camelCase, message *text* uses human-readable spaced Title Case (e.g. "First Name is required."). Recorded as decision 15 in `SPEC/60-spec-q-and-a-backlog.md`, written into `SPEC/30-Contracts.md`'s Validation Message Conventions, and implemented in the Auth Agent slice via `SpacedDisplayNameMetadataProvider` (see Completed above). No longer open.
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
