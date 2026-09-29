# Contracts: users

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## User Contracts

### `POST /api/v1/auth/register`
Self-register a new user account using an organization invite code. Anonymous endpoint.

- **Roles:** Anonymous.
- **Request:**
  - `inviteCode` required string
  - `firstName` required string
  - `lastName` required string
  - `email` required string
  - `password` required string, must satisfy the authentication complexity policy
- **Response:** `201`:
  - `userId`
  - `organizationId`
  - `email`
  - `role`
  - `status`
- **Errors:**
  - `400` request body is malformed or violates field constraints
  - `400` invite code is missing or invalid; response prompts the user to provide a correct invite code
  - `409` the email address is already in use, in any organization. Carries no `errors` bag — the reason is in `detail` — so a client keys it onto the `email` field itself. See the known open risk below before changing this
  - `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")
- **Rules:**
  - the invite code determines the organization the user is associated with
  - the created user receives role `User` and status `Active`
  - registration against an archived organization is rejected as an invalid invite code
  - an email address that is already registered — in **any** organization, since `normalized_email` is globally unique — is refused with `409 Conflict`, `detail` `"Email is already in use."`
  - the password is validated **before** the email is looked up, so a probe costs a request carrying a policy-valid password rather than any request at all
  - **Known open risk: this endpoint is an account-enumeration oracle, and the `409` is not what makes it one.**
    - A caller holding a valid invite code — a standing, non-expiring credential printed on an admin screen — can determine whether **any** email address has an account by registering it: free answers `201`, taken answers a refusal.
    - Because `users.normalized_email` is globally unique the check spans **every tenant**, not the organization the invite code names, so the oracle covers other organizations' users and Site Admins alike, and the caller never signs in.
    - Hiding the status does not close this. It was tried on 2026-09-10 — the `409` was replaced with a generic field-keyed `400` — and reverted on 2026-09-11, because `201`-vs-`400` is the same per-address boolean as `201`-vs-`409`; the only thing it changed is that a negative probe now created a junk account (`SPEC/decisions.md` 2026-09-11). Do not re-propose a vaguer message as the mitigation.
    - **What actually bounds it today:** the per-IP rate limit on this route, and nothing else.
    - **What would close it:** an asynchronous verify-by-email registration flow, where the response is identical whether or not the address was free and the outcome is delivered to whoever owns the mailbox. That is a feature, not a wording change, and it is not built.

### `GET /api/v1/organizations/{organizationId}/users`
List users within an organization with pagination.

- **Roles:** — (not stated; the `403` is under Errors).
- **Request:** query parameters:
  - `page`
  - `pageSize`
  - `search` optional
  - `role` optional
  - `status` optional `Active` or `Inactive`
  - `sortBy` optional `lastName`, `email`, or `createdAt`
  - `sortDirection` optional `asc` or `desc`
- **Response:** `200` paged item shape:
  - `userId`
  - `organizationId`
  - `firstName`
  - `lastName`
  - `email`
  - `role`
  - `status`
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to list users in this organization
  - `404` organization does not exist or is outside caller scope
- **Rules:** —

### `GET /api/v1/organizations/{organizationId}/members`
Minimal list of an organization's active members (id, name, email only) for the idea assignee picker and mention lookup.

- **Roles:** unlike the admin user listing above, any authenticated caller scoped to the organization — a plain User or Read Only, not only admins (SPEC/20-feature-ideas-and-engagement.md Permissions).
- **Request:** —
- **Response:** `200` array item shape:
  - `userId`
  - `firstName`
  - `lastName`
  - `email`
- **Errors:**
  - `401` caller is not authenticated
  - `404` organization does not exist or is outside caller scope
- **Rules:**
  - Returns a plain array (no pagination); only `Active` members are included.

### `POST /api/v1/organizations/{organizationId}/users`
Create a user within an organization.

- **Roles:** — (not stated; the `403` is under Errors).
- **Request:**
  - `firstName` required string
  - `lastName` required string
  - `email` required string
  - `role` required string
  - `initialPassword` required string
  - `status` optional, defaults to `Active`
- **Response:** `201`:
  - `userId`
  - `organizationId`
  - `email`
  - `role`
  - `status`
- **Errors:**
  - `400` request body is malformed or violates field constraints
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to create users in this organization
  - `404` organization does not exist or is outside caller scope
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/users/import`
Bulk-create users in an organization from an uploaded CSV file.

