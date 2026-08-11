# Sprint 2: Drawer-Pattern Rollout

**Status:** Complete (2026-08-10)
**Sequence:** 2 of 4 — see `SPEC/95-next-sprints.md` for the full sequence and how these sprints relate. Starts after Sprint 1 (`sprint-01-bug-triage-quick-wins.md`) is merged.

> **Outcome (2026-08-10):** Delivered and merged to `dev`. Executed as parallel worktree agents: (1) shared `DrawerShell`/`CreateModalShell` extracted from the Ideas surface with Ideas refactored to use them (zero behavior change); (2) all five entities (Organizations, Users, Statuses, Idea Types, Custom Fields) converted to List + Drawer, with full-page routes retired (`/settings/organizations/new`, `/settings/users/new`, per-entity edit routes) and Organizations' drawer made URL-addressable at `/settings/organizations/{id}`; (3) the independent `--seed:auth=reset` Site Admin seed-reset affordance (+4 hermetic tests). Each branch passed a coordinator code-review gate before merge. Client build 0/0; full suite **478 green**. Live QA (Org Admin, injected session) verified the Statuses/Users drawers, the Custom Fields/Idea Types create modals, and the Ideas control (no regression); it caught one defect — the Idea Types create/edit badge preview passed `ColorHex`/`Icon` as literal strings (missing `@`) — fixed in `b419842`. Organizations (SiteAdmin-only) verified by code review. Specs updated: `20-feature-client-ui.md` (new "Admin entities use the same List + Drawer pattern" section) and `20-feature-client-ui-revisions.md` (Decision D5).

> **Reorder note (2026-08-10):** pulled ahead of List Filter Parity (now Sprint 3). This is the largest structural change to the admin list pages, so it runs immediately after the Sprint 1 quick-wins to consolidate all list-page churn; filters + server-side sort then layer onto the finalized pages once, in Sprint 3.
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Organizations, Users, Statuses, Idea Types, and Custom Fields all use the same List + Drawer pattern already built for Ideas (`IdeaDrawer.razor`/`IdeaCreateModal.razor`), replacing today's older list/full-page-form pattern — per explicit user decision, scoped as one dedicated sprint rather than spread across others.

This sprint also carries one **unrelated backend affordance** adopted 2026-08-10: an opt-in Site Admin seed **reset** flag (see "Additional Item: Site Admin Seed-Reset Affordance" below). It's bundled here for scheduling only — it shares nothing with the drawer theme and has no dependency on the drawer work, so it can proceed on its own Backend/QA slices in parallel.

## Capacity
| Role | Slices this sprint | Notes |
|---|---|---|
| Client Developer | 2 | 1 slice to extract a generic/reusable drawer shell from `IdeaDrawer`/`IdeaCreateModal`, 1 slice (or several parallel worktrees) to apply it per entity |
| Backend Developer | 1 | Site Admin seed-reset flag (see Additional Item) — independent of the drawer work |
| QA Developer | 2 | (1) Regression coverage — this touches every admin list page; (2) `StartupSeeder` reset-path tests |
| Code Reviewer | 1 | This is exactly the kind of cross-cutting UI change worth a real review pass before merge, given its blast radius |
| **Total** | **6** | |

