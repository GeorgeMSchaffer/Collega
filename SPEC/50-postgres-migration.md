# Scope: Migrate Database Technology — MS SQL Server → PostgreSQL

## Status — COMPLETE, MERGED TO `dev` (2026-08-12, `7c5a78b`)

**Decided (2026-08-11): Collega's application database moves from SQL Server 2022 to PostgreSQL.** This document was the implementation scope for that decision; the work is done.

`dev` now runs `Npgsql.EntityFrameworkCore.PostgreSQL` 8.0.10 against a single `20260812195251_InitialCreate` migration, with `docker-compose.yml` on `postgres:16`. No `UseSqlServer` call or SQL Server package reference remains anywhere in `src/`. Verified at merge: 579 tests passing, and a live boot against a real `postgres:16` container applying the migration and completing `StartupSeeder` with no `timestamptz`/`Kind` exception.

Read this file now for **why the migration went the way it did** — particularly the corrections below, which record four claims this document originally made that turned out to be wrong. For current state, read `SPEC/implementation-agent-tracker.md`.

**Decisions locked (2026-08-11 user interview):**
1. Deliverable = this SPEC doc (implementation is a separate approved step).
2. Migration-file strategy = **regenerate fresh** (no prod data to preserve).
3. `DateTime` handling = **audit for UTC correctness** (not the legacy timestamp switch).
4. NuGet packages **approved** — `Npgsql.EntityFrameworkCore.PostgreSQL` and a Testcontainers/Postgres test package (for §5). No further approval gate on those.
5. `SPEC/50-azure-deployment.md` has been **updated** to target Azure Database for PostgreSQL (Flexible Server, Burstable B1ms) in place of Azure SQL.

## Verdict

**Small-to-moderate migration — ~2–4 agent-days.** The provider is cleanly isolated behind EF Core, there is no production data (only the disposable demo seed), and primary keys are `Guid` (no int-identity sequences to port).

**Revised risk assessment (2026-08-12, after implementing).** This verdict originally called the migration "low-risk" and named `DateTime` → `timestamptz` as "the only area needing real care". The UTC audit in fact came back completely clean — every persisted `DateTime` already flowed from `IClock.UtcNow`. The real defects were elsewhere and were **all silent**: a hardcoded SQL-Server filter string in the model, and three case-sensitivity regressions from losing `CI_AS` collation (one of which broke self-registration outright). See the corrections below. The lasting lesson is that **the risk was not where the type mapping was, it was wherever behaviour had been quietly depending on SQL Server semantics** — and none of it was visible to a test suite running on EF InMemory.

## Coupling surface (complete inventory)

Every place the SQL Server provider is wired in, as of the commit that scoped this:

| # | Location | Change |
|---|---|---|
| 1 | `src/Collega.Infrastructure/Collega.Infrastructure.csproj:13` — `Microsoft.EntityFrameworkCore.SqlServer` 8.0.10 | Replace with `Npgsql.EntityFrameworkCore.PostgreSQL` 8.0.x (approved). |
| 2 | `Persistence/DependencyInjection/InfrastructureServiceCollectionExtensions.cs:23` and `Persistence/CollegaDbContextFactory.cs:26` — two `UseSqlServer(...)` calls | → `UseNpgsql(...)` |
| 3 | `Persistence/Configurations/IdeaConfiguration.cs:58` `HasColumnType("date")`; `UserConfiguration.cs:44` (`PasswordHash`) and `AuditEventConfiguration.cs:44` `HasColumnType("nvarchar(max)")`; `UserConfiguration.cs:83` (`PortraitPng`) `HasColumnType("varbinary(max)")` | `date` is valid on Npgsql — keep. Drop the two `nvarchar(max)` annotations (unbounded string maps to `text`) **and the `varbinary(max)` one** (`byte[]` maps to `bytea`). |
| 4 | 11 migrations + `CollegaDbContextModelSnapshot.cs` in `Persistence/Migrations/` — SQL-Server-flavored throughout (287 `datetime2`, 31 `nvarchar(max)`, `UseIdentityColumns`, `filter: "[is_deleted] = 0"`) | **Regenerate fresh** (see §3). Counts refreshed 2026-08-12 after the portrait migration landed. |
| 5 | Connection strings: `src/Collega.API/appsettings.Development.json:9` (localdb); `CollegaDbContextFactory.cs:17` hardcoded default; `docker-compose.yml` `sqlserver` service + `api` service `ConnectionStrings__DefaultConnection`; `.env` / `.env.example` `MSSQL_SA_PASSWORD` | Rewrite to Npgsql format; swap the compose image to `postgres:16`; rename the password env var. |
| 6 | `src/Collega.API/Startup/StartupConfigurationValidator.cs:16` — description "the SQL Server connection string" | Cosmetic text update. |
| 7 | `src/Collega.API/Program.cs:128-134` — `MigrateAsync` on relational hosts, `EnsureCreatedAsync` for InMemory test hosts | No code change; requires valid PG migrations to exist (§3). |

