# Collega.Infrastructure

Persistence and external integrations. Implements the abstractions defined in Application; depends on Application and Domain. Nothing here should contain a business rule — if a decision needs a policy, it belongs upstream.

## Layout

| Folder | Holds |
|---|---|
| `Persistence/` | `CollegaDbContext`, entity `Configurations/`, `Migrations/`, `EfUnitOfWork`, `Repositories/` |
| `Security/` | `Pbkdf2PasswordHasher`, `JwtAccessTokenService`, `AccessTokenOptions` |
| `Auditing/` | `EfAuditEventWriter` |
| `Seeding/` | `StartupSeeder` |
| `DependencyInjection/` | `InfrastructureServiceCollectionExtensions.AddInfrastructure` — the single registration entry point |

## Data access

DbContext + LINQ; `async`/`await` for all database I/O; EF Core migrations for every schema change. One `IEntityTypeConfiguration` per entity in `Persistence/Configurations/` — keep mapping out of `OnModelCreating`.

Connection string key: `ConnectionStrings:DefaultConnection` (see [src/Collega.API/CLAUDE.md](../Collega.API/CLAUDE.md) for how to set it).

## Migrations

```bash
dotnet ef migrations add <Name> \
  --project src/Collega.Infrastructure \
  --startup-project src/Collega.API
```

Two caveats worth knowing before you touch packages or tooling:

- **`Microsoft.EntityFrameworkCore.SqlServer` / `.Design` are pinned to 8.0.10.** The 10.x version `dotnet add package` picks by default is net10-only and fails to restore against net8.0. A globally installed `dotnet-ef` v10 works fine against these pinned 8.0.10 packages.
- **[`CollegaDbContextFactory`](Persistence/CollegaDbContextFactory.cs) (`IDesignTimeDbContextFactory`) is tooling-only.** It exists because `dotnet ef` could not reliably resolve the connection string through minimal-hosting auto-discovery. Runtime DI does not use it.

The API applies migrations on startup, so a fresh clone needs no manual `database update`.

## Seeding

[`StartupSeeder`](Seeding/StartupSeeder.cs) runs on every boot and is idempotent.

1. **Site Admin** — always, from the configured `SiteAdmin:Email` / `SiteAdmin:Password`. Created with `MustChangePassword: true`, so first login returns `requiresPasswordChange: true`.
2. **Demo data** — `Development` only. Three organizations, each with an Org Admin, a User, and a Read Only account at password `Abc123!` with no forced change:

| Organization | Email pattern |
|---|---|
| Acme Robotics | `{orgadmin,user,readonly}@acme-robotics.demo.collega.test` |
| Blue Harbor Logistics | `{orgadmin,user,readonly}@blue-harbor.demo.collega.test` |
| Crestline Health Group | `{orgadmin,user,readonly}@crestline-health.demo.collega.test` |

Non-Development startup must never apply the demo seed — `SPEC/40-test-strategy.md` gates this.

## Local SQL Server (Docker)

`docker-compose.yml` at repo root runs SQL Server 2022 with persistent storage in the named volume `collega_sqlserver-data`. Copy `.env.example` to `.env` (gitignored) and set a real `MSSQL_SA_PASSWORD` first.

```bash
docker compose up -d sqlserver        # just SQL Server (also the default)
docker compose --profile full up -d   # + the api/web placeholder services
docker compose down                   # stop; -v also deletes the volume and all data
docker inspect -f '{{.State.Health.Status}}' collega-sqlserver
```

The `api` and `web` services are placeholders wired for `dotnet watch`, still referencing `Dockerfile.dev` paths that don't exist. They stay behind the `full` profile so they can't be started by accident. Add real `Dockerfile.dev` files to enable them.

**`Login failed for user 'sa'` even with a correct `.env`** — `MSSQL_SA_PASSWORD` is applied only when the volume is *first* initialized, so an old credential persists in an existing volume. Reset it in place without losing data:

```bash
docker stop collega-sqlserver
docker run --rm -v collega_sqlserver-data:/var/opt/mssql -u root \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<your-password>' \
  --entrypoint /opt/mssql/bin/mssql-conf \
  mcr.microsoft.com/mssql/server:2022-latest set-sa-password
docker compose up -d sqlserver
```

The healthcheck authenticates as `sa`, so the same bad credential also shows as `unhealthy` while the logs say the engine is ready. Same fix.
