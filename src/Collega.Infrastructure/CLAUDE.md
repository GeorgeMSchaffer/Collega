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

- **The EF packages are pinned to their net8.0-compatible majors** — `Npgsql.EntityFrameworkCore.PostgreSQL` on **8.0.x** and `Microsoft.EntityFrameworkCore.Design` on **8.0.10**. The newer majors `dotnet add package` picks by default target net9/net10 only and fail to restore against net8.0. A globally installed `dotnet-ef` v10 works fine against these pinned 8.0.x packages.
- **[`CollegaDbContextFactory`](Persistence/CollegaDbContextFactory.cs) (`IDesignTimeDbContextFactory`) is tooling-only.** It exists because `dotnet ef` could not reliably resolve the connection string through minimal-hosting auto-discovery. Runtime DI does not use it.

The API applies migrations on startup, so a fresh clone needs no manual `database update`.

## Seeding

[`StartupSeeder`](Seeding/StartupSeeder.cs) runs on every boot and is idempotent.

1. **Site Admin** — always, from the configured `SiteAdmin:Email` / `SiteAdmin:Password`. Created with `MustChangePassword: true`, so first login returns `requiresPasswordChange: true`. Seeding matches the configured account by normalized email (not "any Site Admin"), so a manually promoted Site Admin is never disturbed. The `resetSiteAdmin` path (dev/ops only, triggered by `--seed:auth=reset` — see [src/Collega.API/CLAUDE.md](../Collega.API/CLAUDE.md)) hard-deletes that configured account and recreates it, so the recreated Site Admin again has `MustChangePassword: true`. The delete is FK-safe: `AuditEvent`/`NotificationEvent.ActorUserId` are plain `Guid` columns with no navigation, and the Site Admin owns no org membership or authored org content.
2. **Demo data** — `Development` only. Two organizations, each with one Org Admin and two User accounts at password `Abc123!` with no forced change. Each organization has two boards, and every board has 11 deterministic ideas distributed `3/2/2/1/3` in canonical status order. The global Site Admin remains outside every organization. The demo seed also creates a **convenience Site Admin** `siteadmin@demo.collega.test` / `Abc123!` (no forced change, distinct from the configured account) so the platform-admin perspective is testable without the configured Site Admin secret — Development-only, idempotent.

| Organization | Email pattern |
|---|---|
| Acme Robotics | `{orgadmin,user,user2}@acme-robotics.demo.collega.test` |
| Blue Harbor Logistics | `{orgadmin,user,user2}@blue-harbor.demo.collega.test` |

Non-Development startup must never apply the demo seed — `SPEC/40-test-strategy.md` gates this.

## Local PostgreSQL (Docker)

`docker-compose.yml` at repo root runs `postgres:16` as the `postgres` service (container `collega-postgres`) with persistent storage in the named volume `collega_postgres-data`. Copy `.env.example` to `.env` (gitignored) and set a real `POSTGRES_PASSWORD` first.

```bash
docker compose up -d postgres         # just PostgreSQL (also the default)
docker compose --profile full up -d   # + the api/web placeholder services
docker compose down                   # stop; -v also deletes the volume and all data
docker inspect -f '{{.State.Health.Status}}' collega-postgres
```

`POSTGRES_HOST_PORT` (default `5432`) sets the host-side port mapping and `POSTGRES_USER` (default `postgres`) the superuser. The healthcheck is `pg_isready`, which only proves the server is accepting connections — it does **not** authenticate, so a healthy container is not by itself evidence that your password is right.

The `api` and `web` services are placeholders wired for `dotnet watch`, still referencing `Dockerfile.dev` paths that don't exist. They stay behind the `full` profile so they can't be started by accident. Add real `Dockerfile.dev` files to enable them.

**`password authentication failed for user "postgres"` even with a correct `.env`** — `POSTGRES_PASSWORD` is applied only when the data directory is *first* initialized, so an old credential survives in an existing volume. Reset it in place without losing data; the official image initializes `pg_hba.conf` with `local all all trust`, so this exec over the Unix socket needs no password:

```bash
docker exec -it collega-postgres \
  psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<your-password>';"
```

To start over instead (**destroys all local data**): `docker compose down -v`.