## The one real risk: `DateTime` → `timestamptz`

The domain uses **68 `DateTime` properties / 287 `datetime2` columns** and **zero `DateTimeOffset`**. Npgsql (EF Core 6+) maps `DateTime` to `timestamp with time zone` and **throws at write time if `DateTime.Kind != Utc`**. Per the locked decision, the mitigation is a **UTC-correctness audit**, not the legacy switch:

- Confirm every persisted `DateTime` is produced with `DateTime.UtcNow` (or otherwise carries `Kind = Utc`) across Domain, Application, and the `StartupSeeder`.
- Any value read from an external boundary (request DTO, seed constant) that lands in a persisted column must be normalized to UTC before save.
- Add a focused test that round-trips an entity with a timestamp through the real Postgres provider and asserts no `Kind`/`timestamptz` exception (see §5).

The codebase appears UTC-consistent, but this must be **verified, not assumed** — it is the single most likely source of runtime surprises.

## Non-issues (explicitly out of scope — do not spend effort here)

- **`Guid` keys** map cleanly to `uuid`; no identity-sequence porting.
- **No raw SQL and no `rowversion`/concurrency tokens.** The org logo thumbnail is base64 `text` (`Organization.LogoThumbnailUrl`, max 300 000 chars), not binary.

> **Correction (2026-08-12):** this section previously also claimed "no `varbinary`". That stopped being true when the profile-portrait slice merged `User.PortraitPng` as `HasColumnType("varbinary(max)")` (`UserConfiguration.cs:83`). It is **not** a non-issue — `varbinary(max)` is SQL-Server-only and must be dropped so EF maps `byte[]` to `bytea`. Tracked in the coupling surface, row 3.
- **All LINQ is provider-agnostic** (`.Contains` / `.StartsWith` over strings and in-memory collections); nothing SQL-Server-specific to translate.
- **Case-insensitivity is handled in code — *only for email and tags*.** Those use pre-normalized lowercase columns (`EmailNormalizer` → `NormalizedEmail`, `Tag.NormalizedName`), so they are genuinely unaffected.

> **Correction (2026-08-12) — the "non-factor" claim was too broad and hid three real regressions.** Everything *not* using a pre-normalized column relied on SQL Server's `CI_AS` collation for free case-insensitivity, and Postgres is case-sensitive. Found during Unit 1 and confirmed against a live container: (1) **invite-code self-registration broke** — codes generate from an uppercase-only alphabet and `AuthService` only trimmed, so any lowercase input failed to match; (2) **all `Ef*Repository` search paths** stopped matching differing case, so `acme` no longer found `Acme`; (3) **field-definition name uniqueness** stopped treating `Priority`/`priority` as a collision. All three are fixed: (1) and (2) in Unit 6, (3) via the `NormalizedName` column — see "Field-definition name uniqueness" at the end of this document. **None of this is catchable by the existing suite**, which runs on EF InMemory and does not model collation.
> **Correction (2026-08-12) — this was wrong, and it was a latent break.** This section previously claimed the one filtered index "becomes a correct Postgres partial index automatically when migrations are regenerated." It does not. The filter is hardcoded **in the model**, not emitted by the provider: `Persistence/Configurations/FieldDefinitionConfiguration.cs:60` carried `HasFilter("[is_deleted] = 0")`, and that SQL-Server bracket syntax regenerates verbatim into the Npgsql migration and then fails at `MigrateAsync` against Postgres. It was changed to `HasFilter("is_deleted = false")` during Unit 1; the live index is now `... WHERE (is_deleted = false)`. **General lesson: anything passed as a raw SQL string to `HasFilter`, `HasComputedColumnSql`, `HasDefaultValueSql`, or similar is provider-specific and does not migrate itself — grep for those before assuming a regeneration is clean.**

## Known coverage gap

The 561-test suite runs on the **EF InMemory provider**, so it does **not** exercise real PostgreSQL SQL translation — the same limitation Sprint 3 documented for SQL Server. Green-on-InMemory does not prove the migration. This is why §5 adds a Postgres-backed smoke test.

## Task breakdown & effort

Effort in agent-days (1 agent-day = one focused session from partial to build-clean/tested/spec-aligned), consistent with `SPEC/archive/85-implementation-timeline.md`.

