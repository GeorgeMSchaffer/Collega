# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

Collega has **no implementation yet**. There is no `.sln`, no `global.json`, and none of the `src/Collega.*` or `tests/` projects described below exist on disk. This repo currently contains only specs, mockups, and one unrelated scaffold:

- `SPEC/` — canonical specs for Collega (source of truth, see below)
- `SPEC/mockups/` — SVG/HTML UI mockups for Collega
- `SPEC/SPECKIT/specs/<NNN-feature>/spec.md` — spec-kit-style derived specs, synced from canonical `SPEC/*.md` (e.g. `002-authentication-and-access`); edit the canonical file first, these are downstream copies
- `FluentUiComps/` — **not part of Collega**, see below

Everything under "Target Architecture" and "Build and Run" below describes the intended future state. Verify a file/project actually exists before assuming a command will work.


## Source of Truth

Canonical product behavior lives in `SPEC/*.md`. Read the relevant spec before describing or changing behavior:

- `SPEC/00-project-brief.md` — product model, stack, solution structure, architecture rules
- `SPEC/10-requirements.md`
- `SPEC/20-feature-*.md` — one per feature area (auth, oauth, saml, user-login, organizations-and-users, boards-and-statuses, ideas-and-engagement, notifications, reporting, user-defined-fields, client-ui, client-ui-revisions)
- `SPEC/30-Contracts.md` — canonical API route/payload contracts
- `SPEC/40-test-strategy.md`
- `SPEC/50-technical-implementation-plan.md`, `SPEC/50-kubernetes-deployment.md`
- `SPEC/70-delivery-backlog.md`, `SPEC/80-workstream-roadmap.md`
- `SPEC/90-definition-of-done.md`

`SPEC/Specs Overview.md` is a single-document aggregate meant as a fast AI entrypoint, but it is not fully in sync with the individual specs — e.g. it omits invite-code self-registration (`POST /register`, invite-code regenerate) that `SPEC/10-requirements.md`, `SPEC/20-feature-organizations-and-users.md`, and `SPEC/30-Contracts.md` describe as canonical. When the overview and a detailed spec disagree, treat it as an open spec conflict and ask rather than silently picking one.

If behavior is ambiguous or specs conflict, ask before implementing.

## Product Model

Collega is an organization-scoped collaboration/idea-tracking tool, conceptually similar to Trello/Jira: organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes.

- Roles, most to least privileged scope: **Site Admin** (global, not organization-owned) → **Org Admin** (own org only) → **User** → **Read Only**.
- Non-Site Admin users belong to exactly one organization and one role. Email is globally unique across the whole system.
- Each organization gets a system-generated, regenerable invite code; users join via invite-code self-registration, direct admin creation, or admin CSV import (no invite code needed for the latter two).
- MVP scope: auth + forced first-login password change, org/user administration, boards/statuses with swimlanes, idea CRUD + status movement, tags/mentions/comments/upvotes, audit events, notification events persisted (not delivered).
- Explicitly deferred — don't build without an explicit ask: OAuth/SSO, SAML, reporting, guaranteed outbound email delivery, remember-this-device.

## Target Architecture (not yet created)

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

Chosen client UI direction is **Comp A "Command Center"** (`SPEC/mockups/comp-a-command-center.html`, spec in `SPEC/20-feature-client-ui.md`): left nav rail with grouped sections, breadcrumbs, dense tables with command bars, and a two-pane idea detail overlay. Comps B ("Board First") and C ("Fluent Editorial") in `SPEC/mockups/` are retained as rejected alternatives, not implementation targets.

## Working Rules

- Treat `SPEC/*.md` as the source of truth. If implementation changes behavior, update the canonical spec first, then align tests and implementation.
- Always seek clarification before implementing ambiguous or conflicting behavior.
- Make surgical changes; avoid unrelated refactors.
- Do not add NuGet packages without approval.
- Keep business rules in Application/Domain; keep API controllers thin; keep Blazor components focused on rendering and user interaction.
- Use DbContext + LINQ for data access; async/await for all database and I/O operations; EF Core migrations for schema changes.

## Testing Conventions (once `tests/` exists)

- Arrange / Act / Assert. Cover happy path, boundary values, null input, invalid state.
- Unit tests must be hermetic: no network, filesystem, `DateTime.Now`, or randomness.
- EF Core tests use the InMemory provider, never a real database.
- Avoid duplicate setup; use builders/factories.
- Do not modify test projects unless the change requires it.

## Local SQL Server (Docker)

First set your password for the `sa` user in `.env` (copied from `.env.example`) you can run
`rm -f ~/code/Collega/.env; ls ~/code/Collega/.env 2>/dev/null || echo "removed"`
then run the SQL Server container:
`docker-compose.yml` at repo root defines a SQL Server 2022 container with persistent local storage (named volume `sqlserver-data`). Copy `.env.example` to `.env` (gitignored) and set a real `MSSQL_SA_PASSWORD` before running.


```powershell
docker compose up -d sqlserver        # just SQL Server (also the default: `docker compose up -d`)
docker compose --profile full up -d   # SQL Server + the api/web placeholder services
docker compose down                   # stop; add -v to also delete the sqlserver-data volume
```

The `api` and `web` services in that file are placeholders wired for `dotnet watch` hot reload against `src/Collega.API` and `src/Collega.Client` — they reference `Dockerfile.dev` paths that don't exist yet and are gated behind the `full` profile so they can't be started (or fail a build) by accident. Fill them in once those projects are scaffolded.

## Build and Run (target state, once the solution exists)

```powershell
dotnet build Collega.sln
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj
dotnet run --project .\src\Collega.API\Collega.API.csproj
```

If port 5027 is in use:
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
