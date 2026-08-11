# Scope: Migrate Database Technology — MS SQL Server → PostgreSQL

## Status — APPROVED DIRECTION (not yet implemented)

**Decided (2026-08-11): Collega's application database moves from SQL Server 2022 to PostgreSQL.** This document is the implementation scope for that decision. The work itself has not landed yet — no code has changed — but the direction is committed, not speculative. The canonical stack in `SPEC/00-project-brief.md` and the other SQL-Server-referencing specs listed under [Documentation fan-out](#8-documentation-fan-out) should be reconciled to PostgreSQL as the migration is implemented and merged.

**Decisions locked (2026-08-11 user interview):**
1. Deliverable = this SPEC doc (implementation is a separate approved step).
2. Migration-file strategy = **regenerate fresh** (no prod data to preserve).
3. `DateTime` handling = **audit for UTC correctness** (not the legacy timestamp switch).
4. NuGet packages **approved** — `Npgsql.EntityFrameworkCore.PostgreSQL` and a Testcontainers/Postgres test package (for §5). No further approval gate on those.
5. `SPEC/50-azure-deployment.md` has been **updated** to target Azure Database for PostgreSQL (Flexible Server, Burstable B1ms) in place of Azure SQL.

## Verdict

**Small-to-moderate, low-risk migration — ~2–4 agent-days.** The provider is cleanly isolated behind EF Core, there is no production data (only the disposable demo seed), primary keys are `Guid` (no int-identity sequences to port), and case-insensitive uniqueness is already handled in application code (`EmailNormalizer` → `NormalizedEmail`, `Tag.NormalizedName`) rather than relying on SQL Server's default collation. The only area needing real care is `DateTime` → `timestamptz`.

## Coupling surface (complete inventory)

Every place the SQL Server provider is wired in, as of the commit that scoped this:

| # | Location | Change |
|---|---|---|
| 1 | `src/Collega.Infrastructure/Collega.Infrastructure.csproj:13` — `Microsoft.EntityFrameworkCore.SqlServer` 8.0.10 | Replace with `Npgsql.EntityFrameworkCore.PostgreSQL` 8.0.x (approved). |
| 2 | `Persistence/DependencyInjection/InfrastructureServiceCollectionExtensions.cs:23` and `Persistence/CollegaDbContextFactory.cs:26` — two `UseSqlServer(...)` calls | → `UseNpgsql(...)` |
| 3 | `Persistence/Configurations/IdeaConfiguration.cs:58` `HasColumnType("date")`; `UserConfiguration.cs:44` and `AuditEventConfiguration.cs:44` `HasColumnType("nvarchar(max)")` | `date` is valid on Npgsql — keep. Drop the two `nvarchar(max)` annotations; unbounded string maps to `text` by default. |
| 4 | 10 migrations + `CollegaDbContextModelSnapshot.cs` in `Persistence/Migrations/` — SQL-Server-flavored throughout (258 `datetime2`, 28 `nvarchar(max)`, `UseIdentityColumns`, `filter: "[is_deleted] = 0"`) | **Regenerate fresh** (see §3). |
| 5 | Connection strings: `src/Collega.API/appsettings.Development.json:9` (localdb); `CollegaDbContextFactory.cs:17` hardcoded default; `docker-compose.yml` `sqlserver` service + `api` service `ConnectionStrings__DefaultConnection`; `.env` / `.env.example` `MSSQL_SA_PASSWORD` | Rewrite to Npgsql format; swap the compose image to `postgres:16`; rename the password env var. |
| 6 | `src/Collega.API/Startup/StartupConfigurationValidator.cs:16` — description "the SQL Server connection string" | Cosmetic text update. |
| 7 | `src/Collega.API/Program.cs:128-134` — `MigrateAsync` on relational hosts, `EnsureCreatedAsync` for InMemory test hosts | No code change; requires valid PG migrations to exist (§3). |

## The one real risk: `DateTime` → `timestamptz`

The domain uses **68 `DateTime` properties / 258 `datetime2` columns** and **zero `DateTimeOffset`**. Npgsql (EF Core 6+) maps `DateTime` to `timestamp with time zone` and **throws at write time if `DateTime.Kind != Utc`**. Per the locked decision, the mitigation is a **UTC-correctness audit**, not the legacy switch:

- Confirm every persisted `DateTime` is produced with `DateTime.UtcNow` (or otherwise carries `Kind = Utc`) across Domain, Application, and the `StartupSeeder`.
- Any value read from an external boundary (request DTO, seed constant) that lands in a persisted column must be normalized to UTC before save.
- Add a focused test that round-trips an entity with a timestamp through the real Postgres provider and asserts no `Kind`/`timestamptz` exception (see §5).

