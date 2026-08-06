# Implementation Timeline

## Purpose
`SPEC/50-technical-implementation-plan.md`, `SPEC/70-delivery-backlog.md`, and `SPEC/80-workstream-roadmap.md` already define the full task breakdown, exit criteria, and dependency ordering for the MVP and post-MVP phases. None of them assign effort or calendar estimates — the one exception is the User-Defined-Fields addendum at the bottom of `SPEC/50-technical-implementation-plan.md`, sized at "~12–16 dev-days." This document adds that missing dimension: effort estimates and a critical path, expressed in **agent-days**, on top of the existing epic/phase/milestone structure. It does not redefine scope — `SPEC/70-delivery-backlog.md` remains the task-level source of truth; this file only adds sizing and sequencing commentary.

## Status
Advisory / non-canonical. This is a planning aid, not a contract. If effort estimates and actual implementation pace diverge significantly, update this file — it does not gate delivery the way `SPEC/30-Contracts.md` or the feature specs do.

## Estimation Basis
- **Unit:** 1 agent-day = one focused Claude Code session that takes a coherent task slice from empty/partial to build-clean, tested, and spec-aligned — not a literal 24-hour period.
- **Calibration anchor:** the existing UDF sizing (`SPEC/50-technical-implementation-plan.md`, "Effort Sizing" table) — a feature touching Domain, Application, API, Client (editor + dynamic form + filter panel), and CSV import/export at ~12–16 agent-days. Every estimate below is sized relative to that anchor.
- **Assumption:** a single AI agent (not a multi-person team) executes sequentially across Domain → Application → Infrastructure → API → Client for a given slice. The "parallel team workstream" framing in `SPEC/70-delivery-backlog.md` and `SPEC/80-workstream-roadmap.md` (separate API/Application/Infrastructure/Client/QA lanes running concurrently) does not shorten a solo-agent timeline the way it would a real team's — see "Sequencing for a solo agent" below.
- **Excluded from the estimate:** human review/approval latency, environment setup outside this repo (e.g. cloud infra, CI runners), and time spent on spec clarification Q&A when new ambiguities surface (two were found and resolved while drafting this document — see "Open Items" below).

## Prerequisites (Day 0, before Epic 1)
These block starting Epic 1 and are not yet done in this repo:
1. Create `global.json` pinning the .NET 8 SDK (`8.0.118`, per `CLAUDE.md`) — currently absent.
2. Create `Collega.sln` and the five `src/Collega.*` project skeletons with the dependency direction from `SPEC/00-project-brief.md`.
3. Confirm local SQL Server connectivity — satisfied by the `docker-compose.yml` added at repo root (`docker compose up -d sqlserver`); still need a real `.env` with `MSSQL_SA_PASSWORD` set locally.
4. Decide the EF Core migrations workflow (`dotnet ef migrations add` invocation, connection string source for design-time DbContext).

Estimate: 0.5 agent-day, assuming no tooling surprises.

## Open Items — Resolved 2026-08-06
Both items found while researching this plan are now resolved; see `SPEC/60-spec-q-and-a-backlog.md` Decision Log (2026-08-06) for details.
1. **Invite-code self-registration scope conflict** — resolved as an omission in `SPEC/Specs Overview.md`, not a scope change. Self-registration via invite code remains in MVP scope (it was always canonical per `SPEC/10-requirements.md`, `SPEC/20-feature-organizations-and-users.md`, and `SPEC/30-Contracts.md`); the overview has been brought in sync. The Epic 3 estimate below already assumed this was in scope, so no change to the numbers.
2. **Seed Site Admin credential mechanism was unnamed** — resolved: configuration keys `SiteAdmin__Email` / `SiteAdmin__Password` (ASP.NET Core config, fail-fast on startup if missing), recorded in `SPEC/20-feature-auth.md`, `SPEC/50-technical-implementation-plan.md`, and `SPEC/50-kubernetes-deployment.md`.

## MVP Epic Estimates
Epics and dependency rules are as defined in `SPEC/70-delivery-backlog.md`; this table only adds the `Est.` column. Task-ID cross-references are to `SPEC/implementation-agent-tracker.md`.

