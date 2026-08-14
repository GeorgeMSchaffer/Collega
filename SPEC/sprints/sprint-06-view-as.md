# Sprint 6: View As (user impersonation for support)

**Status:** In Progress (started 2026-08-13) — **every Definition of Done item is built and reviewed; 622 tests green.** The last P1, the Site Admin direct org-content mutation retirement, closed 2026-08-14: enforcement moved server-side into the Application layer, so it no longer depends on which route the client happened to render. A review pass over that change found two unguarded mutation paths (`ReassignIdeaTypeAsync`, `ImportBoardIdeasAsync`) — both fixed, covered, and mutation-checked. **Remaining before archiving:** the merge to `main` per the epic exit criteria, and one queued test-harness tweak in `SPEC/Bug Triage.md` (non-blocking).
**Sequence:** 6 of 8 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 5 (`sprint-05-postgres-migration.md`) is merged, so it's built on the migrated Postgres codebase; followed by Sprint 7 (`sprint-07-ai-idea-assist.md`) and then Sprint 8 (`sprint-08-azure-deployment.md`), so the first Azure deployment ships this feature. Added 2026-08-11 at user request; **kick off only once Sprints 4–5 are done** (per user: start this once all other work is complete).
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Let a privileged user temporarily act in Collega **as** another user — same role, org scope, and visible data — to reproduce issues, verify permissions, support users, **and (decided 2026-08-11) serve as the Site Admin's only path for creating/editing org-owned content**. Site Admin gets no direct org-scoped create/edit surfaces and no org dropdowns anywhere (see `SPEC/20-feature-client-ui.md` → "Site Admin org-content mutation model"); org and user administration stay direct as the bootstrap exception. Comp-first design is already done and signed off in principle (`SPEC/mockups/comp-c-review-10-view-as.html`); this sprint builds the real backend mechanism + Blazor UI.

This is a **post-MVP feature** pulled in by explicit user decision, not original MVP scope — but it is now **load-bearing**: until it ships, Site Admin has no org-content create path at all.

## Decisions — all locked 2026-08-11
All four design decisions are resolved; implementation may proceed on these.

**D-MODE: full act-as.** Impersonation permits mutations, performed under the impersonated identity with dual attribution (real actor + impersonated user) on every write. Site Admin can act as users in any org; Org Admin's act-as is limited to active users within their own org. (The read-only-first recommendation is dropped — it would defeat the feature's role as the Site Admin org-content mutation path.)

| ID | Decision | Locked value (2026-08-11) |
|---|---|---|
| D-MODE | Read-only preview vs full act-as | **Full act-as** — mutations allowed, dual attribution on every write |
| D-SCOPE | Can a Site Admin view-as another Site Admin? | **No** — picker lists org-scoped users only; other Site Admins excluded (they own no org content, so acting as a peer grants nothing new) |
| D-EXPIRE | Auto-expiry window | **30 min idle, hard cap 2 h** — mirrors the existing session-timeout feel |
| D-PLACE | Entry-control location | **Page-header `View as…` control _and_ a rail avatar-menu item** (both, for discoverability — it's the Site Admin's mutation path); no reintroduced global top bar |

## Capacity
| Role | Slices | Notes |
|---|---|---|
| Code Reviewer — **pass 1 of 2** | 1 (**Slice 0, first**) | The authorization audit below. Blocking: runs *before* any mechanism work, not alongside it |
| Backend Developer | 1 | Server-issued, scoped act-as context tied to the real admin's identity; authorization rules; start/exit + (if act-as) dual-attribution audit; expiry; non-nestable |
| Client Developer | 1 | Page-header control + avatar-menu item, picker **drawer** (shared `DrawerShell`), active-banner + rail swap + one-click exit — build to the locked comp. Also retire Site Admin direct org-content mutation affordances (below) |
| QA Developer | 1 | Authorization matrix, audit assertions, expiry, non-nestable, exit-restores-identity |
| Code Reviewer — **pass 2 of 2** | 1 (mandatory) | Pre-merge review of the built feature. Security-sensitive; no fast-track. Distinct from Slice 0, which reviews the ground the feature is built on |

## Slice 0 — Authorization audit (blocking prerequisite, added 2026-08-13)

**Run this before building the mechanism.** It is not a general code-review pass; it answers one bounded question across a known list of call sites, and its answer decides whether the View As design is safe to build on.

