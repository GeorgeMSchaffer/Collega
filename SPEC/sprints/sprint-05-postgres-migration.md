# Sprint 5: PostgreSQL Migration (SQL Server → Postgres)

**Status:** Not started
**Sequence:** 5 of 8 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 4 (`sprint-04-qa-review-debt.md`) is merged; followed by Sprint 6 (`sprint-06-view-as.md`) and Sprint 7 (`sprint-07-ai-idea-assist.md`), both built on the migrated Postgres codebase. **Blocks Sprint 8 (Azure deployment):** that sprint cannot start until this one is implemented in code and verified working against a real Postgres instance, because it changes the deployment's database engine and connection-string requirements.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Switch Collega's application database engine from SQL Server 2022 to PostgreSQL. Approved direction (2026-08-11). The full technical scope — coupling surface, task breakdown, risks, and non-issues — lives in **`SPEC/50-postgres-migration.md`**; this file is the sprint wrapper (sequencing, capacity, DoD). Do not duplicate the scope here — read that doc.

> **Note:** The 2026-08-11 code-review hardening batch was originally folded here, then moved to Sprint 4 (`sprint-04-qa-review-debt.md`, the QA/Code-Review debt pass) on 2026-08-11 as its more natural home. One item — `LIKE`-wildcard escaping — should be **re-verified** during this sprint's Postgres cutover, since `LIKE`/`ESCAPE` semantics and default case-sensitivity differ between SQL Server and Postgres.

## Why after Sprint 4
The engine swap regenerates all migrations and touches the persistence layer. Running it *after* the Sprint 4 QA/Code-Review pass means the review reasons about the final SQL-Server shape once, and the Postgres cutover starts from reviewed, stable code rather than a moving target. It is otherwise independent of Sprints 1–4.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend Developer | 1 | Provider swap, regenerate migrations, connection strings, docker-compose (`postgres:16`), UTC-correctness audit |
| QA Developer | 1 | Postgres-backed smoke/integration test (Testcontainers or local compose DB) — the existing 547 tests run on EF InMemory and will **not** prove PG SQL translation |
| Code Reviewer | 1 | Gate the branch before merge (diff, build, tests, spec conformance) |
| **Total** | **3** | Backend + QA can overlap; Reviewer gates |

## Sprint Backlog
Maps to the task breakdown in `SPEC/50-postgres-migration.md` §"Task breakdown & effort":
| Priority | Item | Notes |
|---|---|---|
| P0 | Provider swap | `Npgsql.EntityFrameworkCore.PostgreSQL` (approved), both `UseNpgsql` calls, drop the two `nvarchar(max)` annotations **and the `varbinary(max)` annotation on `User.PortraitPng`** (`UserConfiguration.cs:83`) |
| P0 | Regenerate migrations fresh | Delete the 11 SQL-Server migrations + snapshot, `dotnet ef migrations add InitialCreate` against Npgsql; verify partial index, `uuid`, `timestamptz`, `text` |
| P0 | `DateTime` → `timestamptz` UTC-correctness audit | The one real risk — Npgsql throws on non-UTC `Kind`. Audit all persisted `DateTime` writes; do **not** use the legacy timestamp switch (decision locked) |
| P0 | Connection strings + infra | `appsettings.Development.json`, `CollegaDbContextFactory` default, `docker-compose.yml` (swap `sqlserver`→`postgres:16`, port 5432, volume, `pg_isready` healthcheck), `.env`/`.env.example`, `StartupConfigurationValidator` text |
| P0 | Postgres-backed smoke test | Testcontainers/Postgres (approved): migrate-up + timestamped round-trip + email-uniqueness |
| P1 | Documentation fan-out | Reconcile `SPEC/00-project-brief.md`, `CLAUDE.md`, `50-technical-implementation-plan.md`, `50-kubernetes-deployment.md`, `20-feature-issues-and-delivery.md`, `50-azure-api-cicd.md`. (`50-azure-deployment.md` already done. `85-implementation-timeline.md` was archived 2026-08-11 — do **not** reconcile it.) |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| A persisted `DateTime` has non-UTC `Kind` and throws only at runtime on Postgres | Runtime failure the InMemory suite can't catch | The UTC audit + the Postgres-backed smoke test are the mitigation; both are P0 |
| Regenerated migration diverges subtly from the SQL-Server schema | Silent schema drift | Diff generated DDL against the SQL-Server model snapshot before merge |
| InMemory test suite stays green while real PG translation breaks | False confidence | Postgres-backed integration test is mandatory this sprint, not optional |

## Definition of Done
- [ ] Provider swapped to Npgsql; solution builds clean
- [ ] Single fresh `InitialCreate` migration generated and its DDL reviewed
- [ ] All persisted `DateTime` writes confirmed UTC; no legacy-timestamp switch used
- [ ] Connection strings, `docker-compose.yml`, and `.env(.example)` all target Postgres; API boots and migrates against a real Postgres container
- [ ] Postgres-backed smoke/integration test added and green
- [ ] Full `dotnet test Collega.sln` green
- [ ] Docs reconciled per the fan-out list; `00-project-brief.md` + `CLAUDE.md` stack references updated to PostgreSQL
- [ ] `LIKE`-wildcard escaping (Sprint 4 hardening batch) re-verified under Postgres `LIKE`/`ESCAPE` + case-sensitivity semantics. **Verify the generated SQL actually emits an `ESCAPE` clause — do not trust the call sites by reading them.** The original batch fix left `EfIdeaRepository.ListByOrganizationAsync` on the two-argument `EF.Functions.Like` overload, so its escaping was inert until 2026-08-12; the same mistake is easy to reintroduce and no in-memory test can catch it (the InMemory provider evaluates `Like` client-side and cannot distinguish the overloads). Capture the SQL from a real Postgres run, or assert on `ToQueryString()` against a relational provider.
- [ ] Code Reviewer approved before merge
