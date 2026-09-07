# The frozen .NET stack

> **This describes code that is being deleted.** `src/Collega.*`, `tests/`, `Collega.sln` and
> `global.json` are the .NET 8 application the TypeScript stack replaces. They were **frozen on
> 2026-09-06** ([`SPEC/decisions.md`](SPEC/decisions.md)) and are removed in conversion slice **F6**.
>
> Nothing here is guidance for building anything. It is here so the old app can still be *run*.

Everything current lives in [`README.md`](README.md).

## What you may not do

- Do not add features, fix bugs, write tests, or refactor in `src/` or `tests/`. A defect found here
  is recorded against the TypeScript port instead.
- Do not add an EF migration, a NuGet package, or an endpoint. The schema is frozen at conversion
  slice S0.2 and Prisma owns it now.
- Do not copy patterns from here into `apps/` or `packages/`. The layering ports; the idioms do not.

Every `CLAUDE.md` under `src/` and `tests/` carries a banner saying the same.

## Why it is still on disk

Two reasons, both temporary:

1. **It is the golden corpus's recorder.** `tools/golden` holds 447 recorded HTTP cases across all
   81 endpoints at four roles — the conversion's *only* oracle, since the .NET test suite is
   discarded rather than ported. Re-recording a missing or wrong fixture needs this API to boot, and
   Waves D and E are exactly where such a gap surfaces. Git history is not a substitute: an old
   commit expects a schema Prisma has since reshaped.
2. **It is the only complete working product** until the Nest API (Wave D) and the remaining web
   slices (Wave E) land. When you need to know how a screen actually behaved, this is the answer.

Once golden replay passes against Nest, both reasons are spent and F6 deletes the solution.

## Running it

