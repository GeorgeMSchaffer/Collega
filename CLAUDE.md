# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

Collega has a working solution scaffold and an initial implementation slice. `Collega.sln`, `global.json` (.NET 8 SDK), all five `src/Collega.*` projects, and their `tests/Collega.*.Tests` counterparts exist and build. Before starting or resuming implementation, read `SPEC/Bug Triage.md` and `SPEC/implementation-agent-tracker.md`. Bug Triage is the authoritative pre-feature queue; unresolved `TODO` items take priority and block new feature starts unless the user explicitly approves an exception. The tracker remains authoritative for implementation status over any summary here, which will drift as tasks complete. As of the last tracker update (2026-08-07): Foundation (T001-T004) and Auth Agent (T005-T011) are merged into `dev`; Tenant Administration Agent (T012-T019) is next and not yet started; the Client Agent (Blazor UI, T040-T045) is no longer blocked on UI comp sign-off — `comp-c-review-06-lockin-v5-final.html` is locked (see "Locked (2026-08-07)" below) — but confirm with the user before spawning a UI/UX Developer implementation pass, since that's still a scoped decision.

This repo also contains:

- `SPEC/` — canonical specs for Collega (source of truth, see below), including the implementation tracker and delivery/workstream plans
- `SPEC/mockups/` — SVG/HTML UI mockups for Collega
- `SPEC/SPECKIT/specs/<NNN-feature>/spec.md` — spec-kit-style derived specs, synced from canonical `SPEC/*.md` (e.g. `002-authentication-and-access`); edit the canonical file first, these are downstream copies
- `FluentUiComps/` — **not part of Collega**, see below

Verify a file/project actually exists and check the tracker before assuming a command will work or a slice is unbuilt — don't rely solely on the descriptions below, which describe the target shape rather than tracking live status.


## Source of Truth

Canonical product behavior lives in `SPEC/*.md`. Read the relevant spec before describing or changing behavior:

- `SPEC/00-project-brief.md` — product model, stack, solution structure, architecture rules
- `SPEC/10-requirements.md`
- `SPEC/20-feature-*.md` — one per feature area (auth, oauth, saml, user-login, organizations-and-users, boards-and-statuses, ideas-and-engagement, notifications, reporting, user-defined-fields, client-ui, client-ui-revisions)
- `SPEC/30-Contracts.md` — canonical API route/payload contracts
- `SPEC/40-test-strategy.md`
- `SPEC/50-technical-implementation-plan.md`, `SPEC/50-kubernetes-deployment.md`
- `SPEC/70-delivery-backlog.md`, `SPEC/80-workstream-roadmap.md`, `SPEC/85-implementation-timeline.md`
- `SPEC/90-definition-of-done.md`
- `SPEC/Bug Triage.md` — authoritative pre-feature bug/minor-tweak queue; clear its `TODO` section before starting new features unless the user explicitly approves an exception
- `SPEC/implementation-agent-tracker.md` — **not product behavior, but the authoritative log of what's actually been built, what's in progress, and what's next**; check this before starting, resuming, or describing the state of implementation work

`SPEC/Specs Overview.md` is a single-document aggregate meant as a fast AI entrypoint, but it is not fully in sync with the individual specs — e.g. it omits invite-code self-registration (`POST /register`, invite-code regenerate) that `SPEC/10-requirements.md`, `SPEC/20-feature-organizations-and-users.md`, and `SPEC/30-Contracts.md` describe as canonical. When the overview and a detailed spec disagree, treat it as an open spec conflict and ask rather than silently picking one.

If behavior is ambiguous or specs conflict, ask before implementing.

## Product Model

Collega is an organization-scoped collaboration/idea-tracking tool, conceptually similar to Trello/Jira: organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes.