**The question:** does every Application-layer authorization path derive organization scope from `ICurrentUserContext`, or does any of them trust an `organizationId` passed in by the caller?

**Why it blocks.** View As makes `ICurrentUserContext` report the *impersonated* identity, so every existing role and org-scope check silently changes meaning. Today a Site Admin passes org checks unconditionally — see the pattern in `OrganizationService.LoadForAdministrationAsync` (`src/Collega.Application/Organizations/OrganizationService.cs:191-207`): `OrgAdmin` is compared against `_currentUser.OrganizationId`, `SiteAdmin` skips the comparison entirely. Under impersonation that same Site Admin arrives as an Org Admin scoped to one organization, which is the design working correctly. But **any** method that scopes off its own `organizationId` argument instead of the context is, under impersonation, a cross-organization write path.

**Scope — 23 `Role.SiteAdmin` branches across 11 services**, plus the ~101 service methods taking a `Guid organizationId` parameter:

| Service | Branches | Reviewed in Sprint 4? |
|---|---|---|
| `Users/UserService.cs` | 282, 314, 337, 368 | No |
| `Ideas/IdeaService.cs` | 1181, 1201, 1214 | **Yes** |
| `Fields/FieldDefinitionService.cs` | 246, 258, 283 | No |
| `Statuses/StatusService.cs` | 184, 201 | No |
| `Organizations/OrganizationService.cs` | 195, 236 | No |
| `IdeaFields/IdeaFieldService.cs` | 349, 360 | No |
| `Comments/CommentService.cs` | 131, 142 | No |
| `Boards/BoardService.cs` | 203, 219 | No |
| `Tags/TagService.cs` | 45 | No |
| `Collaboration/MentionResolver.cs` | 51 | No |
| `Auth/AuthService.cs` | 261 | Login head only |

Sprint 4's review reached exactly one of these services. The other ten hold **20 of the 23 branches** — see `sprints/archive/sprint-04-qa-review-debt.md` → "Review pass — what it actually covered".

**Deliverable:** a per-call-site verdict — *scopes from context* / *trusts the parameter* / *no scoping needed* — with anything in the middle column fixed before the mechanism is built. Findings that are pre-existing bugs independent of View As go to `SPEC/Bug Triage.md`; findings that only bite under impersonation get fixed in this sprint.

**Why not reopen Sprint 4:** its remaining debt is Collaboration, Events, Workflow Config, ~55 client files and Domain entities — largely irrelevant to View As, and Sprint 4 is archived and Complete. This audit is the specific slice of that debt View As actually sits on. The rest stays open and unclaimed.

### Slice 0 result — COMPLETE (2026-08-13): no holes found, design is safe to build on

**Verdict: every authorization path derives organization scope from `ICurrentUserContext`. No service scopes off a caller-supplied `organizationId`.** The View As design — swapping what `ICurrentUserContext` reports — is therefore safe.

**Method.** Every `Role.SiteAdmin` branch read in context, plus a mechanical sweep of every public service method taking a `Guid organizationId`, checking whether its body reaches an authorization guard.

**1. The 23 `Role.SiteAdmin` branches — all one shape, all correct.**

```
role == SiteAdmin                                    -> allow, no org comparison
role == OrgAdmin && _currentUser.OrganizationId == organizationId  -> allow
otherwise                                            -> 404 (existence not leaked)
```

The `organizationId` argument is the *target*; it is always **validated against the context**, never trusted. Under impersonation `_currentUser` reports the target's role and org, so the SiteAdmin branch is not taken (targets are never Site Admins, per D-SCOPE) and the comparison applies against the impersonated user's organization — which is the intended behaviour, reached without changing any of these call sites.

Two branches are not authorization at all and were mis-counted by the original grep: `MentionResolver.cs:51` *excludes* Site Admins from being mentioned (filtering targets, not authorizing a caller), and `IdeaService.EnsureCanMoveIdea` is a pure role check.

**2. `EnsureCanMoveIdea` — investigated as a suspected hole, cleared.** It checks role with no org comparison (`IdeaService.cs:1196`). Its only caller, `ChangeStatusAsync`, calls `EnsureOrganizationScope(idea.OrganizationId)` at line 375 *before* reaching it at line 385. Scope first, then permission — correctly layered, not a gap.

**3. Method sweep: 34 methods take `organizationId`. 32 reach a guard; the 2 that do not are both correct.**