| Epic | Scope | Est. (agent-days) | Depends on | Tracker tasks |
|---|---|---|---|---|
| 1. Foundation and Contract Baseline | Solution scaffolding, DbContext/migrations, `/api/v1` conventions, problem-details envelope, validation + OpenAPI skeleton | 2–3 | Prerequisites | T001–T004 |
| 2. Authentication and Global Administration | Login, hashing, lockout, complexity policy, Site Admin seed, dev seed (3 orgs), first-login change, audit, temp-password reset (P1), login/first-login UI | 4–6 | Epic 1 | T005–T011, T040–T041 |
| 3. Organizations and Users | Org CRUD/archive, invite code + regen, self-registration, default board/status bootstrap, user CRUD, CSV template + atomic import, lifecycle guards, admin UI | 5–7 | Epics 1–2 | T012–T019, T042 |
| 4. Boards and Statuses | Status CRUD + soft-delete (with reference guard), board CRUD, min-2-swimlane rule, swimlane reorder, Idea Type/Business Impact option CRUD + seeding (`BE-1` portion) | 4–6 | Epics 1, 3 | T020–T024, `BE-1` |
| 5. Ideas and Engagement | Idea CRUD + soft delete, required Idea Type/Business Impact + backfill migration, description-edit authorization, bulk CSV idea import, tags, mentions, comments, upvotes, multi-assignee migration (`BE-1`/`BE-2`), board projections | 8–11 | Epics 1, 3, 4 | T025–T036, `BE-1`, `BE-2` |
| 6. Notification Events and Audit Surfaces | Notification events for mentions/comments/status changes, canonical idea links, internal verification persistence | 2–3 | Epics 1–5 | T037–T039 |
| 7. Blazor Client Experience | Bug fixes, header/nav, Settings rename + list/form-swap, Boards list, full Kanban rebuild (drag/drop, column reorder, full-page Idea Detail navigation, optimistic upvote/status, multi-assignee + tag selectors), primary-nav styling, Idea Fields settings, uniform search/pagination (`BE-3`/`BE-4`) | 10–14 | Epics 2–5 (final polish after all) | T042–T045, `BE-3`, `BE-4` |
| 8. Hardening and Release Readiness | OpenAPI alignment, unit/integration/contract tests, smoke test, seed + dev-seed idempotency verification, client-ui-revisions regression pass | 5–7 | Epics 1–7 | T046–T052, `BE-5` |

**MVP subtotal: 40–57 agent-days** (midpoint ≈ 48).

## Sequencing for a Solo Agent
`SPEC/70-delivery-backlog.md` and `SPEC/80-workstream-roadmap.md` describe API/Application/Infrastructure/Client/QA as concurrent lanes — that's team-sequencing advice and doesn't apply directly to a single agent working alone, since one agent can't truly parallelize across lanes. For a solo agent, two sequencing options:

- **Batched (as written):** Epics 1→2→3→4→5→6 build the full backend, then Epic 7 builds the whole client, then Epic 8 hardens everything. Simple to reason about; the same total effort as below, but Epic 7 involves relearning context across every prior epic's API shape at once, and defects found late in Epic 7 can bounce back into Epics 3–5.
- **Interleaved (recommended):** pull the client tasks for each epic into that epic (e.g. build the org/user admin UI right after Epic 3's API stabilizes, not deferred to Epic 7). Total effort is roughly the same, but integration issues surface immediately instead of during a large end-of-project client push, and there's no separate large "Epic 7" — its component tasks distribute into Epics 2–6, leaving Epic 7 as only the cross-cutting items that don't belong to one epic (global nav/header, Settings shell, uniform search/pagination, primary-nav styling).

Either way, the **critical path is effectively the full sum of the epics** above (1→2→3→4→5→6→7→8) — there is no parallelism discount available to a single agent, only a rework-risk reduction from interleaving.

## Calendar Translation (heavily caveated)
40–57 agent-days is *not* the same as 40–57 calendar days — actual elapsed time depends entirely on session frequency, review/approval turnaround, and how many clarification rounds surface (see "Open Items" above, which will likely not be the last). As a rough anchor only: at roughly one agent-day of net progress per weekday, MVP (Epics 1–8) is **~8–11 weeks** of elapsed time. Treat this as an order-of-magnitude anchor, not a commitment.

## Post-MVP Sizing
| Item | Scope | Est. (agent-days) | Depends on |
|---|---|---|---|
| Self-service password reset | Anonymous request/confirm endpoints, token issuance/expiry/invalidation, throttling (3/email, 10/IP per 15 min), reset pages, session revocation, audit | 3–4 | MVP auth (Epic 2) |
| Epic 9: OAuth (Microsoft Entra ID) | `ExternalIdentity` persistence, org-scoped provider config, challenge/callback flow, identity linking + email fallback, auto-provisioning, break-glass Site Admin, client entry points | 6–9 | MVP release, stable Epic 2 contracts |
| Epic 10: SAML | Org-scoped SAML config/metadata, SP-initiated flow, reuse of Epic 9's linking/provisioning logic, protocol validation | 4–6 | Epic 9 |
| User-Defined Fields | Already sized in `SPEC/50-technical-implementation-plan.md` | 12–16 (existing estimate, unchanged) | MVP boards/ideas |
| Reporting | `SPEC/20-feature-reporting.md` is currently a 36-line scope stub with no phase breakdown in `SPEC/50-technical-implementation-plan.md` — **not sizeable yet**. Needs its own technical-implementation-plan section (report categories, CSV/JSON export design) before an estimate is meaningful. | Not sized | MVP release |

## Risk Factors That Could Move These Numbers
- **Migration complexity in Epic 5** — the `BE-1`/`BE-2` slices require backfilling every existing idea with default Idea Type/Business Impact *and* migrating a singular `AssigneeUserId` into a many-to-many `IdeaAssignee` join table in the same phase. Since this MVP starts from zero data, there's no real legacy data to backfill — if implemented in the right order (assignee join table designed in from the start), this risk mostly disappears and Epic 5's estimate likely lands at the low end.
- **Epic 7's Kanban rebuild** (`BE-3`/`BE-4`) is the single largest concentration of client complexity (drag-and-drop with rollback, optimistic upvote, column reorder, multi-select assignees/tags) and is the most likely epic to overrun its range.
- **Unresolved spec conflicts** (see "Open Items") each cost a clarification round before the affected epic can start cleanly; more may surface once implementation begins and edge cases appear that the specs don't cover.
