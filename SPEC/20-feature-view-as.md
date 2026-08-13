# Feature: View As (act-as impersonation)

## Outcome
A privileged user can temporarily act in Collega **as** another user — same role, same organization scope, same visible data — to reproduce issues, verify permissions, and support users.

**This is not a convenience feature.** A decision on 2026-08-11 removed every direct Site-Admin create/edit path for organization-owned content (`SPEC/20-feature-client-ui.md` → "Site Admin org-content mutation model"). View As is therefore the **only** way a Site Admin can create or edit org content at all. Until it ships, that capability does not exist.

It is explicitly **not** a login as the target (no password, no session issued for them) and **not** a role change.

## Locked decisions (2026-08-11 user interview)

| ID | Decision | Locked value |
|---|---|---|
| D-MODE | Read-only preview vs full act-as | **Full act-as** — mutations permitted, dual attribution on every write |
| D-SCOPE | May a Site Admin act as another Site Admin? | **No.** Site Admins own no organization content, so acting as a peer grants nothing the caller lacks |
| D-EXPIRE | Auto-expiry window | **30 minutes idle, 2 hours absolute** — mirrors the existing session-timeout feel |
| D-PLACE | Entry-control location | **Both** a right-aligned page-header `View as…` control and a rail avatar-menu item. No reintroduced global top bar |

Design comp, signed off: `SPEC/mockups/comp-c-review-10-view-as.html`.

## Mechanism

1. Impersonation is a **server-side session**, not a claim in the access token. The access token continues to identify only the real user (`SPEC/30-Contracts.md` → "Access Token Format and Session Revocation"); it is never reissued to start or end a View As session, and a captured token never carries impersonation authority.
2. A session records: the **real actor**, the **target user**, started-at, last-seen-at, absolute-expiry-at, and ended-at. At most one session may be active per real actor.
3. The session is resolved on each request in the same place identity is already resolved — `TokenAuthenticationService` re-reads live user state per request today, so the impersonation lookup extends an existing read rather than adding a new class of work.
4. When a session is active, `ICurrentUserContext` reports the **impersonated** user's id, organization and role. Every existing organization-scoping and role check therefore applies unchanged, with no per-service special-casing. The real actor is exposed separately, for audit and for the banner.
4a. **`ICurrentUserContext` is the single chokepoint for identity, and must stay that way.** Verified 2026-08-13 (Sprint 6 Slice 0): nothing outside `src/Collega.API/Authentication/` reads `HttpContext.User`, `ClaimTypes` or `FindFirstValue`, and no controller resolves identity itself. This is what makes rule 4 work. **A service that reads claims directly would silently opt itself out of impersonation** — authorizing as the real admin while the rest of the request acts as the target. Treat any new direct claim read outside the authentication layer as a defect.
4b. Authorization derives organization scope from the context, never from a caller-supplied `organizationId`. Also verified in Slice 0 across all 34 methods that take one: an `organizationId` argument is the *target*, always validated against the context. Preserving that is what keeps impersonation from becoming a cross-organization write path.
5. **Non-nestable.** Starting a session while one is active is refused; it is never silently replaced. An admin acting as someone cannot start acting as a third user.
6. **Exit is immediate and one click.** Ending the session restores the real identity on the very next request.
7. The session is **server-authoritative**. Ending, expiry and refusal are decided by the server; the client cannot extend, forge or resume a session, and a client that believes it is impersonating when the server disagrees loses.

## Authorization

8. Who may act as whom — enforced **server-side**. The UI control is a convenience and carries no authority; hiding it is never the mechanism that prevents access.

| Caller role | May act as | May not act as |
|---|---|---|
| **Site Admin** | Any **active**, organization-scoped user, in any organization | Other Site Admins (D-SCOPE); inactive users |
| **Org Admin** | **Active** users in their **own** organization only | Any user outside their organization; Site Admins; inactive users |
| **User** | Nobody | — |
| **Read Only** | Nobody | — |

9. A caller who is not a Site Admin or Org Admin is refused with `403`, and the entry control is hidden. Both, not either.
10. **Only `UserStatus.Active` users are selectable.** The comp labels one demo account "suspended"; the domain has no such status — `UserStatus` is `Active` or `Inactive` only (`src/Collega.Domain/Enums/UserStatus.cs`). Read every "suspended/archived" reference in the comp and in `SPEC/sprints/sprint-06-view-as.md` as **`Inactive`**. Do not introduce a new status for this feature.
11. Impersonation can never escalate. The effective role is the target's own role, and the authorization check is made against the **caller's real role** — an Org Admin acting as a user in their org gains nothing they did not already have, and cannot reach another organization by any path.
12. A session whose target becomes inactive, or whose target's organization is archived, stops being valid at the next request.

## Attribution and audit

13. **Starting and ending a session are always audited**, unconditionally, recording the real actor, the target, and the timestamp.
14. Every mutation performed while acting carries **dual attribution**: `AuditEvent.ActorUserId` is the **real admin**, and a second field records the **impersonated user**. The audit trail therefore never reads as though the target performed the action themselves.
15. **Entity authorship is the impersonated user.** `CreatedByUserId` / `UpdatedByUserId` on org-owned content record the target, because content created through View As genuinely belongs to that organization — that is the purpose of the feature. Rule 14 is what preserves accountability; rule 15 is what makes the content correctly owned.
16. The target's own historical trail is never rewritten or back-dated.

## Expiry

17. **Idle expiry: 30 minutes** with no authenticated request from the real actor. **Absolute cap: 2 hours** from start, regardless of activity.
18. Expiry is enforced **server-side**. A client-side timer may warn, but never decides.
19. On expiry the real identity is restored — the admin is not signed out. The next request simply acts as themselves, and the client surfaces that the session ended rather than silently continuing.

## Client behavior

Per the locked comp; `SPEC/20-feature-client-ui.md` governs general chrome.

20. Entry: a right-aligned `View as…` control in the page header on every screen, plus a rail avatar-menu item (D-PLACE).
21. The picker opens as a **right slide-in drawer** using the shared `DrawerShell`, matching every other detail surface. Searchable. Grouped by organization for Site Admin; own-organization only for Org Admin. Inactive users are shown but not selectable.
22. While acting, a **persistent, non-dismissable banner** is visible on every screen, naming both identities and offering one-click exit. The comp's wording: *"You're seeing exactly what they see. Anything you do is recorded as [real actor] acting as them."*
23. The rail avatar swaps to the impersonated user, and the rail's role-scoped items reflect the target's role — the admin sees what the target sees.
24. Mutating controls stay live. This is act-as, not preview (D-MODE).

## Retiring Site Admin direct mutation

25. Once View As works end to end, these become **read-only for Site Admin**: the global aggregate views (Boards, Ideas, Statuses, Idea Types, Custom Fields) and the org-scoped `/settings/organizations/{organizationId}/statuses` and `/idea-fields` routes. Create, edit and delete affordances are removed; View As is the mutation path.
26. **Bootstrap exception:** organization and user administration — creating organizations and users, CSV import, invite codes — stay **direct** for Site Admin. Without this a new deployment could never be set up, since there would be no user to act as.

## Out of scope

- Impersonating a Site Admin (D-SCOPE).
- Nested impersonation (rule 5).
- Any read-only "preview" mode; D-MODE settled on full act-as.
- Retaining or replaying a session after exit or expiry.

## Contracts

Endpoints, payloads and error codes: `SPEC/30-Contracts.md` → "View As Contracts".