Requires the **.NET SDK 8.0.118**, pinned in `global.json`. No local .NET? See
[Without a local .NET](#without-a-local-net).

### 1. Secrets

The API **fails fast at startup** without `SiteAdmin:Email` and `SiteAdmin:Password`
([`StartupConfigurationValidator`](src/Collega.API/Startup/StartupConfigurationValidator.cs)).
`dotnet run` does **not** read `.env` — that file only reaches the API under `docker compose` — so
use user-secrets:

```bash
cd src/Collega.API
dotnet user-secrets init
dotnet user-secrets set "SiteAdmin:Email" "admin@collega.local"
dotnet user-secrets set "SiteAdmin:Password" "<your-password>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Host=localhost;Port=5432;Database=Collega;Username=collega;Password=<your-password>"

# Optional — omit to run AI assist dark.
dotnet user-secrets set "ANTHROPIC_API_KEY" "<key>"
```

Environment variables work too, with a **double** underscore: `SiteAdmin__Email`.

The connection-string secret overrides the placeholder in `appsettings.Development.json`, which is
committed and must never hold a real password.

### 2. PostgreSQL

Same container the TypeScript stack uses — see [`README.md`](README.md#database). Start it first.

### 3. Two processes

The app is an API plus a WebAssembly client that calls it over HTTP. You need both:

```bash
# terminal 1
dotnet run --project src/Collega.API/Collega.API.csproj

# terminal 2
dotnet run --project src/Collega.Client/Collega.Client.csproj
```

| Surface | URL |
|---|---|
| **Client — start here** | http://localhost:5098 |
| API | http://localhost:5103 |
| Swagger UI (Development only) | http://localhost:5103/swagger |
| Health check | http://localhost:5103/api/v1/health |

Sign in with any account from [`demo.md`](demo.md). Migrations apply and seeding runs on startup, so
a fresh clone needs no manual database setup.

`ASPNETCORE_URLS` alone is ignored because `launchSettings.json` sets `applicationUrl`. To override a
port, bypass the profile:

```bash
ASPNETCORE_URLS='http://localhost:5027' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile
```

### Without a local .NET

`docker compose` runs the API on the SDK image against a bind mount of the repository — migrations
and seeding included:

```bash
docker compose --profile full up -d api    # http://localhost:5027
docker compose logs -f api
```

Behind a TLS-inspecting proxy, `dotnet restore` fails inside the container even though it works on
the host, because the host trusts the proxy's CA and a fresh container does not:

```bash
cp /path/to/ca-bundle.crt docker/proxy-ca/proxy.crt
docker compose --profile full build api
```

`docker/proxy-ca/*.crt` is gitignored; with no certificate present the build is unaffected.

## Seeding

Idempotent, runs on every boot
([`StartupSeeder.cs`](src/Collega.Infrastructure/Seeding/StartupSeeder.cs)). The Site Admin is always
seeded; demo data only under `Development`. Flags override that — naming any `--seed:*` switches to
explicit mode, where only the seeds you name run, in any environment:

```bash
dotnet watch --project ./src/Collega.API -- --seed:auth --seed:demo
```

**Forgotten Site Admin password?** `--seed:auth=reset` drops the account matching the configured
`SiteAdmin:Email` and recreates it with `MustChangePassword: true`. It targets only that account, so
a manually promoted Site Admin on a different email is left alone, and it seeds no demo data:

```bash
dotnet run --project ./src/Collega.API -- --seed:auth=reset
```

Full flag semantics: [`src/Collega.API/CLAUDE.md`](src/Collega.API/CLAUDE.md#seeding-flags). The
account roster is [`demo.md`](demo.md).

## Tests

```bash
dotnet test Collega.sln
```

**This suite is discarded, not ported** (conversion ticket `10`) — 16,900 lines whose coverage is
replaced by the golden corpus plus fresh per-slice Vitest. Do not add to it.

Tests are hermetic: no network, no filesystem, no `DateTime.Now`, no randomness. EF Core tests use
the InMemory provider, so PostgreSQL is not required. Two deliberate exceptions:

- `PostgresProviderTests` starts a throwaway Testcontainers instance and skips when Docker is
  absent. It exists because the InMemory provider models no SQL translation, no column types and no
  DDL — a blind spot that let four defects through 561 green tests during the Postgres migration.
- `tests/Collega.E2E.Tests` is Playwright for .NET, skipped by default, and needs a running app.

## EF Core migrations

Frozen — the schema belongs to Prisma now. Recorded because reading an existing migration still
requires the tooling:

```bash
dotnet ef migrations add <Name> \
  --project src/Collega.Infrastructure \
  --startup-project src/Collega.API \
  --output-dir Persistence/Migrations
```

`--output-dir` is **required**: `dotnet ef` otherwise writes to `src/Collega.Infrastructure/Migrations/`
while the real ones live in `Persistence/Migrations/`, reports success, and leaves you with two model
snapshots where the wrong one wins.

The EF packages are pinned to their net8.0-compatible majors — `Npgsql.EntityFrameworkCore.PostgreSQL`
on **8.0.x**, `Microsoft.EntityFrameworkCore.Design` on **8.0.10**. The majors `dotnet add package`
picks by default target net9/net10 and fail to restore against net8.0. A global `dotnet-ef` v10 works
against the pinned 8.0.x packages.

[`CollegaDbContextFactory.cs`](src/Collega.Infrastructure/Persistence/CollegaDbContextFactory.cs) is
tooling-only; runtime DI does not use it.

## Troubleshooting

**`Configuration keys 'SiteAdmin:Email' and 'SiteAdmin:Password' are required at startup`** — secrets
were never set, or set against the wrong project. Check with
`cd src/Collega.API && dotnet user-secrets list`.

**Npgsql multi-host errors after the Postgres migration** — a leftover SQL Server connection string
(`Server=localhost,1433`) in user-secrets. Replace it with the Npgsql one above.

**Confusing restore or build errors in the container** — host `obj/`/`bin/` directories visible
through the bind mount, built for a different OS or architecture. Run
`docker compose --profile full exec api dotnet clean`, or delete them on the host.

For PostgreSQL problems, see [`README.md`](README.md#troubleshooting) — the container is shared.

## What survives F6

`SPEC/`, the `tools/golden` corpus, the `e2e/` Playwright suite, and the database. Everything in
`src/` and `tests/` goes, in one commit.