- **Roles:** Site Admin may import into any organization; Org Admin only into their own.
- **Request:**
  - `multipart/form-data`
  - field `csvFile` required
  - CSV columns:
    - `firstName` required
    - `lastName` required
    - `email` required
    - `role` optional, defaults to `User`
    - no invite code column; every created user is associated with the organization in the route
- **Response:** `200`:
  - `createdCount`
  - `rejectedCount`
  - `rows` per-row outcome list with `rowNumber`, `email`, `outcome`, `error` nullable, and `temporaryPassword` for created rows
- **Errors:**
  - `400` file is missing, malformed, or not a valid CSV, or it exceeds 5,000 rows
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to create users in this organization
  - `404` organization does not exist or is outside caller scope
  - `413` the request body exceeds 5 MB; the pipeline refuses it before it reaches the handler
- **Rules:**
  - each created user receives a system-generated temporary password and must change it on first login
  - rows with invalid data or duplicate emails are rejected individually without failing the whole import
  - **Bounded (added 2026-09-10):** the request body is capped at **5 MB** and the parsed file at **5,000 data rows**, the same two bounds and the same messages as the idea import (`POST /api/v1/boards/{boardId}/ideas/import` in [`contracts/ideas.md`](ideas.md)).
    - Both are checked before any per-row work, since the upload is buffered whole and re-materialised as records before the first row is processed.
    - A file over either bound is rejected in full — no partial import.
    - The two answer differently, according to where the upload is stopped: the body limit is enforced at the request pipeline, before the handler runs, and answers `413`; the row ceiling is the handler's own and answers the field-keyed `400`.
    - Why: this endpoint had no bound at all until now, which was an oversight rather than a policy difference: the body buffers into the serving process's heap, so one request could exhaust it

### `GET /api/v1/users/{userId}`
Return user detail.

*Roles, response and error details written 2026-09-29 from the code (slice 124, `SPEC/decisions.md`
2026-09-29 "Contracts and wording written from the code"): `UserService.getById`. It agrees with
every `tools/golden/fixtures/users.get.*` fixture.*

- **Roles:** a Site Admin, for any user; an Org Admin, for users of their own organization. User and
  Read Only are refused.
- **Request:** —
- **Response:** `200`:
  - `userId`
  - `organizationId` — `null` for a user who belongs to no organization (a Site Admin)
  - `firstName`
  - `lastName`
  - `email`
  - `role`
  - `status`
  - `mustChangePassword` boolean
  - `createdAtUtc` timestamp
  - `updatedAtUtc` timestamp
- **Errors:**
  - `401` caller is not authenticated
  - `403` `"You are not allowed to manage this user."` for a User or Read Only caller, when the user
    exists
  - `404` `"User not found."` when the user does not exist, or, for an Org Admin, belongs to
    another organization
  - `404` with no message of its own for an id that is not a GUID — the route refuses it before
    any lookup
- **Rules:** The same shape is the `200` of `PUT /api/v1/users/{userId}`.

### `PUT /api/v1/users/{userId}`
Update user profile, role, or status within the caller's authorized scope.

- **Roles:** — (not stated; the `403` is under Errors).
- **Request:**
  - `firstName` required string
  - `lastName` required string
  - `email` required string
  - `role` required string
  - `status` required string
- **Response:**
  - `200` updated user detail
- **Errors:**
  - `400` request body is malformed or violates field constraints
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to update this user
  - `404` user does not exist or is outside caller scope
- **Rules:** —