1. **Provider swap** (~0.25 d) — package reference (approved), both `UseNpgsql` calls, remove the two `nvarchar(max)` annotations and the one `varbinary(max)` annotation.
2. **Regenerate migrations** (~0.5 d) — delete the 11 migrations + snapshot; `dotnet ef migrations add InitialCreate` against Npgsql; verify the generated DDL (partial index, `uuid`, `timestamptz`, `text`).
3. **Regenerate fresh (chosen strategy)** — history is discarded intentionally; there is no production database, so a single clean `InitialCreate` is correct. (Alternative hand-port of all 11 migrations was rejected: slower, error-prone, no benefit without prod data.)
4. **Connection-string / infra rewrite** (~0.5 d) — `appsettings.Development.json`, `CollegaDbContextFactory` default, `docker-compose.yml` (`postgres:16` image, volume, healthcheck), `.env`/`.env.example`, `StartupConfigurationValidator` text.
5. **UTC-correctness audit + Postgres smoke test** (~1 d) — audit all persisted `DateTime` writes for `Kind = Utc`; add a Postgres-backed integration/smoke test (Testcontainers or local compose DB) covering migrate-up + a timestamped round-trip + email-uniqueness (Testcontainers package approved).
6. **Full-suite + live verification** (~0.5 d) — `dotnet test Collega.sln` green; run the API against a real Postgres container; confirm `MigrateAsync` + `StartupSeeder` succeed end-to-end.
7. **Documentation fan-out** (~0.5 d) — see below.

**Total: ~2.75–3.5 agent-days** plus review, assuming the two package approvals land.

## Documentation fan-out

`SPEC/50-azure-deployment.md` is **already updated** (targets Azure Database for PostgreSQL — Flexible Server, Burstable B1ms). Still to reconcile when this migration merges: `SPEC/00-project-brief.md`, `CLAUDE.md` (stack table + Local SQL Server section + docker-compose notes), `SPEC/50-technical-implementation-plan.md`, `SPEC/50-kubernetes-deployment.md`, `SPEC/20-feature-issues-and-delivery.md`, and `SPEC/50-azure-api-cicd.md` (check its build/deploy steps for any SQL-specific assumptions). `85-implementation-timeline.md` was archived 2026-08-11 and is deliberately **excluded** — do not reconcile archived documents.

## Open items requiring a human decision before implementation

- ~~**NuGet approvals**~~ — approved 2026-08-11 (`Npgsql.EntityFrameworkCore.PostgreSQL` + Testcontainers/Postgres test package).
- **Target Postgres version & host:** local `postgres:16` in compose is assumed and the Azure guide now targets **Azure Database for PostgreSQL Flexible Server (Burstable B1ms)**; confirm this over a self-hosted/K8s host (`SPEC/50-kubernetes-deployment.md` still describes SQL Server and is not yet reconciled).
- ~~**Timing vs. Sprint 4**~~ — scheduled 2026-08-11 as **Sprint 5**, immediately after Sprint 4, in `SPEC/95-next-sprints.md` (`SPEC/sprints/archive/sprint-05-postgres-migration.md`). Runs last so the engine swap starts from Sprint 4's reviewed, stable code.

## Field-definition name uniqueness — RESOLVED (2026-08-12)

**Closed the same day it was raised, by user decision.** The database now enforces case-insensitive uniqueness again, matching what the application layer already did.

The defect: the unique index sat on the raw `Name` column. Under SQL Server's `CI_AS` collation that rejected `"Priority"` alongside `"priority"`; under PostgreSQL it did not. The application guard in `EfFieldDefinitionRepository` had always compared case-insensitively, so single-request behaviour never changed — but the read-then-write guard is not transactional, leaving a window where two concurrent creates of `Cost` and `cost` both committed.

**Fix — the `NormalizedName` column**, following the precedent this document already cites for why email and tags were unaffected (`EmailNormalizer` → `NormalizedEmail`, `Tag.NormalizedName`): put the comparison in a column rather than depend on a collation.
- `FieldDefinition.NormalizedName` set at both assignment points (`Create` and `Update`) via a public `Normalize` helper mirroring `Tag.Normalize`.
- The unique index moved to `(organization_id, normalized_name)`, still filtered on `is_deleted = false` so archiving a field frees its name.
- `EfFieldDefinitionRepository.ExistsActiveByNameAsync` now compares the stored column, so the application check and the constraint agree exactly rather than approximately.
- `SPEC/20-feature-user-defined-fields.md` updated — both the constraint table and the DDL.

**Verified by two container-backed tests** in `PostgresProviderTests`, not by the InMemory suite, which cannot model collation. One asserts the database itself rejects a case-variant duplicate (SQLSTATE 23505 on the named constraint, with no application check in the path); the other asserts a soft-deleted name can be reused, which is the half a stricter index would silently break. Both were confirmed to have teeth: reverting the index to raw `Name` and regenerating made the duplicate test fail, and the soft-delete test correctly stayed green.

The two sibling regressions found at the same time were fixed in Unit 6: invite-code lookup, which had broken self-registration for lowercase input, and the `Ef*Repository` search paths.
