# Contracts: view-as

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## View As Contracts

Canonical behavior: `SPEC/20-feature-view-as.md`.

- Impersonation is a **server-side session**, never a claim in the access token. The token continues to identify only the real user and is not reissued to start or end a session. Why: a captured token therefore never carries impersonation authority.
- While a session is active, every other endpoint in this document behaves as though the **impersonated** user were the caller: organization scoping, role checks and returned data are all the target's. The endpoints below are the only ones that operate on the real actor's identity while a session is active.
- Only `Active` users are valid targets. The design comp labels a demo account "suspended"; the domain has no such status — read it as `Inactive` (`SPEC/20-feature-view-as.md` rule 10).

### `POST /api/v1/auth/view-as`
Start acting as another user.

- **Roles:** Site Admin (any active org-scoped user, any organization); Org Admin (active users in own organization only). All other roles are refused.
- **Request:**
  - `targetUserId` required GUID
- **Response:** `200`:
  - `impersonating` — the target's authenticated user summary, same shape as `GET /api/v1/auth/me`
  - `realUser` — the caller's own summary, same shape
  - `startedAtUtc`
  - `expiresAtUtc` — the absolute cap (2 hours from start)
- **Errors:**
  - `400` missing or malformed `targetUserId`
  - `401` caller is not authenticated
  - `403` caller's role may not impersonate, or may not impersonate this target — an Org Admin naming a user outside their organization, anyone naming a Site Admin (D-SCOPE), or any caller naming an `Inactive` user. All three return the same `403` and the same message, so the endpoint does not disclose whether a given user exists or what role they hold.
  - `404` no user with that id
  - `409` a session is already active for this caller — sessions are **non-nestable** and are never silently replaced. Exit first.
- **Rules:** —

### `DELETE /api/v1/auth/view-as`
Stop acting as another user and restore the caller's own identity.

- **Roles:** any caller with an active session.
- **Request:** —
- **Response:** `204`.
- **Errors:**
  - `401` caller is not authenticated
- **Rules:**
  - **Idempotent** — calling it with no active session also returns `204`, so a client that has lost track of state can always return to a known-good position without handling an error.

### `GET /api/v1/auth/view-as/candidates`
The picker's list of users the caller may act as.

- **Roles:** Site Admin, Org Admin. All other roles receive `403`.
- **Request:** query parameters:
  - `search` optional — case-insensitive substring over first name, last name and email
- **Response:** `200`: a list already filtered to what the caller is permitted to target, so the client never has to reproduce the authorization rules:
  - for Site Admin, every organization's active users, **grouped by organization**, excluding other Site Admins
  - for Org Admin, active users of their own organization only
  - each entry carries `userId`, `firstName`, `lastName`, `email`, `role`, `status`, and `organizationId` / `organizationName`
- **Errors:**
  - `403` any role other than Site Admin or Org Admin
- **Rules:**
  - **Order:** organization title, then organization id, then last name, first name and email; accounts with no organization come last (`SPEC/decisions.md`, 2026-10-01, "The View As candidate order, and F1 closes").
  - `Inactive` users may be returned so the picker can show them greyed out, but are never valid targets for `POST /api/v1/auth/view-as`; the server refuses them regardless of what the list displayed.

### Effect on `GET /api/v1/auth/me`
- While a session is active, `GET /api/v1/auth/me` returns the **impersonated** user's summary — this is what makes every existing client surface render as the target sees it — plus:
  - `viewingAs` — object present only during an active session, carrying `realUserId`, `realUserName`, `startedAtUtc` and `expiresAtUtc`
- The client renders the persistent banner from this field rather than from remembered local state. Why: a session that has expired or been ended server-side cannot leave a stale banner on screen.

### Expiry
- A session ends after **30 minutes idle** or **2 hours absolute**, whichever comes first, enforced server-side (`SPEC/20-feature-view-as.md` rules 17-19).
- Expiry restores the real identity; it does **not** sign the caller out, so requests after expiry succeed as the real user rather than returning `401`.
- Clients detect the transition by `viewingAs` disappearing from `GET /api/v1/auth/me`, not by an error status.

### Site Admin org-content mutations are refused
- A Site Admin acting as themselves receives `403` from any endpoint that creates, edits or deletes organization-owned content — boards, statuses, idea types, business impacts, custom fields, ideas, comments, tags (`SPEC/20-feature-view-as.md` rules 25-25b). Reads are unaffected.
- The same call succeeds while a View As session is active, because the caller is then acting with the target's role rather than as a Site Admin.
- Organization and user administration are the bootstrap exception and stay available directly (rule 26).
