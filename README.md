# Collega

Organization-scoped collaboration and idea-tracking tool. Organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes.

**Stack:** .NET 8 · ASP.NET Core Web API · Blazor WebAssembly (Fluent UI Blazor) · EF Core · SQL Server 2022 · xUnit

> **Implementation gate:** check [`SPEC/Bug Triage.md`](SPEC/Bug%20Triage.md) before starting feature work. Unresolved `TODO` items take priority unless the user explicitly approves an exception. See [`SPEC/implementation-agent-tracker.md`](SPEC/implementation-agent-tracker.md) for implementation status.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| .NET SDK **8.0.118** | Pinned in `global.json` (`rollForward: latestFeature`). |
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

The API **fails fast at startup** if `SiteAdmin:Email` or `SiteAdmin:Password` is missing (see [`Program.cs:26-36`](src/Collega.API/Program.cs#L26-L36), which delegates to [`StartupConfigurationValidator`](src/Collega.API/Startup/StartupConfigurationValidator.cs), and `SPEC/20-feature-auth.md` requirement #8). Store them in user-secrets so nothing secret is committed:

```bash
cd src/Collega.API
dotnet user-secrets init
dotnet user-secrets set "SiteAdmin:Email" "admin@collega.local"
dotnet user-secrets set "SiteAdmin:Password" "<your-password>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=localhost,1433;Database=Collega;User Id=sa;Password=<your-password>;TrustServerCertificate=True;"
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
| Swagger UI (**Development only**) | http://localhost:5103/swagger |
| Health check | http://localhost:5103/api/v1/health |

To override the port, bypass the launch profile — `ASPNETCORE_URLS` alone is ignored because `Properties/launchSettings.json` sets `applicationUrl`:

```bash
ASPNETCORE_URLS='http://localhost:5027' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile
```

Run the Blazor client separately:

```bash
dotnet run --project src/Collega.Client/Collega.Client.csproj   # http://localhost:5098
```

The client is a full application — sign-in, home, boards (list and swim lanes), the global `/ideas` list, the idea detail drawer, and the role-scoped `/settings` hub. See [`src/Collega.Client/CLAUDE.md`](src/Collega.Client/CLAUDE.md) for the locked design direction.

---

## Seeded accounts

Seeding is idempotent and runs on every startup ([`StartupSeeder.cs`](src/Collega.Infrastructure/Seeding/StartupSeeder.cs)).

**Site Admin** — always seeded, from your configured credentials. Created with `mustChangePassword: true`, so the first login returns `requiresPasswordChange: true` and you must call `POST /api/v1/auth/change-password` before doing anything else.

**Manually triggering seeds** — by default the Site Admin is always seeded and demo data only under `Development`. Optional flags override that with explicit control (only the seeds you name run, in any environment):

```bash
dotnet watch --project ./src/Collega.API -- --seed:auth --seed:demo
```

`--seed:auth` seeds the Site Admin; `--seed:demo` seeds the demo orgs.

**Forgot the Site Admin password?** `--seed:auth=reset` drops the account matching the configured `SiteAdmin:Email` and recreates it from `SiteAdmin:Email` / `SiteAdmin:Password` with `MustChangePassword: true`. It targets only that configured account, so a manually promoted Site Admin on a different email is left alone, and it does not seed demo data:

```bash
dotnet run --project ./src/Collega.API -- --seed:auth=reset
```

See [`src/Collega.API/CLAUDE.md`](src/Collega.API/CLAUDE.md#seeding-flags) for the full flag semantics.

**Demo data** — `Development` environment only. Two organizations, each with one Org Admin and two `User` accounts, all at password `Abc123!` with no forced change. Each organization gets two boards, and each board 11 ideas distributed `3/2/2/1/3` across the canonical statuses. **No Read Only account is seeded.**

| Organization | Email pattern |
|---|---|
| Acme Robotics | `{orgadmin,user,user2}@acme-robotics.demo.collega.test` |
| Blue Harbor Logistics | `{orgadmin,user,user2}@blue-harbor.demo.collega.test` |

The demo seed also creates a convenience **Site Admin** — `siteadmin@demo.collega.test` / `Abc123!`, no forced password change — distinct from the configured account, so the platform-admin perspective is testable without your `SiteAdmin:Password` secret. Development-only and idempotent. The configured Site Admin stays outside every organization.

Smoke-test a login:

```bash
curl -s -X POST http://localhost:5103/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"orgadmin@acme-robotics.demo.collega.test","password":"Abc123!"}'
```

---

## Settings administration

`/settings` is a role-scoped hub. Admin entities use a **List + Drawer** pattern — the list stays in place and the record opens in a right slide-in drawer.

| Role | Routes |
|---|---|
| **Site Admin** | `/settings/organizations` → a record opens at `/settings/organizations/{id}`. Organization-scoped Users, Statuses, Idea Types, Custom Fields, and Boards hang off that org: `/settings/organizations/{id}/users`, `/statuses`, `/idea-types`, `/fields`, `/boards` (plus `/users/import`). |
| **Org Admin** | Their own organization, flat: `/settings/users`, `/settings/statuses`, `/settings/idea-types`, `/settings/fields`, `/settings/boards`, and `/settings/users/import`. |
| **Any signed-in user** | `/settings/profile`. |

Canonical role visibility and route behavior are defined in [`SPEC/20-feature-client-ui.md`](SPEC/20-feature-client-ui.md).

> **Planned change (Sprint 6):** Site Admins are moving to a **View As** act-as model for organization *content* — no direct org-scoped create/edit paths and no org dropdowns. Organization and user administration stay direct as the bootstrap exception. See `SPEC/20-feature-client-ui.md` → "Site Admin org-content mutation model".

---

## Testing

```bash
dotnet test Collega.sln
dotnet test tests/Collega.Application.Tests/Collega.Application.Tests.csproj   # single project
```

Tests are hermetic: no network, no filesystem, no `DateTime.Now`, no randomness. EF Core tests use the InMemory provider, never a real database — so the SQL Server container is **not** required to run the suite.

Browser tests are separate and **do** need a running app plus a seeded database:

- `tests/Collega.E2E.Tests` — Playwright for .NET. Skipped by default, so `dotnet test Collega.sln` compiles it without needing a browser or server. See [`tests/Collega.E2E.Tests/CLAUDE.md`](tests/Collega.E2E.Tests/CLAUDE.md) for setup and the use-case catalog.
- `e2e/` — TypeScript Playwright suite, run with its own tooling. See [`e2e/README.md`](e2e/README.md).

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
  Collega.E2E.Tests        Playwright-for-.NET browser suite; needs a running app, skipped by default
e2e/                       TypeScript Playwright browser suite (see e2e/README.md)
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

