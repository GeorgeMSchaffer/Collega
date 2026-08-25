# Sprint 8: Azure Deployment (provision + first deploy + CI/CD)

**Status:** Not started
**Sequence:** 8 of 8 (last) — see `SPEC/95-next-sprints.md` for the full sequence. Renumbered from Sprint 7 on 2026-08-11 when AI-assisted idea drafting was scheduled ahead of it at user request. Sprint 7 (`archive/sprint-07-ai-idea-assist.md`) is **complete (2026-08-18)**, so the first deployment ships both View As (Sprint 6) and AI idea assist. **Starts after Sprint 7.5** (`sprint-07.5-accessibility-and-bug-paydown.md`, scheduled 2026-08-25), which clears the ten open triage items: paydown precedes deployment because this sprint is what puts the product in front of real users, so known defects should be fixed before it, not after. Sprint 6.5 (`archive/sprint-06.5-bug-fixes-and-tweaks.md`) set that precedent on 2026-08-14. **Hard blocker:** does not start until Sprint 5 (`sprint-05-postgres-migration.md`) is **implemented in code and verified working** — not merely planned (the migration sets the deployment's DB engine).

**Config note (added 2026-08-11; key renamed 2026-08-25):** Sprint 7 introduces a deployment-level AI API key. The setting name is **`ANTHROPIC_API_KEY`** — renamed from `Ai__ApiKey` on 2026-08-25 per `20-feature-ai-idea-assist.md` rule 29a, so any older provisioning notes naming `Ai__ApiKey` are stale. It must be provisioned as App Service configuration alongside the other secrets in this sprint's config task; the feature stays dark without it, which is a supported state rather than a failure. `deploy/azure/provision.sh` already sets it under the new name and redacts it from its own echoed output.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## ⛔ Dependency gate — read first
This sprint provisions **Azure Database for PostgreSQL** (Flexible Server), not Azure SQL. That target is only correct **after** the SQL Server → Postgres migration (Sprint 5) is done in code and proven: solution builds on Npgsql, the fresh `InitialCreate` applies, and the API boots + migrates + seeds against a **real Postgres instance** with the Postgres-backed smoke test green. Starting deployment before that would provision the wrong database engine and wire the wrong connection-string format — the migration **changes the deployment requirements**, which is exactly why it goes first. Do not begin any task below until Sprint 5's Definition of Done is fully checked off.

## Goal
Stand up Collega's three tiers on Azure per `SPEC/50-azure-deployment.md` (Static Web Apps + App Service + Azure Database for PostgreSQL), get a first working deployment end-to-end, and confirm the API CI/CD pipeline (`.github/workflows/deploy-api.yml`, documented in `SPEC/50-azure-api-cicd.md`) deploys on push. The two guide docs already exist and are Postgres-aligned; this sprint executes and verifies them.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Backend / DevOps Developer | 1 | Provision resources, apply App Service config, first deploy, wire CI/CD secrets/variables |
| UI/UX Developer | 1 | The rule 32c unavailability flash (below) — the sprint's only client-facing change; no comp needed, it reuses the existing drawer flash region |
| QA Developer | 1 | Run the §7 post-deploy checklist end-to-end against the live environment |
| Code Reviewer | 1 | Review any infra-as-code / workflow / config changes committed before merge |
| **Total** | **4** | |

## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| P0 | Provision the three tiers | Resource group, **Azure Database for PostgreSQL Flexible Server (Burstable B1ms)**, App Service (Linux .NET 8), Static Web Apps (Free) — `SPEC/50-azure-deployment.md` §4–6 |
| P0 | App Service configuration | Required settings (`ConnectionStrings__DefaultConnection` in Npgsql format, `SiteAdmin__Email/Password`) + recommended (`ASPNETCORE_ENVIRONMENT=Production`, `Cors__AllowedOrigins__0`, `Auth__TokenSigningKey`) — §3. Also set **`ANTHROPIC_API_KEY`** (see the config note above); it is optional in the sense that the app boots without it, but omitting it ships AI idea assist dark. **`SPEC/50-azure-deployment.md` §3 does not list it** — that gap predates the rename; add it there while doing this task. |
| P0 | First deploy + boot verification | API connects to Postgres, runs migrations, seeds Site Admin; frontend loads and calls the API without CORS errors — §5–7 |
| P0 | CI/CD pipeline wiring — **API** | `AZURE_WEBAPP_PUBLISH_PROFILE` secret + `AZURE_WEBAPP_NAME` variable; confirm push-to-`main` deploys — `SPEC/50-azure-api-cicd.md` |
| P0 | CI/CD pipeline wiring — **client** | `.github/workflows/deploy-client.yml` (drafted 2026-08-13, never yet run) needs the `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. **Create the SWA without `--source`** or Azure generates a competing workflow — `SPEC/50-azure-deployment.md` §6.2 |
| ✅ | ~~Make portrait upload work on Linux App Service~~ | **Resolved 2026-08-13 before the sprint started** — imaging swapped to ImageSharp. See "Image processing on Linux" below. |
| P1 | **Flash message when AI assist is unavailable** (added 2026-08-18) | Rule **32c**. Both existing fallbacks are silent — the 32a page-load skip and the 32b first-turn bailout drop the user on the plain create drawer with no explanation, so an unavailable feature reads as a broken or missing one. Show a non-blocking informational flash on the create drawer, suppressed when it opens normally or after a completed chat. Reuse `DrawerShell`'s `SubHeaderContent` flash region (`.drawer-flash` + `.authnote`, `role="status"`) as `IdeaDrawer.razor` already does — no new component, no comp gate. Touches `IdeaCreateModal.razor` plus its two callers (`BoardDetail.razor`, `Ideas.razor`) and the bailout path in `IdeaBrainstormModal.razor`. Client-only; it lands in this sprint so the first deployment ships it, and it reaches production via `deploy-client.yml`. |
| P1 | Post-deploy checklist pass | Every box in `SPEC/50-azure-deployment.md` §7 verified live (sign-in, forced password change, token stability across restart) — **include a portrait upload**, which the existing checklist does not cover |
| P2 | Hardening follow-ups (as time allows) | Key Vault for secrets, Private Access (VNet) for the DB, least-privilege DB role — `SPEC/50-azure-deployment.md` §8; can be deferred to a post-MVP hardening pass if scope-constrained |

## Image processing on Linux — resolved 2026-08-13
Raised while walking the deployment guide: `SkiaSharp 2.88.8` ships native binaries for Windows and
macOS only, so the API booted fine (the processor is a lazily-used singleton) and then threw
`DllNotFoundException: libSkiaSharp` on the first avatar upload. No test could catch it — the whole
suite runs on hosts where that package *does* carry natives.

**Outcome: swapped to `SixLabors.ImageSharp`, pinned 3.1.12** (user decision, package approved
2026-08-13). Adding `SkiaSharp.NativeAssets.Linux.NoDependencies` would also have fixed the
immediate break at lower cost, but ImageSharp is **fully managed and ships no native assets at
all**, which removes the failure mode rather than re-plumbing it — no per-platform binary can go
missing on a future target (ARM, Alpine, containers). Deploying on Windows App Service instead was
rejected as sidestepping rather than fixing.

`IImageProcessor` was unchanged, so the swap touched one implementation file, its tests, the DI
registration, and the `.csproj`. GIF fixtures no longer need a hand-written literal (ImageSharp has
a GIF *encoder*, which Skia lacked), so the resize theory now covers all three accepted formats.

**Stay on the 3.1.x line.** ImageSharp 4.x requires a Six Labors license key and emits a build
warning on every compile without one; 3.1.x uses the Split License, free for OSS/personal use and
organizations under the revenue threshold. Re-verify the terms before any commercial release.
Recorded in `SPEC/implementation-agent-tracker.md`'s locked-decisions block.

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Deployment work starts before Sprint 5 is verified | Wrong DB engine provisioned, wasted infra + rework | The dependency gate above is a hard blocker — Sprint 5 DoD must be fully checked first |
| `Auth__TokenSigningKey` left unset | Every App Service restart/scale logs all users out | It's on the §3 recommended list and the §7 checklist — verify token survives a restart |
| CORS origin not set after SWA host is known | Frontend can't call the API at all | §6.3 closes the CORS loop explicitly; the checklist confirms 200s in the network tab |
| Postgres Flexible Server has no auto-pause (unlike Azure SQL) | Unexpected always-on compute cost | Documented in the guide (§1/§9); stop the server when idle on dev |
| A native-asset gap ships undetected | Any imaging/native dependency can 500 in production while every test stays green, because the suite runs on developer platforms — this is exactly how the SkiaSharp Linux gap survived to deployment | Closed at the root by moving to a fully managed imaging library (above); **still add a portrait upload to the §7 post-deploy checklist** — it is the only check that exercises the path on the real host |

## Definition of Done
- [ ] Sprint 5 fully complete and verified (this sprint's precondition) before any task started
- [ ] All three tiers provisioned in one region per `SPEC/50-azure-deployment.md`
- [ ] API deployed, boots against Azure Database for PostgreSQL, migrations applied, Site Admin seeded
- [ ] Frontend deployed on Static Web Apps and successfully calling the API (no CORS failures)
- [ ] `.github/workflows/deploy-api.yml` deploys on push to `main` with secrets/variables configured
- [ ] `.github/workflows/deploy-client.yml` deploys on push to `main` with its token secret configured, and a deep link (e.g. `/boards/<id>`) loads on refresh — proving `staticwebapp.config.json`'s fallback is live
- [ ] `SPEC/50-azure-deployment.md` §7 post-deploy checklist fully passed against the live environment
- [ ] Rule 32c flash shown on both unavailable paths and absent on the normal path — verified in the running app, not just by test (the 32a case is reproducible by blanking `ANTHROPIC_API_KEY`)
- [ ] Code Reviewer approved any committed config/workflow changes before merge
