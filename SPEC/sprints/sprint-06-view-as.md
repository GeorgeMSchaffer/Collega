# Sprint 6: View As (user impersonation for support)

**Status:** Not started
**Sequence:** 6 of 7 — see `SPEC/95-next-sprints.md` for the full sequence. Starts after Sprint 5 (`sprint-05-postgres-migration.md`) is merged, so it's built on the migrated Postgres codebase; precedes Sprint 7 (`sprint-07-azure-deployment.md`) so the first Azure deployment ships this feature. Added 2026-08-11 at user request; **kick off only once Sprints 4–5 are done** (per user: start this once all other work is complete).
**When complete:** move this file to `SPEC/sprints/archive/`, set Status to `Complete` with the completion date, and update `SPEC/95-next-sprints.md`'s index.

## Goal
Let a privileged user temporarily browse Collega **as** another user — same role, org scope, and visible data — to reproduce issues, verify permissions, and support users. Comp-first design is already done and signed off in principle (`SPEC/mockups/comp-c-review-10-view-as.html`); this sprint builds the real backend mechanism + Blazor UI.

This is a **post-MVP feature** pulled in by explicit user decision, not original MVP scope.

## Prerequisite — resolve the four open decisions first
The comp's "Behavior & security" screen parks four decisions that change what gets built. Lock them (interview, multiple-choice) **before** implementation:

| ID | Decision | Comp recommendation |
|---|---|---|
| D-MODE | Read-only preview vs full act-as (can the admin perform actions while viewing-as)? | **Read-only first** — disable all mutating controls while viewing-as; add opt-in act-as later behind the same dual-audit trail |
| D-SCOPE | Can a Site Admin view as another Site Admin? | **No for MVP** — picker lists org-scoped users only |
| D-EXPIRE | Auto-expiry window | **30 min idle, hard cap 2 h** |
| D-PLACE | Entry-control location | **Page-header `View as…` control + rail avatar-menu item**; no reintroduced global top bar |

## Capacity
| Role | Slices | Notes |
|---|---|---|
| Backend Developer | 1 | Server-issued, scoped act-as context tied to the real admin's identity; authorization rules; start/exit + (if act-as) dual-attribution audit; expiry; non-nestable |
| Client Developer | 1 | Page-header control + avatar-menu item, picker **drawer** (shared `DrawerShell`), active-banner + rail swap + one-click exit, read-only gating (if D-MODE = read-only) — build to the locked comp |
| QA Developer | 1 | Authorization matrix, audit assertions, expiry, non-nestable, exit-restores-identity |
| Code Reviewer | 1 (mandatory) | Security-sensitive — impersonation must be reviewed before merge; no fast-track |

## Sprint Backlog
| Priority | Item | Notes |
|---|---|---|
| P0 | **Impersonation mechanism** | Server-issued, scoped "act-as" context tied to the real admin's identity (NOT a login/token for the target, NOT a role change). Time-boxed (D-EXPIRE), one-click exit restores the admin, **non-nestable**. |
| P0 | **Authorization** | Site Admin → any org user; Org Admin → **active** users in **own** org only; User/Read-Only → refused (control hidden + endpoint 403). Suspended/archived users not selectable. Other Site Admins excluded per D-SCOPE. Enforced server-side, not just in the UI. |
| P0 | **Audit** | Start + exit each write an audit event (real actor + target + timestamps). If act-as is enabled (D-MODE), every mutation carries **dual attribution** (real admin + impersonated user); the target's own trail is never forged as self-authored. |
| P0 | **Client UI** | Per `comp-c-review-10-view-as.html`: `View as…` page-header control + avatar-menu item; picker drawer (searchable; org-grouped for Site Admin, own-org for Org Admin); persistent active banner + rail avatar swap (impersonated initials, role-scoped rail) + Exit; if read-only (D-MODE) disable mutating controls while viewing-as. |
| P1 | **Read-only enforcement** (if D-MODE = read-only) | Mutating endpoints refuse writes performed under a read-only view-as context — server-side, not just disabled buttons. |

## Risks
| Risk | Impact | Mitigation |
|---|---|---|
| Impersonation becomes a privilege-escalation path | Critical security hole | Scope server-side to the caller's real role; Org Admin can never reach another org or a higher role; mandatory Code-Review pass; test the authorization matrix exhaustively |
| "Act-as" writes look self-authored | Accountability gap / audit fraud | Dual attribution on every mutation; never overwrite the target's authorship; audit start/exit unconditionally |
| Stale view-as context lingers | Admin unknowingly acts as someone else | Time-box (D-EXPIRE) + always-visible non-dismissable banner + one-click exit + non-nestable |

## Definition of Done
- [ ] D-MODE / D-SCOPE / D-EXPIRE / D-PLACE resolved and recorded (spec + this file)
- [ ] Impersonation mechanism built: scoped, tied to real admin, time-boxed, non-nestable, one-click exit
- [ ] Authorization enforced server-side and covered by an exhaustive who-can-impersonate-whom test matrix
- [ ] Start/exit audited; dual attribution on mutations if act-as is enabled
- [ ] Client UI matches the locked comp (control, drawer picker, active banner, rail swap, exit); read-only gating if D-MODE = read-only
- [ ] Code Reviewer has signed off (mandatory — security-sensitive)
- [ ] `SPEC/20-feature-*` spec written/updated for View As, and `SPEC/30-Contracts.md` updated with the new endpoints
