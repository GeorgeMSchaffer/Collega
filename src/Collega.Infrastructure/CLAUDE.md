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
  --startup-project src/Collega.API \
  --output-dir Persistence/Migrations
```

**`--output-dir` is required, not optional.** `dotnet ef` defaults to a `Migrations/` folder at the
project root, so omitting it silently writes the migration and the model snapshot to
`src/Collega.Infrastructure/Migrations/` while the real ones live in `Persistence/Migrations/`. The
command reports success either way, and the build still passes — you get two snapshots and the wrong
one wins.

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
docker compose --profile full up -d   # + the API (see "Running the API in a container")
docker compose down                   # stop; -v also deletes the volume and all data
docker inspect -f '{{.State.Health.Status}}' collega-postgres
```

`POSTGRES_HOST_PORT` (default `5432`) sets the host-side port mapping and `POSTGRES_USER` (default **`collega`**, per both `.env.example` and the `docker-compose.yml` fallback) the superuser. The name is deliberate — local, in-cluster (`SPEC/50-kubernetes-deployment.md`), and app connection strings all name the same role, so **there is no `postgres` role to connect as**; `psql -U postgres` fails with `role "postgres" does not exist`. Azure differs (`collegaadmin`) because its managed admin-user model dictates it. The healthcheck is `pg_isready`, which only proves the server is accepting connections — it does **not** authenticate, so a healthy container is not by itself evidence that your password is right.

### Running the API in a container

`api` is real as of 2026-09-03 (`src/Collega.API/Dockerfile.dev`) — for a machine with a broken, missing, or wrong-version .NET install. It runs `dotnet watch` on the SDK image against a bind mount of the **whole repository**, because the API's `.csproj` references Application and Infrastructure by relative path and a narrower mount cannot restore.

```bash
docker compose --profile full up -d api     # http://localhost:5027
docker compose logs -f api
```

Migrations and seeding still happen on startup, so this is a complete local API. The `web` service is still a placeholder: no `src/Collega.Client/Dockerfile.dev` exists yet.

**Behind a TLS-inspecting proxy** — a corporate one, or the agent proxy in a Claude Code remote session — `dotnet restore` fails inside the container with a certificate error even though it works on the host, because the host trusts the proxy's CA and a fresh container does not. Drop the CA in and rebuild:

```bash
cp /root/.ccr/ca-bundle.crt docker/proxy-ca/proxy.crt    # remote session
docker compose --profile full build api
```

`docker/proxy-ca/*.crt` is gitignored; with no certificate present the build is unaffected. The build also runs with `network: host` and inherits `HTTP_PROXY`/`HTTPS_PROXY`, which is what lets the restore reach nuget.org through a proxy bound to localhost.

**`password authentication failed for user "collega"` even with a correct `.env`** — `POSTGRES_PASSWORD` is applied only when the data directory is *first* initialized, so an old credential survives in an existing volume. Reset it in place without losing data; the official image initializes `pg_hba.conf` with `local all all trust`, so this exec over the Unix socket needs no password:

```bash
docker exec -it collega-postgres \
  psql -U collega -d postgres -c "ALTER USER collega WITH PASSWORD '<your-password>';"
```

`-d postgres` is not optional here: `psql` defaults to a database named after the connecting user, and no `collega` database exists — the app's is `Collega`. Omit it and you get `database "collega" does not exist`, which reads like a broken container rather than a missing flag.

To start over instead (**destroys all local data**): `docker compose down -v`.
