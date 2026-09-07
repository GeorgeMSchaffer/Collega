# Collega

Organization-scoped collaboration and idea-tracking tool. Organizations contain users, boards, statuses, and ideas; boards organize ideas by status using swimlanes.

**Stack:** TypeScript · Next.js · Nest.js · Prisma · PostgreSQL 16 · Tailwind v4 + shadcn/ui · Vitest + Playwright · pnpm + Turborepo

> **The .NET code in `src/` and `tests/` is frozen.** It is being replaced, not maintained, and its
> instructions no longer apply — do not build features, fix bugs, or write tests there
> ([`SPEC/decisions.md`](SPEC/decisions.md) 2026-09-06). It is deleted in slice F6.
>
> **`apps/*` and `packages/*` are the application.** `pnpm install && pnpm dev` serves the client on
> http://localhost:3000. It is mid-build: the design system and theme are in place (Wave E0), the
> feature screens arrive in E1–E6 and the API in Wave D — so for a *complete working product with
> real data*, the frozen .NET app is still the only thing that runs end to end, and the setup below
> is how you start it. Use it to see how a screen behaved and to re-record a golden fixture, not to
> extend.

> **Database engine: PostgreSQL 16** (Npgsql), local container `collega-postgres` on port 5432. The SQL Server → PostgreSQL cutover completed in Sprint 5 (merged `7c5a78b`, 2026-08-12) and every document is reconciled to it; the migration's scope and post-mortem are kept for reference in [`SPEC/50-postgres-migration.md`](SPEC/50-postgres-migration.md) and [`SPEC/sprints/archive/sprint-05-postgres-migration.md`](SPEC/sprints/archive/sprint-05-postgres-migration.md).