- Roles, most to least privileged scope: **Site Admin** (global, not organization-owned) → **Org Admin** (own org only) → **User** → **Read Only**.
  - The first Site Admin account is seeded at startup from environment-provided configuration (`SiteAdmin__Email` / `SiteAdmin__Password`); startup fails fast if either is missing, and that account must change its password on first login. See `SPEC/20-feature-auth.md` requirement #8 and `src/Collega.Infrastructure/Seeding/StartupSeeder.cs`.
- Non-Site Admin users belong to exactly one organization and one role. Email is globally unique across the whole system.
- Each organization gets a system-generated, regenerable invite code; users join via invite-code self-registration, direct admin creation, or admin CSV import (no invite code needed for the latter two).
- MVP scope: auth + forced first-login password change, org/user administration, boards/statuses with swimlanes, idea CRUD + status movement, tags/mentions/comments/upvotes, audit events, notification events persisted (not delivered).
- Explicitly deferred — don't build without an explicit ask: OAuth/SSO, SAML, reporting, guaranteed outbound email delivery, remember-this-device.

## Target Architecture

Layered with strict boundaries — business rules live in Domain and Application, never in controllers or UI components.

| Project | Role | Depends on |
|---|---|---|
| `src/Collega.API` | HTTP host, request boundary | Application |
| `src/Collega.Application` | Use-case orchestration, authorization, validation | Domain |
| `src/Collega.Domain` | Entities, enums, value objects, invariants | nothing (never API/Client/Infrastructure) |
| `src/Collega.Infrastructure` | Persistence, external integrations | implements Application/Domain abstractions |
| `src/Collega.Client` | Blazor UI (Fluent UI Blazor components) | — |
| `tests/` | Unit tests mirroring src layers, plus browser tests | — |

Stack: .NET 8, ASP.NET Core API, Blazor (Fluent UI Blazor), EF Core, SQL Server 2022, xUnit.

Chosen client UI direction is **Comp C "Fluent Editorial"** (`SPEC/mockups/comp-c-fluent-editorial.html`, spec in `SPEC/20-feature-client-ui.md`): slim 64px icon rail, serif display headings, warm neutral palette with an indigo accent, page-header tabs, list-style status sections (grouped rows, not Kanban columns) for boards, and an idea detail that opens as a right slide-in **drawer** (detail + inline edit) with a centered **create modal** — locked 2026-08-10, superseding the earlier full-page "not an overlay" idea detail; see `SPEC/20-feature-client-ui.md` → Idea Detail Surface and `SPEC/mockups/comp-c-review-09-detail-surfaces.html`. Comps A ("Command Center") and B ("Board First") in `SPEC/mockups/` are retained as rejected alternatives, not implementation targets. (Comp A was the prior direction; it was superseded by this decision — see `SPEC/implementation-agent-tracker.md` for history.)

Within that direction, page-level designs are being locked in one feature area at a time via throwaway HTML review comps in `SPEC/mockups/comp-c-review-*.html` (see the Multi-Agent Worktree Workflow section below). The earlier Comp A review comps (`SPEC/mockups/comp-a-review-*.html`) are now superseded and kept only for history.

**Locked (2026-08-07):** `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` is the chosen direction for Sign in, Home, Settings (Orgs/Users lists), Board List, Swim Lanes, and Idea Detail — it supersedes `comp-c-review-06-lockin-v4-combined.html` (kept for history) and, for general chrome/color/spacing, `comp-c-review-01` and `-02`. Those two, plus `-04` and `-05`, remain the reference for the detailed CRUD states v5 doesn't repeat (new/edit/detail/CSV-import forms, status color picker, all sign-in edge-case screens) — `-04` and `-05` were patched in place with the same round of fixes rather than duplicated (see the tracker below). Key decisions: the 64px icon rail stays, showing Home, Boards, Ideas, and Settings identically on every screen, plus a bottom avatar; the richer Home dashboard from Decision D4 in `SPEC/20-feature-client-ui-revisions.md`; minimal border radius throughout; Board List rows/headers colored to match each status (tying List and Swim Lanes to one visual system).