The codebase appears UTC-consistent, but this must be **verified, not assumed** — it is the single most likely source of runtime surprises.

## Non-issues (explicitly out of scope — do not spend effort here)

- **`Guid` keys** map cleanly to `uuid`; no identity-sequence porting.
- **No raw SQL, no `rowversion`/concurrency tokens, no `varbinary`** — the org logo thumbnail is base64 `text` (`Organization.LogoThumbnailUrl`, max 300 000 chars), not binary.
- **All LINQ is provider-agnostic** (`.Contains` / `.StartsWith` over strings and in-memory collections); nothing SQL-Server-specific to translate.
- **Case-insensitivity is handled in code** — email uniqueness/login and tag uniqueness use pre-normalized lowercase columns, so Postgres's case-sensitive default is a non-factor.
- **The one filtered index** (`filter: "[is_deleted] = 0"`, `AddUserDefinedFields` migration) becomes a correct Postgres partial index automatically when migrations are regenerated.

## Known coverage gap

The 500-test suite runs on the **EF InMemory provider**, so it does **not** exercise real PostgreSQL SQL translation — the same limitation Sprint 3 documented for SQL Server. Green-on-InMemory does not prove the migration. This is why §5 adds a Postgres-backed smoke test.

## Task breakdown & effort

Effort in agent-days (1 agent-day = one focused session from partial to build-clean/tested/spec-aligned), consistent with `SPEC/85-implementation-timeline.md`.

1. **Provider swap** (~0.25 d) — package reference (approved), both `UseNpgsql` calls, remove the two `nvarchar(max)` annotations.
2. **Regenerate migrations** (~0.5 d) — delete the 10 migrations + snapshot; `dotnet ef migrations add InitialCreate` against Npgsql; verify the generated DDL (partial index, `uuid`, `timestamptz`, `text`).
3. **Regenerate fresh (chosen strategy)** — history is discarded intentionally; there is no production database, so a single clean `InitialCreate` is correct. (Alternative hand-port of all 10 migrations was rejected: slower, error-prone, no benefit without prod data.)
4. **Connection-string / infra rewrite** (~0.5 d) — `appsettings.Development.json`, `CollegaDbContextFactory` default, `docker-compose.yml` (`postgres:16` image, volume, healthcheck), `.env`/`.env.example`, `StartupConfigurationValidator` text.
5. **UTC-correctness audit + Postgres smoke test** (~1 d) — audit all persisted `DateTime` writes for `Kind = Utc`; add a Postgres-backed integration/smoke test (Testcontainers or local compose DB) covering migrate-up + a timestamped round-trip + email-uniqueness (Testcontainers package approved).
6. **Full-suite + live verification** (~0.5 d) — `dotnet test Collega.sln` green; run the API against a real Postgres container; confirm `MigrateAsync` + `StartupSeeder` succeed end-to-end.
7. **Documentation fan-out** (~0.5 d) — see below.

**Total: ~2.75–3.5 agent-days** plus review, assuming the two package approvals land.

## Documentation fan-out

`SPEC/50-azure-deployment.md` is **already updated** (targets Azure Database for PostgreSQL — Flexible Server, Burstable B1ms). Still to reconcile when this migration merges: `SPEC/00-project-brief.md`, `CLAUDE.md` (stack table + Local SQL Server section + docker-compose notes), `SPEC/50-technical-implementation-plan.md`, `SPEC/50-kubernetes-deployment.md`, `SPEC/85-implementation-timeline.md`, `SPEC/20-feature-issues-and-delivery.md`, and `SPEC/50-azure-api-cicd.md` (check its build/deploy steps for any SQL-specific assumptions).

## Open items requiring a human decision before implementation

- ~~**NuGet approvals**~~ — approved 2026-08-11 (`Npgsql.EntityFrameworkCore.PostgreSQL` + Testcontainers/Postgres test package).
- **Target Postgres version & host:** local `postgres:16` in compose is assumed and the Azure guide now targets **Azure Database for PostgreSQL Flexible Server (Burstable B1ms)**; confirm this over a self-hosted/K8s host (`SPEC/50-kubernetes-deployment.md` still describes SQL Server and is not yet reconciled).
- ~~**Timing vs. Sprint 4**~~ — scheduled 2026-08-11 as **Sprint 5**, immediately after Sprint 4, in `SPEC/95-next-sprints.md` (`SPEC/sprints/sprint-05-postgres-migration.md`). Runs last so the engine swap starts from Sprint 4's reviewed, stable code.