## Sprint Backlog
| Priority | Item | Notes | Dependencies |
|---|---|---|---|
| P0 | Extract a reusable drawer/create-modal shell from `IdeaDrawer.razor`/`IdeaCreateModal.razor` | Avoid rebuilding the pattern 5 times from scratch | Sprint 1 merged first (don't build on pre-fix list-page chrome) |
| P0 | Convert Organizations list/detail to List + Drawer | | Depends on shell extraction |
| P0 | Convert Users list/detail to List + Drawer | | Depends on shell extraction |
| P0 | Convert Statuses list/detail to List + Drawer | | Depends on shell extraction |
| P0 | Convert Idea Types list/detail to List + Drawer | | Depends on shell extraction |
| P0 | Convert Custom Fields (Field Definitions) list/detail to List + Drawer | | Depends on shell extraction |
| P1 | Retire now-superseded full-page edit routes for these 5 entities where the drawer fully replaces them | Mirror how `/ideas/{ideaId}/edit` was retired for T-UI-3 | After each entity's drawer conversion lands |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Largest blast-radius change in this plan — touches every admin surface | Regression risk across the whole app | Code Reviewer pass required before merge (not skipped, unlike most prior slices); QA regression pass covers all 5 converted entities plus Ideas (unchanged) as a control |
| Admin drawer/create-modal layouts aren't comped/locked yet — only the Ideas drawer is (`comp-c-review-09-detail-surfaces.html`) | Building production Blazor against an undecided layout is the rework the comp process prevents (per `src/Collega.Client/CLAUDE.md`) | Start this sprint with throwaway HTML comps in `SPEC/mockups/` for the per-entity forms and get sign-off before writing components |
| Retiring old routes breaks any external links/bookmarks or notification links pointing at old admin URLs | Broken deep links | Check `SPEC/20-feature-notifications.md` and audit-log link formats for references to the old routes before retiring them |

## Definition of Done
- [ ] All 5 entities converted; shared drawer shell used by all 6 (5 + Ideas) rather than duplicated
- [ ] Code Reviewer sign-off (diff review, build, spec conformance)
- [ ] Full regression pass across all converted list pages; build 0/0, test suite green
- [ ] `SPEC/20-feature-client-ui.md` and `SPEC/20-feature-client-ui-revisions.md` updated to describe the new pattern as canonical for these entities
- [ ] Additional Item (below): Site Admin seed-reset flag implemented, tested, and its docs updated

---

## Additional Item: Site Admin Seed-Reset Affordance
**Adopted 2026-08-10** (design confirmed with the user via interview). A dev/ops affordance, not product behavior — no canonical `SPEC/*.md` behavior change. Independent of the drawer work above; can run on its own Backend + QA slices.

### Goal
Add an opt-in **reset** to the Site Admin part of `StartupSeeder`: on demand, drop the existing seeded Site Admin and recreate it from the configured `SiteAdmin:Email` / `SiteAdmin:Password` with `MustChangePassword = true`. Default startup stays idempotent (unchanged); reset only happens when explicitly requested. **Scope is Site Admin only** — demo users are untouched.

### Trigger
New flag value `--seed:auth=reset` (also `/seed:auth=reset`):
- `--seed:auth` → seed if missing (today's behavior)
- `--seed:auth=false` → don't seed (today's behavior)
- `--seed:auth=reset` → **new**: seed, and if a Site Admin matching the configured email already exists, drop and recreate it

Typical dev use: `dotnet run --project ./src/Collega.API -- --seed:auth=reset`

### Changes
1. **`src/Collega.API/Program.cs`** — `ReadSeedFlag` returns `bool?` and can't express "reset". Add a sibling parser (e.g. `ReadSeedResetFlag(args, "seed:auth")`) returning `true` when the value is the literal `reset`. Derive `resetSiteAdmin`; when true, force `seedSiteAdmin = true`. Pass the new arg into `seeder.SeedAsync(...)`.
2. **`src/Collega.Application/Abstractions/IStartupSeeder.cs`** — add `bool resetSiteAdmin` parameter to `SeedAsync` (next to `seedSiteAdmin`); update the XML doc.
3. **`src/Collega.Infrastructure/Seeding/StartupSeeder.cs`** — accept `resetSiteAdmin`. In the `seedSiteAdmin` block, target the Site Admin **by configured email** (`NormalizedEmail` match, `Role == SiteAdmin`) rather than "any SiteAdmin", so a manually-promoted Site Admin isn't nuked. If `resetSiteAdmin` and it exists → `Remove` + `SaveChanges`, then recreate via `User.CreateSiteAdmin(...)` when now absent. FK-safe: `AuditEvent.ActorUserId` is a plain Guid column (no FK navigation) and the Site Admin has no org membership or authored org content, so a hard delete has no cascade fallout.
4. **Docs** — `src/Collega.API/CLAUDE.md` ("Seeding flags") documents `--seed:auth=reset`; `src/Collega.Infrastructure/CLAUDE.md` ("Seeding") notes the reset path recreates the Site Admin with `MustChangePassword: true`.

### Tests (`StartupSeeder`, InMemory provider — hermetic)
- `resetSiteAdmin: false` with an existing (password-changed) Site Admin → left untouched (current idempotent contract).
- `resetSiteAdmin: true` with an existing Site Admin whose password was changed / `MustChangePassword` cleared → after seed, exactly one Site Admin for that email, hash matches configured password, `MustChangePassword == true`.
- `resetSiteAdmin: true` with no existing Site Admin → creates one (same as normal seed).
- Update existing `SeedAsync(...)` call sites for the new parameter.

### Definition of Done (this item)
- [ ] `--seed:auth=reset` implemented end-to-end (flag parse → `SeedAsync` → email-scoped drop + recreate with `MustChangePassword: true`)
- [ ] Default startup unchanged (still idempotent when the flag is absent)
- [ ] Seeder reset-path tests added; `dotnet build`/`dotnet test Collega.sln` green
- [ ] `src/Collega.API/CLAUDE.md` and `src/Collega.Infrastructure/CLAUDE.md` seeding docs updated

### Open point for the implementer
Reset targets the account matching the configured `SiteAdmin:Email`. If the user later prefers dropping *every* `Role == SiteAdmin` row regardless of email, that's a one-line change — email-scoped was chosen as the safer default.
