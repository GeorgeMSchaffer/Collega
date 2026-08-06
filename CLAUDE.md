# Copilot Instructions — Collega

Collega is a spec-driven, organization-scoped collaboration and idea-tracking platform. Stack: .NET 8 (SDK pinned to `8.0.118` via `global.json`), ASP.NET Core API, Blazor client (Fluent UI Blazor), EF Core, xUnit.

## Working Rules

- Always seek clarification before implementing ambiguous behavior. See `.\github\skills\karpathy-guidelines\SKILL.md` skill for guidance.
- Treat `SPEC/*.md` as the source of truth.
- Read the relevant spec before changing behavior:
  - `SPEC/00-project-brief.md`
  - `SPEC/10-requirements.md`
  - `SPEC/20-feature-*.md`
  - `SPEC/30-Contracts.md`
  - `SPEC/40-test-strategy.md`
  - `SPEC/90-definition-of-done.md`
- If implementation changes behavior, update the canonical spec first, then align tests and implementation.
- If behavior is ambiguous, ask before implementing.
- Make surgical changes; avoid unrelated refactors.
- Do not add NuGet packages without approval.

## Architecture

Layered with strict boundaries — business rules live in Domain and Application, never in controllers or UI components.

| Project | Role | Depends on |
|---|---|---|
| `src/Collega.API` | HTTP host, request boundary | Application |
| `src/Collega.Application` | Use-case orchestration, authorization, validation | Domain |
| `src/Collega.Domain` | Entities, enums, value objects, invariants | nothing (never API/Client/Infrastructure) |
| `src/Collega.Infrastructure` | Persistence, external integrations | implements Application/Domain abstractions |
| `src/Collega.Client` | Blazor UI (Fluent UI Blazor components) | — |
| `tests/` | Unit tests mirroring src layers, plus browser tests | — |

## Spec Governance

- Canonical behavior lives in `SPEC/*.md`.
- When behavior changes:
  1. update the relevant canonical spec,
  2. update implementation and tests,
  3. verify tests still match the spec.

Key domain rules:
- Only Site Admin creates organizations.
- Organization creation requires title, description, and optional logo address.
- Each organization gets a system-generated invite code.
- Users join by invite-code self-registration, direct admin creation, or admin CSV import.
- Emails are globally unique.
- Non-Site Admin users belong to exactly one organization.

## Implementation Guidance

- Keep business rules in Application/Domain.
- Keep API controllers thin.
- Keep Blazor components focused on rendering and user interaction.
- Prefer existing helpers, patterns, and abstractions.
- Use DbContext and LINQ for data access.
- Use async/await for all database and I/O operations.
- Use migrations for schema changes.

## Testing

- Follow Arrange / Act / Assert.
- Test happy path, boundary values, null input, and invalid state.
- Unit tests must be hermetic: no network, file system, `DateTime.Now`, or randomness.
- EF Core tests use the InMemory provider, never a real database.
- Avoid duplicate setup; use builders/factories.
- Do not modify test projects unless required by the change.

## Build and Run

```powershell
dotnet build Collega.sln
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj
dotnet run --project .\src\Collega.API\Collega.API.csproj
```

If port 5027 is in use, use:
```powershell
$env:ASPNETCORE_URLS='http://localhost:5030'; dotnet run --project .\src\Collega.API\Collega.API.csproj
```

Stop any API/watch process you started before finishing.

## Coding Standards

- Follow .NET runtime coding style and existing repo patterns.
- Prefer clear, minimal code over broad rewrites.
- SQL: UPPERCASE keywords, lowercase table/column names, no `SELECT *`, meaningful aliases.
- Keep comments rare and only where the code needs clarification.
- Never commit secrets or temporary files.

## Session and Branch Lifecycle

After build and tests pass on the feature branch:

1. Create a PR to `main`.
2. Merge the feature branch into `dev`.
3. Resolve conflicts using repo rules:
   - server-side code: prefer `dev` where it moved ahead
   - `SPEC/` and `src/Collega.Client/`: prefer the feature branch
4. Push `dev`.
5. Report the merge commit hash in your completion message.

## Good Defaults for Copilot

- Read the spec before proposing code.
- Keep answers grounded in repo conventions.
- When unsure, ask rather than assume.
- Verify behavior with the smallest useful test/build command.