> **Implementation gate:** check [`SPEC/Bug Triage.md`](SPEC/Bug%20Triage.md) before starting feature work. Unresolved `TODO` items take priority unless the user explicitly approves an exception. See [`SPEC/implementation-agent-tracker.md`](SPEC/implementation-agent-tracker.md) for implementation status.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| .NET SDK **8.0.118** | Pinned in `global.json` (`rollForward: latestFeature`). Required to run the application. |
| Docker Desktop | Runs the local PostgreSQL 16 container. Also runs the API itself if you have no local .NET — see [No local .NET?](#no-local-net) |
| `dotnet-ef` (optional) | Only needed to author migrations: `dotnet tool install -g dotnet-ef`. See the version caveat under [Migrations](#migrations). |
| Node **≥ 24.20** + pnpm **≥ 12.3.4** (optional) | Only needed to work on the TypeScript conversion. `corepack enable && corepack prepare pnpm@12.3.4 --activate`. Not required to run or test the .NET app. |

---

## Setup

### 1. Create your local `.env`

`.env` is gitignored and supplies the PostgreSQL container's superuser password.

```bash
cp .env.example .env
```

Then edit `.env` and set a real password. PostgreSQL enforces no complexity rules of its own, so pick a strong one:

```dotenv
POSTGRES_PASSWORD=<your-password>
POSTGRES_USER=collega
POSTGRES_HOST_PORT=5432

SITE_ADMIN_EMAIL=admin@collega.local
SITE_ADMIN_PASSWORD=<your-password>

# Optional. Empty is a supported state, not a misconfiguration.
ANTHROPIC_API_KEY=
```

> `ANTHROPIC_API_KEY` powers AI-assisted idea drafting. Leaving it empty runs the feature **dark**: the brainstorm falls back to its scripted prompts and the API answers "unavailable" rather than erroring (`SPEC/20-feature-ai-idea-assist.md` rule 31). One deployment-level key is shared by every organization. The key has no `:` segment, so the configuration key and the environment-variable name are the same string.

> `POSTGRES_USER` is `collega`, not `postgres` — the container creates exactly one login role and names it `collega`, so local, in-cluster, and app connection strings all name the same role. It is still the container's superuser, just not called `postgres`. `psql -U postgres` will fail with `role "postgres" does not exist`.

> `SITE_ADMIN_*` in `.env` is consumed **only** by the `api` service in `docker-compose.yml` (`docker compose --profile full up -d api`, which needs no local .NET at all — see `src/Collega.Infrastructure/CLAUDE.md`). For local `dotnet run`, use user-secrets (next step).

### 2. Configure the API's secrets

The API **fails fast at startup** if `SiteAdmin:Email` or `SiteAdmin:Password` is missing (see [`Program.cs:26-36`](src/Collega.API/Program.cs#L26-L36), which delegates to [`StartupConfigurationValidator`](src/Collega.API/Startup/StartupConfigurationValidator.cs), and `SPEC/20-feature-auth.md` requirement #8). Store them in user-secrets so nothing secret is committed:

```bash
cd src/Collega.API
dotnet user-secrets init
dotnet user-secrets set "SiteAdmin:Email" "admin@collega.local"
dotnet user-secrets set "SiteAdmin:Password" "<your-password>"
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=Collega;Username=collega;Password=<your-password>"

# Optional — omit to run the AI assist feature dark.
dotnet user-secrets set "ANTHROPIC_API_KEY" "<key>"
```

The connection-string secret overrides the placeholder in `appsettings.Development.json`, which is committed and must never hold a real password.

`dotnet run` does **not** read `.env` — that file only reaches the API under `docker compose`. User-secrets (or a shell variable) is how a local `dotnet run` picks these up.

Environment variables work as an alternative (note the **double** underscore):

```bash
export SiteAdmin__Email='admin@collega.local'
export SiteAdmin__Password='<your-password>'
export ConnectionStrings__DefaultConnection='Host=localhost;Port=5432;Database=Collega;Username=collega;Password=<your-password>'
```

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

Wait for it to report healthy:

```bash
docker inspect -f '{{.State.Health.Status}}' collega-postgres
```

The healthcheck runs `pg_isready`, which confirms the server accepts connections but does **not** authenticate — a healthy container is not proof your password is right.

Data persists in the named volume `collega_postgres-data`.

### 4. Build and run

```bash
dotnet build Collega.sln
```

The application is **two processes**: the API and the Blazor client. The client is a WebAssembly SPA that calls the API over HTTP, so for a working UI you need both running at once, in two terminals:

```bash
# terminal 1 — API
dotnet run --project src/Collega.API/Collega.API.csproj

# terminal 2 — client
dotnet run --project src/Collega.Client/Collega.Client.csproj
```

Then open **http://localhost:5098** and sign in with any account from [`demo.md`](demo.md).

| Surface | URL |
|---|---|
| **Client (start here)** | http://localhost:5098 |
| API | http://localhost:5103 |
| Swagger UI (**Development only**) | http://localhost:5103/swagger |
| Health check | http://localhost:5103/api/v1/health |

On startup the API applies EF Core migrations, creates the `Collega` database, and runs idempotent seeding — so a fresh clone needs no manual `database update` and no manual user creation.

The client is a full application — sign-in, home, boards (list and swim lanes), the global `/ideas` list, the idea detail drawer, and the role-scoped `/settings` hub. See [`src/Collega.Client/CLAUDE.md`](src/Collega.Client/CLAUDE.md) for the locked design direction.

Use `dotnet watch` in place of `dotnet run` for hot reload on either process. Stop both before ending a session.

**Overriding a port** — `ASPNETCORE_URLS` alone is ignored, because `Properties/launchSettings.json` sets `applicationUrl`. Bypass the profile:

```bash
ASPNETCORE_URLS='http://localhost:5027' \
  dotnet run --project src/Collega.API/Collega.API.csproj --no-launch-profile
```

#### No local .NET?

`docker compose` runs the API on the SDK image — migrations and seeding included — against a bind mount of the repository:

```bash
docker compose --profile full up -d api    # http://localhost:5027
docker compose logs -f api
```

This covers the API only; the `web` service is still a placeholder, so the Blazor client has no container yet. Behind a TLS-inspecting proxy, drop your CA into `docker/proxy-ca/` before building — see [`src/Collega.Infrastructure/CLAUDE.md`](src/Collega.Infrastructure/CLAUDE.md).

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

**Demo data** — `Development` environment only. Two organizations, each with one Org Admin, two `User` and one Read Only account, all at password `Abc123!` with no forced change — one per role, so every permission perspective can be exercised. Each organization gets two boards, and each board 11 ideas distributed `3/2/2/1/3` across the canonical statuses.

| Organization | Email pattern |
|---|---|
| Acme Robotics | `{orgadmin,user,user2,readonly}@acme-robotics.demo.collega.test` |
| Blue Harbor Logistics | `{orgadmin,user,user2,readonly}@blue-harbor.demo.collega.test` |

The full roster — every address, display name and role — is [`demo.md`](demo.md).

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

Tests are hermetic: no network, no filesystem, no `DateTime.Now`, no randomness. EF Core tests use the InMemory provider, never a real database — so the PostgreSQL container is **not** required to run the suite.

Browser tests are separate and **do** need a running app plus a seeded database:

- `tests/Collega.E2E.Tests` — Playwright for .NET. Skipped by default, so `dotnet test Collega.sln` compiles it without needing a browser or server. See [`tests/Collega.E2E.Tests/CLAUDE.md`](tests/Collega.E2E.Tests/CLAUDE.md) for setup and the use-case catalog.

---

## TypeScript workspace (in progress)

Sprint 9 converts the whole application to TypeScript ([`SPEC/50-typescript-migration.md`](SPEC/50-typescript-migration.md)). This is the application; the .NET code is frozen.

**`apps/web` runs.** Wave E0 landed 2026-09-06: `pnpm dev` serves a real Next 16 app on
http://localhost:3000 carrying comp Q's theme. It has no feature screens yet (E1–E6) and no API to
call (`apps/api` is Wave D and still has no HTTP entry point), so for a complete working product
with real data the frozen .NET app above is still the only option.

```bash
corepack enable && corepack prepare pnpm@12.3.4 --activate
pnpm install

pnpm dev         # apps/web on http://localhost:3000
pnpm check       # lint + typecheck + test — the one command before pushing
pnpm build       # turbo run build
pnpm typecheck
pnpm test        # every package except the Playwright suite
pnpm test:e2e
```

Layer boundaries are enforced by `biome.json` overrides and asserted by `tools/boundaries`, so an illegal import fails lint rather than review.

The .NET application is kept bootable until slice **F6** for one reason only: the golden corpus in
`tools/golden` is the conversion's only oracle, and a fixture can only be re-recorded while the .NET
API still runs. That is not a licence to develop there — see
[`SPEC/decisions.md`](SPEC/decisions.md) 2026-09-06.

---

## Solution layout

```
src/                       FROZEN .NET application — replaced, not maintained; deleted in slice F6
  Collega.Domain           Entities, enums, value objects, invariants (depends on nothing)
  Collega.Application      Use-case orchestration, authorization, validation
  Collega.Infrastructure   EF Core persistence, seeding, external integrations
  Collega.API              HTTP host, controllers, request boundary
  Collega.Client           Blazor WebAssembly UI
tests/
  Collega.Domain.Tests  Collega.Application.Tests  Collega.Infrastructure.Tests  Collega.API.Tests
  Collega.E2E.Tests        Playwright-for-.NET browser suite; needs a running app, skipped by default

apps/                      The application (Sprint 9)
  api                      Nest.js host
  web                      Next.js client
packages/
  domain  application  infrastructure  design-system
e2e/                       Playwright suite for the TypeScript stack
tools/
  golden                   Capture/replay harness — the conversion's only oracle
  boundaries  arch         Architecture tests over the layer rules

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

- The EF packages are pinned to their net8.0-compatible majors — `Npgsql.EntityFrameworkCore.PostgreSQL` on **8.0.x**, `Microsoft.EntityFrameworkCore.Design` on **8.0.10**. The newer majors `dotnet add package` picks by default target net9/net10 only and fail to restore against net8.0. A global `dotnet-ef` v10 works fine against these pinned 8.0.x packages.
- [`CollegaDbContextFactory.cs`](src/Collega.Infrastructure/Persistence/CollegaDbContextFactory.cs) (`IDesignTimeDbContextFactory`) exists because `dotnet ef` could not reliably resolve the connection string through minimal-hosting auto-discovery. It is tooling-only; runtime DI is unaffected.

---

## Troubleshooting

**`Configuration keys 'SiteAdmin:Email' and 'SiteAdmin:Password' are required at startup`**
Step 2 was skipped, or you set them for the wrong project. Verify with `cd src/Collega.API && dotnet user-secrets list`.

**`password authentication failed for user "collega"` even though the password in `.env` is correct**
`POSTGRES_PASSWORD` is applied **only when the data directory is first initialized**. If the container was ever created with a different or empty password, the old credential persists in the volume. Reset it in place without losing data — the official image initializes `pg_hba.conf` with `local all all trust`, so this exec over the Unix socket needs no password:

```bash
docker exec -it collega-postgres \
  psql -U collega -d postgres -c "ALTER USER collega WITH PASSWORD '<your-password>';"
```

`-d postgres` is required: `psql` defaults to a database named after the user, and there is no `collega` database — the app's database is `Collega`.

To start over instead (**destroys all local data**): `docker compose down -v`.

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