**Resolved (2026-08-07, same session):** Swimlane card treatment is **Flat** (pale lane background, priority-colored chip and left border per card, small status dot in the lane header) — the Banded and Tinted variants were considered and dropped. The `rgb(33,37,41)` header bar is dropped entirely; the rail's bottom avatar owns Sign Out/Profile via a click-open popover (it had no visible interactive affordance before this). The rail gained a dedicated `Ideas` icon. "Admin" is renamed to "Settings" everywhere (rail label, breadcrumbs, page titles). Swimlane priority chips now use the same priority-color encoding as List view instead of borrowing the lane's status color. All reflected in `SPEC/20-feature-client-ui.md` and `SPEC/20-feature-client-ui-revisions.md`; full before/after detail — including a UI/UX critique's gap and anti-pattern findings and their fix status — is in `SPEC/mockups/comp-c-review-06-critique-tracker.md`.

**Idea Detail Surface (locked 2026-08-10):** `SPEC/mockups/comp-c-review-09-detail-surfaces.html` replaces the full-page Idea Detail with a right slide-in **drawer** (detail + inline edit, ≈620px) plus a centered **create modal**, used from every idea entry point (Ideas list, Board List rows, Swim Lane cards). Full parity in the drawer (all fields, tags, mentions, 0–5 assignees, status move, comments, upvote, admin delete). URL-addressable: `?idea={ideaId}` over the current list/board, bare `/ideas/{ideaId}` opens the Ideas list with the drawer open; the `/ideas/{ideaId}/edit` route is retired. Create returns to the list on success (no auto-open). This is the **next pre-MVP implementation item** (see `SPEC/Bug Triage.md` and `SPEC/implementation-agent-tracker.md`), and it also absorbs the related T-UI-2 Ideas-list gaps. The comp's narrow-viewport treatment (full-width drawer sheet, full-screen modal) is the first locked mobile pass for these surfaces.

**Still open:** a broader mobile/narrow-viewport pass for the icon rail and other pages remains undesigned. `SPEC/mockups/comp-c-review-07-ideas-list.html` covers the `/ideas` global idea list/search page design (2026-08-07): a search bar, All/Created-by-me/Assigned-to-me filter chips, a Title/Created By/Assigned To/Status/Created Date table (server-side paginated, 25/50/100/250 rows), and Details opening the idea in the drawer per the surface above. Not yet reviewed/locked.

## Working Rules

- Before starting or resuming implementation, read `SPEC/Bug Triage.md`. Resolve its `TODO` items before starting new features unless the user explicitly approves an exception.
- After a triage item is fixed and focused validation passes, move it from `TODO` to `COMPLETED` with the completion date and verification note. Never leave the same item in both sections.
- Treat `SPEC/*.md` as the source of truth. If implementation changes behavior, update the canonical spec first, then align tests and implementation.
- Always seek clarification before implementing ambiguous or conflicting behavior.
- Make surgical changes; avoid unrelated refactors.
- Do not add NuGet packages without approval.
- Keep business rules in Application/Domain; keep API controllers thin; keep Blazor components focused on rendering and user interaction.
- Use DbContext + LINQ for data access; async/await for all database and I/O operations; EF Core migrations for schema changes.

## Testing Conventions

- Arrange / Act / Assert. Cover happy path, boundary values, null input, invalid state.
- Unit tests must be hermetic: no network, filesystem, `DateTime.Now`, or randomness.
- EF Core tests use the InMemory provider, never a real database.
- Avoid duplicate setup; use builders/factories.
- Do not modify test projects unless the change requires it.

## Local SQL Server (Docker)

`docker-compose.yml` at repo root defines a SQL Server 2022 container with persistent local storage (named volume `sqlserver-data`). Before running it, copy `.env.example` to `.env` (gitignored) and set a real `MSSQL_SA_PASSWORD`:

