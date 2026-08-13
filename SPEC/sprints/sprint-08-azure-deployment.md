# Sprint 8: Azure Deployment (provision + first deploy + CI/CD)

**Status:** Not started
**Sequence:** 8 of 8 (last) — see `SPEC/95-next-sprints.md` for the full sequence. Renumbered from Sprint 7 on 2026-08-11 when AI-assisted idea drafting was scheduled ahead of it at user request. Starts after Sprint 7 (`sprint-07-ai-idea-assist.md`) is merged, so the first deployment ships both View As (Sprint 6) and AI idea assist. **Hard blocker:** does not start until Sprint 5 (`sprint-05-postgres-migration.md`) is **implemented in code and verified working** — not merely planned (the migration sets the deployment's DB engine).

**Config note (added 2026-08-11):** Sprint 7 introduces a deployment-level AI API key. It must be provisioned as App Service configuration alongside the other secrets in this sprint's config task; the feature stays dark without it, which is a supported state rather than a failure.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## ⛔ Dependency gate — read first
This sprint provisions **Azure Database for PostgreSQL** (Flexible Server), not Azure SQL. That target is only correct **after** the SQL Server → Postgres migration (Sprint 5) is done in code and proven: solution builds on Npgsql, the fresh `InitialCreate` applies, and the API boots + migrates + seeds against a **real Postgres instance** with the Postgres-backed smoke test green. Starting deployment before that would provision the wrong database engine and wire the wrong connection-string format — the migration **changes the deployment requirements**, which is exactly why it goes first. Do not begin any task below until Sprint 5's Definition of Done is fully checked off.

## Goal
Stand up Collega's three tiers on Azure per `SPEC/50-azure-deployment.md` (Static Web Apps + App Service + Azure Database for PostgreSQL), get a first working deployment end-to-end, and confirm the API CI/CD pipeline (`.github/workflows/deploy-api.yml`, documented in `SPEC/50-azure-api-cicd.md`) deploys on push. The two guide docs already exist and are Postgres-aligned; this sprint executes and verifies them.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend / DevOps Developer | 1 | Provision resources, apply App Service config, first deploy, wire CI/CD secrets/variables |
| QA Developer | 1 | Run the §7 post-deploy checklist end-to-end against the live environment |
| Code Reviewer | 1 | Review any infra-as-code / workflow / config changes committed before merge |
| **Total** | **3** | |

## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| P0 | Provision the three tiers | Resource group, **Azure Database for PostgreSQL Flexible Server (Burstable B1ms)**, App Service (Linux .NET 8), Static Web Apps (Free) — `SPEC/50-azure-deployment.md` §4–6 |
| P0 | App Service configuration | Required settings (`ConnectionStrings__DefaultConnection` in Npgsql format, `SiteAdmin__Email/Password`) + recommended (`ASPNETCORE_ENVIRONMENT=Production`, `Cors__AllowedOrigins__0`, `Auth__TokenSigningKey`) — §3 |
| P0 | First deploy + boot verification | API connects to Postgres, runs migrations, seeds Site Admin; frontend loads and calls the API without CORS errors — §5–7 |
| P0 | CI/CD pipeline wiring | `AZURE_WEBAPP_PUBLISH_PROFILE` secret + `AZURE_WEBAPP_NAME` variable; confirm push-to-`main` deploys — `SPEC/50-azure-api-cicd.md` |
| P0 | Make portrait upload work on Linux App Service | `Collega.Infrastructure.csproj` references `SkiaSharp 2.88.8` with **no Linux native assets**, which that package does not bundle. The API boots fine (the processor is a lazily-used singleton), then the first avatar upload throws `DllNotFoundException: libSkiaSharp` at `SkiaSharpImageProcessor.Decode`. See "Image processing on Linux" below for the options — **needs a decision before the first deploy**, not after. |
| P1 | Post-deploy checklist pass | Every box in `SPEC/50-azure-deployment.md` §7 verified live (sign-in, forced password change, token stability across restart) — **include a portrait upload**, which the existing checklist does not cover |
| P2 | Hardening follow-ups (as time allows) | Key Vault for secrets, Private Access (VNet) for the DB, least-privilege DB role — `SPEC/50-azure-deployment.md` §8; can be deferred to a post-MVP hardening pass if scope-constrained |

## Image processing on Linux — decision needed
Raised 2026-08-13 while walking the deployment guide. **The problem is packaging, not the library.**
SkiaSharp is fully cross-platform; the `SkiaSharp` NuGet package simply ships native binaries for
Windows and macOS only, and Linux native assets come from a separate companion package. Nothing
about `SKBitmap` is Windows-specific, so this is not evidence that the library choice was wrong.

| Option | Cost | Notes |
|---|---|---|
| **A — add `SkiaSharp.NativeAssets.Linux.NoDependencies`** (recommended) | One `PackageReference`; no code change | Keeps the tracker's locked "Portrait image library = SkiaSharp" decision intact. The `NoDependencies` variant is correct here because `SkiaSharpImageProcessor` only decodes/resizes/encodes and never renders text, so it does not need the host's fontconfig/freetype. **Requires package approval per `CLAUDE.md`.** |
| B — deploy the API on **Windows** App Service instead of Linux | No code or package change | Same or higher cost; narrows platform options later. Sidesteps rather than fixes. |
| C — swap to another imaging library (e.g. ImageSharp) | Rewrite `SkiaSharpImageProcessor` + its tests | **Reverses a locked decision to solve a problem Option A already solves**, and still adds a NuGet dependency — one with commercial-use licensing terms to review. Only justified if a second, independent reason to leave SkiaSharp appears. |

Recommendation: **Option A**. Whichever is chosen, delete the other rows and record the outcome in
`SPEC/implementation-agent-tracker.md`'s locked-decisions block — replacing the existing SkiaSharp
line if it changes, per that file's "delete reversed decisions" rule.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Deployment work starts before Sprint 5 is verified | Wrong DB engine provisioned, wasted infra + rework | The dependency gate above is a hard blocker — Sprint 5 DoD must be fully checked first |
| `Auth__TokenSigningKey` left unset | Every App Service restart/scale logs all users out | It's on the §3 recommended list and the §7 checklist — verify token survives a restart |
| CORS origin not set after SWA host is known | Frontend can't call the API at all | §6.3 closes the CORS loop explicitly; the checklist confirms 200s in the network tab |
| Postgres Flexible Server has no auto-pause (unlike Azure SQL) | Unexpected always-on compute cost | Documented in the guide (§1/§9); stop the server when idle on dev |
| Missing SkiaSharp Linux native assets ship undetected | Portrait upload 500s in production while every test stays green — the whole suite runs on hosts whose SkiaSharp package **does** carry native binaries, so no test can catch this | Resolve the decision above **before** first deploy; add a portrait upload to the §7 post-deploy checklist |

## Definition of Done
- [ ] Sprint 5 fully complete and verified (this sprint's precondition) before any task started
- [ ] All three tiers provisioned in one region per `SPEC/50-azure-deployment.md`
- [ ] API deployed, boots against Azure Database for PostgreSQL, migrations applied, Site Admin seeded
- [ ] Frontend deployed on Static Web Apps and successfully calling the API (no CORS failures)
- [ ] `.github/workflows/deploy-api.yml` deploys on push to `main` with secrets/variables configured
- [ ] `SPEC/50-azure-deployment.md` §7 post-deploy checklist fully passed against the live environment
- [ ] Code Reviewer approved any committed config/workflow changes before merge
