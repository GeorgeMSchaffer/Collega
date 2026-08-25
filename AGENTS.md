# AGENTS.md

## Build and Test

```bash
dotnet build Collega.sln
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj   # single project
```

EF Core tests use the **InMemory provider** — the PostgreSQL container is not required to run the suite. One exception: `PostgresProviderTests` starts a throwaway Testcontainers container and skips when Docker is unavailable; do not add a second container-backed test class.

E2E tests (`tests/Collega.E2E.Tests`, Playwright for .NET) are skipped by default and require a running app + seeded database. There is also a separate TypeScript Playwright suite in `e2e/` (see `e2e/README.md`).

There is no linter or typecheck step beyond `dotnet build`. No CI workflows are checked in.

## SDK and Runtime

.NET SDK **8.0.118** pinned in `global.json` (`rollForward: latestFeature`). EF packages are pinned to 8.0.x majors — `dotnet add package` will pick net9/net10-compatible versions that fail to restore against net8.0.

## Architecture

Layers, dependencies flow inward:

| Project | Role |
|---|---|
| `src/Collega.Domain` | Entities, enums, value objects, invariants (depends on nothing) |
| `src/Collega.Application` | Use-case orchestration, authorization, validation (depends on Domain) |
| `src/Collega.Infrastructure` | EF Core persistence, seeding, external integrations (implements Application/Domain abstractions) |
| `src/Collega.API` | HTTP host, controllers, request boundary (depends on Application + Infrastructure) |
| `src/Collega.Client` | Blazor WebAssembly UI — Fluent UI Blazor, runs on its own port (5098) |

Business rules live in Domain and Application — **never** in controllers or Blazor components. Each project has its own `CLAUDE.md` with layout, conventions, and gotchas; read the relevant one before working in that area.

`FluentUiComps/` is an unrelated spike, **not part of Collega**.

## Source of Truth

`SPEC/*.md` is canonical. Read the relevant spec before describing or changing behavior. `SPEC/README.MD` indexes the full set.

Critical spec files:

- `SPEC/Bug Triage.md` — **clear its TODO items before starting new features** unless the user explicitly approves an exception. Move fixed items to `SPEC/archive/bug-triage-completed.md`.
- `SPEC/implementation-agent-tracker.md` — the authoritative log of what's built, in progress, and next.
- `SPEC/30-Contracts.md` — canonical API route/payload contracts; read before adding or changing an endpoint.
- `SPEC/40-test-strategy.md` — what must be covered.
- `SPEC/90-definition-of-done.md` — what "done" means.

`SPEC/Specs Overview.md` is derived and non-canonical. Where it disagrees with a canonical spec, the canonical spec wins. `SPEC/archive/` contains superseded documents — don't read unless asked for history. `SPEC/SPECKIT/specs/` contains downstream copies; edit the canonical file first.

## Ground-Truth Verification

Before any status, planning, or scope claim, re-read `SPEC/implementation-agent-tracker.md`'s Current Status section AND run `git log --oneline -10` fresh in the same turn. Never answer from recollection — this project moves fast via parallel worktree agents.

## Client Design Direction

**Comp C "Fluent Editorial"** — locked in `SPEC/20-feature-client-ui.md` and `src/Collega.Client/CLAUDE.md`. Read those before UI work. Key traits: 64px icon rail, serif headings, warm neutral palette, indigo accent. Indigo always means *active/selected/primary action* — introduce new state colours as new tokens, never reuse the accent.

Admin list pages (Orgs, Users, Statuses, Idea Types, Custom Fields) use a **List + Drawer** pattern. Ideas uses a centered **create modal** because it's also opened from the board header. Don't "fix" the admin pages back to a modal — the divergence is deliberate.

If a page or flow's layout isn't settled, produce a throwaway HTML comp in `SPEC/mockups/` for review first rather than writing production Blazor against an undecided design.

## API Conventions

- **Routing:** never write the version segment in a controller. `ApiVersionRoutePrefixConvention` prefixes every controller with `api/v1`, so `[Route("auth")]` serves `/api/v1/auth`.
- **Errors:** throw an `AppException` subtype (e.g. `NotFoundAppException`, `ValidationAppException`); `AppExceptionHandler` maps to problem-details. Don't hand-build error responses in controllers.
- **Validation:** use the repo's own attributes (`RequiredFieldAttribute`, `EmailFormatAttribute`, etc.) in `src/Collega.API/Validation/`, not raw `System.ComponentModel.DataAnnotations`.
- **Seeding:** runs on every startup, idempotent. `--seed:auth` and `--seed:demo` flags override the environment default. `--seed:auth=reset` drops and recreates the configured Site Admin.

## API Startup Gotchas

The API **fails fast** at startup if `SiteAdmin:Email` or `SiteAdmin:Password` is missing. Store secrets in user-secrets (Development only), not in `appsettings.Development.json` (which is committed). `dotnet run` does not read `.env`.

After the Postgres migration, check stale SQL Server user-secrets — a leftover `Server=localhost,1433` connection string will produce confusing Npgsql multi-host errors.

## Testing Conventions

- **Hermetic:** no network, no filesystem, no `DateTime.Now`, no randomness. Inject `IClock` and fixed seeds.
- `[Using Include="Xunit"]` is set in every `.csproj` — no `using Xunit;` needed.
- `CollegaApiFactory` boots the real host via `WebApplicationFactory<Program>` with InMemory DbContext. `SiteAdmin` credentials must be supplied as real process environment variables, not through `ConfigureWebHost` — the fail-fast check runs before the factory's configuration hooks.
- The integration harness blanks `ANTHROPIC_API_KEY` and replaces `IIdeaDraftModel` with a throwing stub to prevent live Anthropic calls during tests.

## Working Rules

- If implementation changes behavior, update the canonical spec first, then align tests and implementation.
- Make surgical changes; avoid unrelated refactors.
- Do not add NuGet packages without approval.
- Use DbContext + LINQ for data access; async/await for all database and I/O operations; EF Core migrations for schema changes.
- SQL: UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.

## Branching

- Feature branches: `feature/<NNN>-<short-description>`
- After build and tests pass: PR to `main`, merge feature into `dev`, push `dev`, report the merge commit hash.
- Conflict resolution: server-side code — prefer `dev`; `SPEC/` and `src/Collega.Client/` — prefer the feature branch.

## Explicitly Deferred

Do not build without an explicit ask: OAuth/SSO, SAML, reporting, guaranteed outbound email delivery, remember-this-device.