```bash
cp .env.example .env
# then edit .env and set MSSQL_SA_PASSWORD to a real password
```


```powershell
docker compose up -d sqlserver        # just SQL Server (also the default: `docker compose up -d`)
docker compose --profile full up -d   # SQL Server + the api/web placeholder services
docker compose down                   # stop; add -v to also delete the sqlserver-data volume
```

The `api` and `web` services in that file are placeholders wired for `dotnet watch` hot reload against `src/Collega.API` and `src/Collega.Client` — the projects themselves are now scaffolded, but the services still reference `Dockerfile.dev` paths that don't exist yet, and stay gated behind the `full` profile so they can't be started (or fail a build) by accident. Add real `Dockerfile.dev` files to enable them.

## Build and Run

```powershell
dotnet build Collega.sln
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj
dotnet run --project .\src\Collega.API\Collega.API.csproj
dotnet run --project .\src\Collega.Client\Collega.Client.csproj
```

The API's default `http` launch profile listens on `http://localhost:5103` (Swagger at `/swagger`); the Client's on `http://localhost:5098` — see each project's `Properties/launchSettings.json`. If a port is in use:
```powershell
$env:ASPNETCORE_URLS='http://localhost:5030'; dotnet run --project .\src\Collega.API\Collega.API.csproj
```

Stop any API/watch process you started before finishing.

### Running the unrelated `FluentUiComps` spike

```powershell
dotnet run --project .\FluentUiComps\FluentUiComps.csproj
```

## Coding Standards

- Follow .NET runtime coding style (https://github.com/dotnet/runtime/tree/main/docs/coding-guidelines) and existing repo patterns.
- Prefer clear, minimal code over broad rewrites.
- SQL: UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Keep comments rare and only where the code needs clarification.
- Never commit secrets or temporary files.

## Session and Branch Lifecycle

After build and tests pass on a feature branch:

1. Create a PR to `main`.
2. Merge the feature branch into `dev`.
3. Resolve conflicts using repo rules:
   - server-side code: prefer `dev` where it moved ahead
   - `SPEC/` and `src/Collega.Client/`: prefer the feature branch
4. Push `dev`.
5. Report the merge commit hash in your completion message.

# Source Control
  * Use feature branches for each work item, named `feature/<NNN>-<short-description>`. Once complete merge it into `dev`.
  * Commit work at logical checkpoints such as the completion of a feature and or slice.

## Multi-Agent Worktree Workflow

For epic-level work, split execution across role-based subagents, each in its own isolated git worktree:

- **Backend Developer** — Domain/Application/Infrastructure/API work for the epic's backend tasks.
- **QA Developer** — test harnesses and coverage for the same slice (unit + integration per `SPEC/40-test-strategy.md`).
- **UI/UX Developer** — for epics with client-facing scope, builds Blazor components. When a page/flow hasn't had its layout settled yet, first produce throwaway HTML comps (like `SPEC/mockups/`) for review rather than writing production Blazor code against an undecided design — this avoids rework.
- **Code Reviewer** — reviews each finished branch (diff, build, tests, spec conformance) before it merges. Not a parallel implementer; it gates the other three.

Rules:
- Each implementer agent runs in its own worktree (branch off `dev`) so they don't collide on files mid-flight.
- A role sits out a round if the epic's backlog has no task for it (e.g. Epic 1 has no client-facing task — check `SPEC/70-delivery-backlog.md` before assigning UI/UX work, and don't parallelize downstream-epic UI work early).
- Code Reviewer must approve a branch before it merges.
- Once a branch is reviewed and merged into `dev`, delete both the worktree and the branch. Don't leave merged worktrees around.
- This merges directly into `dev` per finished slice — it does not go through the per-feature-branch PR-to-`main` step above. That step still happens once per epic, when the epic's exit criteria are fully met.
- Update `SPEC/implementation-agent-tracker.md` as slices start/finish so the next session (or agent) knows the state.
