# Sprint 5: PostgreSQL Migration (SQL Server → Postgres)

**Status:** Not started
**Sequence:** 5 of 7 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 4 (`sprint-04-qa-review-debt.md`) is merged; followed by Sprint 6 (`sprint-06-view-as.md`), which is built on the migrated Postgres codebase. **Blocks Sprint 7 (Azure deployment):** that sprint cannot start until this one is implemented in code and verified working against a real Postgres instance, because it changes the deployment's database engine and connection-string requirements.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Switch Collega's application database engine from SQL Server 2022 to PostgreSQL. Approved direction (2026-08-11). The full technical scope — coupling surface, task breakdown, risks, and non-issues — lives in **`SPEC/50-postgres-migration.md`**; this file is the sprint wrapper (sequencing, capacity, DoD). Do not duplicate the scope here — read that doc.

**Added scope (folded in 2026-08-11):** the six-item Code-Review Hardening Batch from the 2026-08-11 whole-codebase review (see `SPEC/Bug Triage.md` `TODO`) rides along in this sprint — see "Added Scope" below. One item (LIKE-wildcard escaping) genuinely overlaps the engine swap because `LIKE`/`ESCAPE` semantics and default case-sensitivity differ between SQL Server and Postgres, so it should be handled while the persistence layer is already open.

## Why after Sprint 4
The engine swap regenerates all migrations and touches the persistence layer. Running it *after* the Sprint 4 QA/Code-Review pass means the review reasons about the final SQL-Server shape once, and the Postgres cutover starts from reviewed, stable code rather than a moving target. It is otherwise independent of Sprints 1–4.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend Developer | 1 | Provider swap, regenerate migrations, connection strings, docker-compose (`postgres:16`), UTC-correctness audit |
| QA Developer | 1 | Postgres-backed smoke/integration test (Testcontainers or local compose DB) — the existing 500 tests run on EF InMemory and will **not** prove PG SQL translation |
| Code Reviewer | 1 | Gate the branch before merge (diff, build, tests, spec conformance) |
| **Total** | **3** | Backend + QA can overlap; Reviewer gates |

## Sprint Backlog
Maps to the task breakdown in `SPEC/50-postgres-migration.md` §"Task breakdown & effort":
| Priority | Item | Notes |
|---|---|---|
| P0 | Provider swap | `Npgsql.EntityFrameworkCore.PostgreSQL` (approved), both `UseNpgsql` calls, drop the two `nvarchar(max)` annotations |
| P0 | Regenerate migrations fresh | Delete the 10 SQL-Server migrations + snapshot, `dotnet ef migrations add InitialCreate` against Npgsql; verify partial index, `uuid`, `timestamptz`, `text` |
| P0 | `DateTime` → `timestamptz` UTC-correctness audit | The one real risk — Npgsql throws on non-UTC `Kind`. Audit all persisted `DateTime` writes; do **not** use the legacy timestamp switch (decision locked) |
| P0 | Connection strings + infra | `appsettings.Development.json`, `CollegaDbContextFactory` default, `docker-compose.yml` (swap `sqlserver`→`postgres:16`, port 5432, volume, `pg_isready` healthcheck), `.env`/`.env.example`, `StartupConfigurationValidator` text |
| P0 | Postgres-backed smoke test | Testcontainers/Postgres (approved): migrate-up + timestamped round-trip + email-uniqueness |
| P1 | Documentation fan-out | Reconcile `SPEC/00-project-brief.md`, `CLAUDE.md`, `50-technical-implementation-plan.md`, `50-kubernetes-deployment.md`, `85-implementation-timeline.md`, `20-feature-issues-and-delivery.md`, `50-azure-api-cicd.md`. (`50-azure-deployment.md` already done.) |

## Added Scope — Code-Review Hardening Batch (folded in 2026-08-11)
From the 2026-08-11 `/code-review` of `dev` (auth/token stack, password hashing, and all Application services reviewed clean for org-scoping/role checks — no cross-tenant leak or authz bypass). Full per-item detail (file, line, failure, suggested fix) lives in the matching `SPEC/Bug Triage.md` `TODO` entry; this table is the sprint-execution view. Most-severe first:
| Priority | Sev | Item | Location | Fix |
|---|---|---|---|---|
| P0 | HIGH | CSV export formula injection (CWE-1236) | `src/Collega.API/Parsing/Csv.cs` `Escape` | Prefix a formula-guard on cells starting `= + - @ \t \r` before export |
| P1 | MED | Forced password change enforced only client-side | `src/Collega.Application/Auth/TokenAuthenticationService.cs` | Block non-allowlisted endpoints server-side while `MustChangePassword` is true |
| P1 | MED | Unescaped `LIKE` wildcards in search (`%`/`_`) — *overlaps the PG swap* | `EfIdeaRepository.cs` + sibling `Ef*Repository` search paths | Escape `% _ [` with an `ESCAPE` clause; re-verify under Postgres case-sensitivity |
| P2 | MED | Board CSV export builds full dataset in memory (sync DoS) | `IdeaService.ExportBoardIdeasAsync` / `IdeasController.ExportCsv` | Stream / cap rows, or move off the sync request path |
| P2 | MED/LOW | CSV import reads whole upload into memory, no endpoint cap | `IdeasController.ImportCsv` | Add explicit request-size + max-row-count limits |
| P3 | LOW | Client auth state ignores stored token expiry | `CollegaAuthStateProvider.GetAuthenticationStateAsync` | Treat an elapsed `expiresAtUtc` as anonymous on load |

*Excluded false positive:* a `Convert.ToDecimal` 500 in the Number-range filter — `FieldValueValidator` never persists empty/non-decimal values and `FieldType` is immutable, so it cannot fire.

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
- [ ] **Code-review hardening batch:** all six items resolved (or explicitly deferred with reason) — CSV export formula-guard (HIGH); server-side `MustChangePassword` gate; `LIKE` wildcard escaping verified under Postgres; export/import memory bounds; client token-expiry check
- [ ] Code Reviewer approved before merge
