# Collega

Organization-scoped collaboration and idea-tracking tool. Organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes.

**Stack:** .NET 8 · ASP.NET Core Web API · Blazor WebAssembly (Fluent UI Blazor) · EF Core · SQL Server 2022 · xUnit

> **Status:** implementation is in progress. Epic 1 (Foundation) and the Epic 2 Auth slice are merged; org/user administration, boards, statuses, and ideas are not built yet. `src/Collega.Client` is still the stock Blazor template. See `SPEC/implementation-agent-tracker.md` for the live picture.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| .NET SDK **8.0.204** | Pinned in `global.json` (`rollForward: latestFeature`). |
| Docker Desktop | Runs the local SQL Server 2022 container. |
| `dotnet-ef` (optional) | Only needed to author migrations: `dotnet tool install -g dotnet-ef`. See the version caveat under [Migrations](#migrations). |

---

## Setup

### 1. Create your local `.env`

`.env` is gitignored and supplies the SQL Server container's `sa` password.

```bash
cp .env.example .env
```

Then edit `.env` and set a real password. It must satisfy SQL Server complexity rules (8+ characters, with uppercase, lowercase, digit, and symbol):

```dotenv
MSSQL_SA_PASSWORD=<your-password>
MSSQL_HOST_PORT=1433

SITE_ADMIN_EMAIL=admin@collega.local
SITE_ADMIN_PASSWORD=<your-password>
```

> `SITE_ADMIN_*` in `.env` is consumed **only** by the `api` service in `docker-compose.yml`, which is still a placeholder. For local `dotnet run`, use user-secrets (next step).

### 2. Configure the API's secrets

The API **fails fast at startup** if `SiteAdmin:Email` or `SiteAdmin:Password` is missing (see [`Program.cs:18-26`](src/Collega.API/Program.cs#L18-L26) and `SPEC/20-feature-auth.md` requirement #8). Store them in user-secrets so nothing secret is committed:

```bash
cd src/Collega.API
dotnet user-secrets init
dotnet user-secrets set "SiteAdmin:Email" "admin@collega.local"
dotnet user-secrets set "SiteAdmin:Password" "<your-password>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" \
  "Server=localhost,1433;Database=Collega;User Id=sa;Password=<your-password>;TrustServerCertificate=True;"
```

The connection-string secret overrides the placeholder in `appsettings.Development.json`, which is committed and must never hold a real password.

Environment variables work as an alternative (note the **double** underscore):

```bash
export SiteAdmin__Email='admin@collega.local'
export SiteAdmin__Password='<your-password>'
export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=Collega;User Id=sa;Password=<your-password>;TrustServerCertificate=True;'
```

### 3. Start SQL Server

```bash
docker compose up -d sqlserver
```

Wait for it to report healthy:

```bash
docker inspect -f '{{.State.Health.Status}}' collega-sqlserver
```

Data persists in the named volume `collega_sqlserver-data`.

### 4. Build and run

```bash
dotnet build Collega.sln
dotnet run --project src/Collega.API/Collega.API.csproj
```

On startup the API applies EF Core migrations, creates the `Collega` database, and runs idempotent seeding.

| Surface | URL |
|---|---|
| API | http://localhost:5103 |
| Swagger UI | http://localhost:5103/swagger |
| Health check | http://localhost:5103/api/v1/health |

To override the port, bypass the launch profile — `ASPNETCORE_URLS` alone is ignored because `Properties/launchSettings.json` sets `applicationUrl`:

```bash
ASPNETCORE_URLS='http://localhost:5027' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile
```

Run the Blazor client (currently the stock template) separately:

```bash
dotnet run --project src/Collega.Client/Collega.Client.csproj   # http://localhost:5098
```

---

## Seeded accounts

Seeding is idempotent and runs on every startup ([`StartupSeeder.cs`](src/Collega.Infrastructure/Seeding/StartupSeeder.cs)).

**Site Admin** — always seeded, from your configured credentials. Created with `mustChangePassword: true`, so the first login returns `requiresPasswordChange: true` and you must call `POST /api/v1/auth/change-password` before doing anything else.

**Demo data** — `Development` environment only. Three organizations, each with an Org Admin, a User, and a Read Only account, all at password `Abc123!` with no forced change:

| Organization | Email pattern |
|---|---|
| Acme Robotics | `{orgadmin,user,readonly}@acme-robotics.demo.collega.test` |
| Blue Harbor Logistics | `{orgadmin,user,readonly}@blue-harbor.demo.collega.test` |
| Crestline Health Group | `{orgadmin,user,readonly}@crestline-health.demo.collega.test` |

Smoke-test a login:

```bash
curl -s -X POST http://localhost:5103/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"orgadmin@acme-robotics.demo.collega.test","password":"Abc123!"}'
```

---

## Testing

```bash
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj   # single project
```

Tests are hermetic: no network, no filesystem, no `DateTime.Now`, no randomness. EF Core tests use the InMemory provider, never a real database — so the SQL Server container is **not** required to run the suite.

---

## Solution layout

```
src/
  Collega.Domain           Entities, enums, value objects, invariants (depends on nothing)
  Collega.Application      Use-case orchestration, authorization, validation
  Collega.Infrastructure   EF Core persistence, seeding, external integrations
  Collega.API              HTTP host, controllers, request boundary
  Collega.Client           Blazor WebAssembly UI
tests/
  Collega.Domain.Tests  Collega.Application.Tests  Collega.Infrastructure.Tests  Collega.API.Tests
SPEC/                      Canonical specs — the source of truth
SPEC/mockups/              UI comps (HTML/SVG)
```

Dependencies flow inward. Business rules live in Domain and Application — never in controllers or Blazor components. See `SPEC/00-project-brief.md` for the full architecture rules.

`FluentUiComps/` is an unrelated spike, not part of Collega.

---

## Migrations

```bash
dotnet ef migrations add <Name> \
  --project src/Collega.Infrastructure \
  --startup-project src/Collega.API
```

Two environment caveats worth knowing:

- `Microsoft.EntityFrameworkCore.SqlServer` / `.Design` are pinned to **8.0.10**. The 10.x default from `dotnet add package` is net10-only and fails to restore against net8.0. A global `dotnet-ef` v10 works fine against these pinned 8.0.10 packages.
- [`CollegaDbContextFactory.cs`](src/Collega.Infrastructure/Persistence/CollegaDbContextFactory.cs) (`IDesignTimeDbContextFactory`) exists because `dotnet ef` could not reliably resolve the connection string through minimal-hosting auto-discovery. It is tooling-only; runtime DI is unaffected.

---

## Troubleshooting

**`Configuration keys 'SiteAdmin:Email' and 'SiteAdmin:Password' are required at startup`**
Step 2 was skipped, or you set them for the wrong project. Verify with `cd src/Collega.API && dotnet user-secrets list`.

**`Login failed for user 'sa'` even though the password in `.env` is correct**
`MSSQL_SA_PASSWORD` is applied **only when the volume is first initialized**. If the container was ever created with a different or empty password, the old credential persists in the volume. Reset it in place without losing data:

```bash
docker stop collega-sqlserver
docker run --rm -v collega_sqlserver-data:/var/opt/mssql -u root \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='<your-password>' \
  --entrypoint /opt/mssql/bin/mssql-conf \
  mcr.microsoft.com/mssql/server:2022-latest set-sa-password
docker compose up -d sqlserver
```

To start over instead (**destroys all local data**): `docker compose down -v`.

**Container reports `unhealthy` while the logs say "SQL Server is now ready for client connections"**
The healthcheck authenticates as `sa`, so a bad `sa` credential shows up as `unhealthy` even though the engine is running. Same fix as above.

**Port already in use** — see the `--no-launch-profile` override under [Build and run](#4-build-and-run).

---

## Contributing

- `SPEC/*.md` is the source of truth. If behavior changes, update the canonical spec first, then tests, then implementation.
- Ask before implementing anything ambiguous or where specs conflict.
- Feature branches: `feature/<NNN>-<short-description>`, merged into `dev`.
- Do not add NuGet packages without approval. Never commit secrets.

See [`CLAUDE.md`](CLAUDE.md) for the full working rules, coding standards, and the multi-agent worktree workflow.

## License

See [LICENSE](LICENSE).