| Method | Why it is safe |
|---|---|
| `OrganizationBootstrapService.ProvisionDefaultsAsync` | Internal collaborator, not a caller-facing entry point. Called only from `OrganizationService.CreateAsync` (behind `RequireSiteAdmin()`) and `StartupSeeder`. No controller reaches it. |
| `MentionResolver.ResolveAsync` | Every call site passes `idea.OrganizationId` / `board.OrganizationId` — an org id read off an **already-loaded, already-scoped entity**, never a caller-supplied value. |

**4. The finding that most de-risks View As: `ICurrentUserContext` is the single chokepoint for identity.** No file outside `src/Collega.API/Authentication/` reads `HttpContext.User`, `ClaimTypes` or `FindFirstValue`, and no controller resolves identity itself. There is no second path by which a service could learn "who is calling" and thereby bypass impersonation. This is what makes the design work with no per-service changes — and it is a property to **preserve**: a future service that reads claims directly would silently opt itself out of View As.

**Scope limits, stated so this is not read as broader than it was.** This audited authorization in the Application layer. It did **not** review Infrastructure repository queries for missing org filters, nor the ~55 client files — both remain part of the open Sprint 4 debt (`sprints/archive/sprint-04-qa-review-debt.md`). Client-side scoping is not a security boundary; the repository question is pre-existing and not specific to View As, so it was not pulled into this sprint.

**No findings were routed to `SPEC/Bug Triage.md`** — there were none to route.


## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| ✅ **P0 (first)** | **Slice 0 — authorization audit** | **DONE 2026-08-13 — no holes found.** See "Slice 0 result". The mechanism is unblocked. |
| P0 | **Impersonation mechanism** | Server-issued, scoped "act-as" context tied to the real admin's identity (NOT a login/token for the target, NOT a role change). Time-boxed (D-EXPIRE), one-click exit restores the admin, **non-nestable**. |
| P0 | **Authorization** | Site Admin → any org user; Org Admin → **active** users in **own** org only; User/Read-Only → refused (control hidden + endpoint 403). Suspended/archived users not selectable. Other Site Admins excluded per D-SCOPE. Enforced server-side, not just in the UI. |
| P0 | **Audit** | Start + exit each write an audit event (real actor + target + timestamps). D-MODE is act-as, so every mutation carries **dual attribution** (real admin + impersonated user) unconditionally; the target's own trail is never forged as self-authored. |
| P0 | **Client UI** | Per `comp-c-review-10-view-as.html`: `View as…` page-header control + avatar-menu item; picker drawer (searchable; org-grouped for Site Admin, own-org for Org Admin); persistent active banner + rail avatar swap (impersonated initials, role-scoped rail) + Exit. Mutating controls stay live (act-as). |
| P1 | **Retire Site Admin direct org-content mutation paths** (user-confirmed 2026-08-11 — View As supersedes them; not optional) | Once View As works end-to-end: the Site Admin global aggregate views (Boards, Ideas, Statuses, Idea Types, Custom Fields) and org-scoped `/settings/organizations/{orgId}/statuses` / `/idea-fields` routes become **read-only for Site Admin** — create/edit/delete affordances removed, View As is the mutation path. Org and user administration (orgs, users, CSV import, invite codes) stay direct per the bootstrap exception. Spec: `20-feature-client-ui.md` → "Site Admin org-content mutation model". |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| An existing service scopes off a caller-supplied `organizationId` rather than `ICurrentUserContext` | Under impersonation this becomes a cross-org write path — invisible today, critical once View As ships | **Slice 0 audit, before the mechanism is built.** 20 of the 23 SiteAdmin branches sit in services Sprint 4 never reviewed |
| Impersonation becomes a privilege-escalation path | Critical security hole | Scope server-side to the caller's real role; Org Admin can never reach another org or a higher role; mandatory Code-Review pass; test the authorization matrix exhaustively |
| "Act-as" writes look self-authored | Accountability gap / audit fraud | Dual attribution on every mutation; never overwrite the target's authorship; audit start/exit unconditionally |
| Stale view-as context lingers | Admin unknowingly acts as someone else | Time-box (D-EXPIRE) + always-visible non-dismissable banner + one-click exit + non-nestable |

