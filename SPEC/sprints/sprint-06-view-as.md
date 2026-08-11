# Sprint 6: View As (user impersonation for support)

**Status:** Not started
**Sequence:** 6 of 7 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 5 (`sprint-05-postgres-migration.md`) is merged, so it's built on the migrated Postgres codebase; precedes Sprint 7 (`sprint-07-azure-deployment.md`) so the first Azure deployment ships this feature. Added 2026-08-11 at user request; **kick off only once Sprints 4–5 are done** (per user: start this once all other work is complete).
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
| Backend Developer | 1 | Server-issued, scoped act-as context tied to the real admin's identity; authorization rules; start/exit + (if act-as) dual-attribution audit; expiry; non-nestable |
| Client Developer | 1 | Page-header control + avatar-menu item, picker **drawer** (shared `DrawerShell`), active-banner + rail swap + one-click exit — build to the locked comp. Also retire Site Admin direct org-content mutation affordances (below) |
| QA Developer | 1 | Authorization matrix, audit assertions, expiry, non-nestable, exit-restores-identity |
| Code Reviewer | 1 (mandatory) | Security-sensitive — impersonation must be reviewed before merge; no fast-track |

## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| P0 | **Impersonation mechanism** | Server-issued, scoped "act-as" context tied to the real admin's identity (NOT a login/token for the target, NOT a role change). Time-boxed (D-EXPIRE), one-click exit restores the admin, **non-nestable**. |
| P0 | **Authorization** | Site Admin → any org user; Org Admin → **active** users in **own** org only; User/Read-Only → refused (control hidden + endpoint 403). Suspended/archived users not selectable. Other Site Admins excluded per D-SCOPE. Enforced server-side, not just in the UI. |
| P0 | **Audit** | Start + exit each write an audit event (real actor + target + timestamps). D-MODE is act-as, so every mutation carries **dual attribution** (real admin + impersonated user) unconditionally; the target's own trail is never forged as self-authored. |
| P0 | **Client UI** | Per `comp-c-review-10-view-as.html`: `View as…` page-header control + avatar-menu item; picker drawer (searchable; org-grouped for Site Admin, own-org for Org Admin); persistent active banner + rail avatar swap (impersonated initials, role-scoped rail) + Exit. Mutating controls stay live (act-as). |
| P1 | **Retire Site Admin direct org-content mutation paths** (user-confirmed 2026-08-11 — View As supersedes them; not optional) | Once View As works end-to-end: the Site Admin global aggregate views (Boards, Ideas, Statuses, Idea Types, Custom Fields) and org-scoped `/settings/organizations/{orgId}/statuses` / `/idea-fields` routes become **read-only for Site Admin** — create/edit/delete affordances removed, View As is the mutation path. Org and user administration (orgs, users, CSV import, invite codes) stay direct per the bootstrap exception. Spec: `20-feature-client-ui.md` → "Site Admin org-content mutation model". |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Impersonation becomes a privilege-escalation path | Critical security hole | Scope server-side to the caller's real role; Org Admin can never reach another org or a higher role; mandatory Code-Review pass; test the authorization matrix exhaustively |
| "Act-as" writes look self-authored | Accountability gap / audit fraud | Dual attribution on every mutation; never overwrite the target's authorship; audit start/exit unconditionally |
| Stale view-as context lingers | Admin unknowingly acts as someone else | Time-box (D-EXPIRE) + always-visible non-dismissable banner + one-click exit + non-nestable |

## Definition of Done
- [x] All four decisions (D-MODE / D-SCOPE / D-EXPIRE / D-PLACE) locked and recorded 2026-08-11 — see the Decisions section
- [ ] Impersonation mechanism built: scoped, tied to real admin, time-boxed, non-nestable, one-click exit
- [ ] Authorization enforced server-side and covered by an exhaustive who-can-impersonate-whom test matrix
- [ ] Start/exit audited; dual attribution on every mutation performed while acting as
- [ ] Client UI matches the locked comp (control, drawer picker, active banner, rail swap, exit); mutations work under act-as
- [ ] Site Admin direct org-content mutation affordances retired (global views + org-scoped statuses/idea-fields routes read-only for Site Admin); org/user administration confirmed still direct
- [ ] Code Reviewer has signed off (mandatory — security-sensitive)
- [ ] `SPEC/20-feature-*` spec written/updated for View As, and `SPEC/30-Contracts.md` updated with the new endpoints
