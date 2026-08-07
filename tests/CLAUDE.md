# Tests

Four xUnit projects mirroring the `src/` layers. Full strategy — the per-feature list of what must be covered — is `SPEC/40-test-strategy.md`.

```bash
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj   # single project
```

The SQL Server container is **not** required: EF Core tests use the InMemory provider.

| Project | Covers |
|---|---|
| `Collega.Domain.Tests` | Entity invariants, `EmailNormalizer`, `PasswordPolicy`, `TemporaryPasswordGenerator` |
| `Collega.Application.Tests` | Use cases with test doubles for the `Abstractions/` interfaces |
| `Collega.Infrastructure.Tests` | Repositories, configurations, seeding — InMemory provider |
| `Collega.API.Tests` | Integration through the real pipeline via [`CollegaApiFactory`](Collega.API.Tests/Infrastructure/CollegaApiFactory.cs) |

## Conventions

- **Arrange / Act / Assert.** Cover happy path, boundary values, null input, invalid state.
- **Hermetic.** No network, no filesystem, no `DateTime.Now`, no randomness. Inject `IClock` and fixed seeds instead — this is why Application and Domain take time as a dependency.
- **InMemory provider only.** Never point a test at a real database.
- **No duplicate setup.** Use builders/factories; extend the existing ones before adding another.
- **Don't modify test projects unless the change requires it.**
- `[Using Include="Xunit"]` is set in every `.csproj`, so no `using Xunit;` is needed.

## Integration harness

[`CollegaApiFactory`](Collega.API.Tests/Infrastructure/CollegaApiFactory.cs) boots the real host via `WebApplicationFactory<Program>` and swaps the DbContext to InMemory.

One non-obvious constraint, documented at length in that file: **`SiteAdmin` credentials must be supplied as real process environment variables in the constructor, not through `ConfigureWebHost`/`ConfigureAppConfiguration`.** `Program.cs`'s fail-fast check and `AddInfrastructure` call run as top-level statements *before* `builder.Build()`, and `WebApplicationFactory`'s configuration hooks are only spliced in at the intercepted `Build()` — too late. The DbContext provider swap targets the service collection, which genuinely is still open at `Build()` time, so that override works as normally documented. Don't "fix" the env-var approach.