## Definition of Done
- [x] All four decisions (D-MODE / D-SCOPE / D-EXPIRE / D-PLACE) locked and recorded 2026-08-11 — see the Decisions section
- [x] Impersonation mechanism built: scoped, tied to real admin, time-boxed, non-nestable, one-click exit — `Application/Impersonation/ViewAsService.cs`, `Domain/Impersonation/ImpersonationSession.cs`, migration `20260813160032_AddImpersonationSessions`
- [x] Authorization enforced server-side and covered by an exhaustive who-can-impersonate-whom test matrix — 18 tests in `ViewAsServiceTests.cs` (Site Admin → any org; Org Admin → own org only, cross-org refused; User/Read-Only refused; Site-Admin-to-Site-Admin refused per D-SCOPE; suspended target and archived organization both refused)
- [x] Start/exit audited; dual attribution on every mutation performed while acting as — `AuditEvent.OnBehalfOfUserId`, written from `ViewAsService`
- [x] Client UI matches the locked comp (control, drawer picker, active banner, rail swap, exit); mutations work under act-as — `Components/ViewAsDrawer.razor`, `Components/ViewAsBanner.razor`, `Layout/NavRail.razor`, `Layout/MainLayout.razor`
- [x] **Site Admin direct org-content mutation retired (2026-08-13).** The original defect was that the restriction was route-shaped: `StatusesAdmin.razor` gated on `_siteAdminGlobal`, which is true only when `OrganizationId` is absent, so a Site Admin on the org-scoped route got the full mutating UI — reached by the global view's own "Manage" link. Fixed at the layer where it cannot be routed around:
  - **Server-side guard.** `Application/Abstractions/OrgContentMutationGuard.cs` refuses a `SiteAdmin` caller on org-content create/edit/delete, applied at 12 call sites across Boards, Comments, Fields, IdeaFields, Ideas and Statuses. No impersonation special case is needed — under View As `ICurrentUserContext.Role` is the target's, so the guard does not fire. Rules 25/25a/25b in `20-feature-view-as.md` and a `30-Contracts.md` section record this.
  - **Client affordances** now gate on the *role*, not the route: `CanMutate => !_isSiteAdmin` in `StatusesAdmin`, `BoardsAdmin`, `IdeaTypesAdmin`, `FieldDefinitionsAdmin` and `BoardDetail`; `Ideas.razor`/`Boards.razor` gate their create paths the same way; `IdeaDrawer.razor` drops Site Admin from `_canDelete`; `BoardEdit.razor` refuses direct URL entry.
  - **Covered by `SiteAdminOrgContentTests`** — nine tests pairing each refusal with the same call succeeding through View As, plus reads staying open and the rule 26 bootstrap path staying direct; `BoardServiceTests`/`StatusServiceTests` cover the refusal at the Application layer too. All mutation-checked: disabling the guard fails them.
  - **Review pass 3 caught two paths the first sweep missed** — `ReassignIdeaTypeAsync` and `ImportBoardIdeasAsync`. Both were enumerated by hand off `IdeaService` rather than found through the `EnsureAdminScope` chokepoint the other four services share, which is exactly how they were skipped. The import gap was the worse of the two: single-idea create was refused while the sibling CSV endpoint would bulk-create the same content.
  - **Engagement actions resolved 2026-08-14** (rule 25c): upvotes, comments and idea CSV import are org content for this purpose, because a Site Admin is not a member of the owning organization. Three rules in `20-feature-ideas-and-engagement.md` are superseded for that role only.
  - Org and user administration stay direct per the bootstrap exception — unchanged, still correct.
- [x] **Slice 0 audit complete (2026-08-13)** — no holes found; see "Slice 0 result": every one of the 23 `Role.SiteAdmin` branches and the `organizationId`-taking service methods has a verdict, and anything that scopes off a caller-supplied `organizationId` rather than `ICurrentUserContext` is fixed
- [x] Code Reviewer has signed off (mandatory — security-sensitive) — pass 2 ran and raised 8 findings, all fixed in `ba104db`. Two were real authorization gaps: `EnsureMayActAs` never tested the target organization for `IsArchived`, and `ResolveImpersonationAsync` tested `target.Status` but not the organization, so a live session survived its org being archived (rule 12 requires both halves). **No post-fix re-review is recorded** — if this sprint's process requires one, it is outstanding.
- [x] `SPEC/20-feature-view-as.md` written and `SPEC/30-Contracts.md` gained a "View As Contracts" section (2026-08-13)
