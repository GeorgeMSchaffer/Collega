# Tests

Four xUnit projects mirroring the `src/` layers. Full strategy — the per-feature list of what must be covered — is `SPEC/40-test-strategy.md`.

```bash
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj   # single project
```

The PostgreSQL container is **not** required: EF Core tests use the InMemory provider. The one exception is [`PostgresProviderTests`](Collega.Infrastructure.Tests/PostgresProviderTests.cs), which starts its own throwaway container and skips when Docker is unavailable — see [Real-database exception](#real-database-exception).

| Project | Covers |
|---|---|
| `Collega.Domain.Tests` | Entity invariants, `EmailNormalizer`, `PasswordPolicy`, `TemporaryPasswordGenerator` |
| `Collega.Application.Tests` | Use cases with test doubles for the `Abstractions/` interfaces |
| `Collega.Infrastructure.Tests` | Repositories, configurations, seeding — InMemory provider (plus the one PostgreSQL exception below) |
| `Collega.API.Tests` | Integration through the real pipeline via [`CollegaApiFactory`](Collega.API.Tests/Infrastructure/CollegaApiFactory.cs) |

## Conventions

- **Arrange / Act / Assert.** Cover happy path, boundary values, null input, invalid state.
- **Hermetic.** No network, no filesystem, no `DateTime.Now`, no randomness. Inject `IClock` and fixed seeds instead — this is why Application and Domain take time as a dependency.
- **InMemory provider only.** Never point a test at a real database — with the single, deliberate exception documented below.
- **No duplicate setup.** Use builders/factories; extend the existing ones before adding another.
- **Don't modify test projects unless the change requires it.**
- `[Using Include="Xunit"]` is set in every `.csproj`, so no `using Xunit;` is needed.

## Real-database exception

[`PostgresProviderTests`](Collega.Infrastructure.Tests/PostgresProviderTests.cs) is the **only** test in the repo that talks to a real database, and the **first and only one that is not hermetic**. It runs a `postgres:16` container via Testcontainers. The nearest precedent, [`ImageSharpImageProcessorTests`](Collega.Infrastructure.Tests/ImageSharpImageProcessorTests.cs), is a precedent only for the *shape* of the argument — reach for the real component when a fake could not prove the thing, and say why in the class itself. That test is still hermetic; this one genuinely is not.

**Why the exception is necessary.** The InMemory provider is not a database. It models no SQL translation, no column types, no collation, and no DDL, so it cannot prove that a migration applies, that `DateTime` values survive Npgsql's `timestamp with time zone` mapping, or that a unique index is actually enforced. The Sprint 5 SQL Server → PostgreSQL provider swap left every InMemory test green while nothing had checked that PostgreSQL accepted the schema at all. These three tests close that specific gap and nothing wider.

**Scope and mechanics.** Migrate-up, a UTC `DateTime` round trip, and database-level enforcement of `ux_users_normalized_email` — three tests, one container for the whole class via a `PostgresContainerFixture` class fixture, a separate database per test, disposed through `IAsyncLifetime` even on failure. Credentials come from Testcontainers, so the tests do not depend on the app's configured PostgreSQL user. They carry `[DockerRequiredFact]`, which skips rather than fails when no Docker daemon is reachable, and the class carries `[Trait("Category", "Container")]` so a pipeline that must not depend on Docker Hub can filter them out with `--filter "Category!=Container"`. Note that the current deploy workflow runs on `ubuntu-latest`, which *does* have Docker, so today these run in CI rather than skip.

**The general rule is unchanged.** Every other test — including every other EF Core test — stays hermetic and stays on the InMemory provider. Do not widen this exception, and do not add a second container-backed test class; if PostgreSQL-specific behavior needs covering, add a case here.

## Integration harness

[`CollegaApiFactory`](Collega.API.Tests/Infrastructure/CollegaApiFactory.cs) boots the real host via `WebApplicationFactory<Program>` and swaps the DbContext to InMemory.

One non-obvious constraint, documented at length in that file: **`SiteAdmin` credentials must be supplied as real process environment variables in the constructor, not through `ConfigureWebHost`/`ConfigureAppConfiguration`.** `Program.cs`'s fail-fast check and `AddInfrastructure` call run as top-level statements *before* `builder.Build()`, and `WebApplicationFactory`'s configuration hooks are only spliced in at the intercepted `Build()` — too late. The DbContext provider swap targets the service collection, which genuinely is still open at `Build()` time, so that override works as normally documented. Don't "fix" the env-var approach.
