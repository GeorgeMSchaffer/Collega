# Contracts

## Purpose
Defines the system contracts that implementations must follow.

## Contract Authorship Rule
- Canonical contract behavior is authored in this file and related canonical `SPEC/20-feature-*.md` docs.
- Contract tests verify the API surface directly against the canonical documents under `SPEC`.
- Do not introduce API behavior without corresponding canonical updates in `SPEC`.

## Route Conventions
- HTTP APIs use path versioning under `/api/v1`.
- Resource routes use plural nouns.
- Nested routes are allowed when needed to express parent-child ownership clearly.

## MVP Boundary For External Auth
- MVP contract conformance does not require OAuth or SAML endpoints.
- OAuth/OIDC endpoints are planned for post-MVP Phase 2.
- SAML endpoints are planned for a post-OAuth phase.
- Until those phases begin, `/api/v1/auth/*` contracts are limited to local credential and password-management flows defined in this document.

## Error Envelope
- All non-2xx responses use a problem-details-style payload.
- Standard fields are `type`, `title`, `status`, `detail`, and `instance`.
- Validation failures may include an additional `errors` object keyed by field name.

## Standard Error Responses
- `400 Bad Request`: request JSON is malformed, required fields are missing, field values violate contract constraints, or the request shape is otherwise invalid.
- `401 Unauthorized`: the caller is not authenticated or the authentication token is missing, expired, or invalid.
- `403 Forbidden`: the caller is authenticated but not permitted to perform the requested action in the current scope.
- `404 Not Found`: the targeted resource does not exist or is not visible within the caller's authorized scope.

## Collection Conventions
- Organization, user, idea, and comment list endpoints support pagination in MVP.
- Smaller configuration collections such as statuses, boards, and tags may return full result sets unless a feature-specific contract says otherwise.
- Paginated collections support basic filtering plus one explicit sort field and sort direction.
- Archived organizations are hidden from list results by default unless explicitly filtered with `isArchived=true` or an equivalent include-archived flag.

## Update Conventions
- MVP update operations use last-write-wins behavior unless a feature-specific contract defines a stronger rule.

## Validation Ownership
- The API contract validates request shape, required fields, and basic field constraints.
- The Application and Domain layers enforce business rules, authorization rules, and cross-entity invariants.

## Validation Message Conventions
- API validation messages follow these canonical templates:
	- Required: `<FieldName> is required.`
	- Max length: `<FieldName> must be <N> characters or fewer.`
	- Min length: `<FieldName> must be at least <N> characters.`
	- Invalid format: `<FieldName> must be a valid <FormatName>.`
	- Invalid enum value: `<FieldName> must be one of: <Value1>, <Value2>, <Value3>.`
	- Numeric or date range: `<FieldName> must be between <Min> and <Max>.`
	- Mention resolution: `Mention '<Value>' could not be resolved to a user in your organization.`
- Validation failures use the `errors` object keyed by request field names.
- UI should mirror API validation wording where practical to reduce interpretation drift.
- **Casing (Resolved 2026-08-07)**: the `errors` object *keys* are camelCase to match wire JSON field names (e.g. `"firstName"`). The `<FieldName>` substituted into message *text* is separate and uses human-readable, spaced Title Case (e.g. `"First Name is required."`, `"Email is required."`), not the raw camelCase or PascalCase property name. This applies to every validation template in this section.

## Shared Data Rules
- Identifiers are GUID strings.
- Timestamps are UTC ISO-8601 strings.
- Enum values are serialized as strings.
- Paginated responses use:
	- `items`
	- `page`
	- `pageSize`
	- `totalCount`
	- `sortBy`
	- `sortDirection`
- User and organization text fields are trimmed before validation and persistence.
- First and last name maximum length is 100 characters.
- Company name maximum length is 200 characters.
- Address maximum length is 200 characters.
- City maximum length is 100 characters.
- State maximum length is 50 characters.
- Zip maximum length is 20 characters.
- Phone maximum length is 25 characters.
- Comment body maximum length is 2000 characters and supports plain text with line breaks only.

## Authentication Contracts

### Access Token Format and Session Revocation (Resolved 2026-08-07)
`accessToken` is a signed JWT, not an opaque server-tracked token. Every `User` has a server-side `SecurityStamp` (a random value regenerated whenever sessions must be invalidated). Each issued JWT embeds the `SecurityStamp` value current at issuance time as a claim. `GET /api/v1/auth/me` and every authenticated request revalidate the JWT's embedded `SecurityStamp` claim against the User's current `SecurityStamp` in the database — a mismatch is treated as an invalid/expired token (`401`), exactly like an expired JWT. "Revoke all existing sessions" (self-service and admin-issued password reset, `SPEC/20-feature-auth.md` requirements #29 and the self-service reset acceptance criteria) is implemented by regenerating `User.SecurityStamp`, which immediately invalidates every previously issued token for that user without needing a token blocklist or session table.

Access tokens expire absolutely 480 minutes after issuance, so a successful login returns `expiresInSeconds: 28800`. Deployments may override the lifetime through `Auth:AccessTokenLifetimeMinutes` (environment variable `Auth__AccessTokenLifetimeMinutes`). The browser independently enforces a 30-minute inactivity deadline, warns at minute 28 with a two-minute countdown, and synchronizes activity and logout/expiry across tabs. Staying signed in resets only browser inactivity and never changes `expiresInSeconds` or the JWT expiry. Idle or absolute expiry clears client authentication and navigates to `/login?sessionExpired=true`; explicit logout and successful password changes do not use that query state.

### Mandatory Password Rotation Gate (Resolved 2026-08-11, Sprint 4)
While a user's persisted `MustChangePassword` is true, the API refuses every authenticated endpoint except a fixed allowlist, returning `403` with the standard problem-details envelope. The allowlist is `GET /api/v1/auth/me` (the client needs it to render the change screen) and `POST /api/v1/auth/change-password` (the only way out). Anonymous endpoints — login, register — are unaffected, since an unauthenticated caller owes no rotation.

Rules:
- the flag is read from live persisted state on each request, not from a claim baked into the token at issuance, so completing the rotation lifts the restriction on the very next request without reissuing a token
- login still succeeds and still returns a token plus `requiresPasswordChange: true`; the token is simply scoped to the allowlist until the rotation is done
- the allowlist is opt-in per endpoint — a newly added endpoint is refused during rotation unless it is explicitly marked
- this is a server-side gate. The Blazor client's own `mustChangePassword` routing is a UX convenience layered on top of it and is not the enforcement point

Before this gate, the rule was enforced only client-side: the issued token was valid everywhere, so a caller holding an admin-issued temporary password could skip the rotation entirely by calling the API directly and continue on a credential the issuing admin still knew.

### Rate limiting on the authentication surface

`POST /api/v1/auth/login`, `POST /api/v1/auth/register` and `POST /api/v1/auth/change-password` are limited **per caller IP and per route** — each keeps its own counter, so spending the register allowance does not close login. The limits are 10 requests per minute (20 on login) and 100 per hour. Exceeding either answers `429` with the standard problem-details envelope, `type` `https://collega.dev/problems/too-many-requests`, and a `Retry-After` header in seconds. This is the same `429` shape the AI assist endpoints already use for their own limits.

`Retry-After` is the **only** rate-limit header sent, and it is also the only thing on the wire that separates this `429` from the one a locked-out account produces — those two carry the same `type`, the same `title`, and differ only in `detail`, which is prose. A client that must tell "this address has asked too often" from "this account is locked after five failed attempts" reads the header's presence: the lockout sends none. They are deliberately distinct refusals — one is about a caller's volume, the other about one account's failed attempts — and `apps/web` depends on telling them apart, because only one of them means the password was wrong. No `X-RateLimit-*` headers are exposed: the library's are suffixed with the internal bucket names, which are not contract surface. Adding unsuffixed ones is a change to make here first.

Two properties clients must not read more into than is there. The caller IP is taken from `x-forwarded-for` **only when the process is running on Vercel**, which overwrites that header with the real client address; anywhere else the socket address is used, so a self-hosted run cannot be steered by a caller-supplied header. And the counters live in the serving process, which on serverless is neither shared between concurrent instances nor preserved across cold starts — the limit bounds volume, it is not a guarantee of an exact ceiling. A shared store is what would make it one.

This does **not** replace the account lockout below, and does not prevent it: five failed attempts still lock an account, and five is below any limit that lets real people sign in.

**Known open risk, following directly from that sentence: the lockout is an anonymous denial of service.** Five failed sign-ins against a known email address lock that account for 15 minutes, repeatable indefinitely, from a caller who holds no account, no invite code and no session. Bounding it needs a per-IP failed-attempt counter, and that needs state outliving a request — either a schema change (frozen at S0.2) or the shared store the rate limiter above already needs to be a real ceiling. Tracked, deliberately not fixed: `SPEC/decisions.md` 2026-09-11.

### `POST /api/v1/auth/login`
Purpose: Authenticate a user with globally unique email credentials.

Request body:
- `email` required string
- `password` required string

**Session transport (decision `08`, 2026-09-04).** The Nest host issues the session as an
**httpOnly cookie** named `collega_session`, not as a bearer token in the body: `Secure`,
`SameSite=Lax`, `Path=/`. The client never reads it and never sets an `Authorization` header, which
is what keeps `apps/web` a pure client. Cleared on logout and on View As start and exit.

This document said nothing about cookies until 2026-09-08, which is how the frozen .NET API
(bearer) and the Nest host (cookie) came to disagree with nothing forcing the question. The body is
otherwise unchanged. The `accessToken` field the .NET API returned is **gone**: issuing it
alongside the cookie would hand the token back to JavaScript and defeat the point of `httpOnly`.
One golden fixture records that field and will diff against Nest until it is re-recorded — the
single known cost of this decision, and cheaper than the alternative.

Success response `200` authenticated — the body carries **no token**; the cookie above is the
session:
- `expiresInSeconds` integer; `28800` under the canonical 480-minute configuration
- `requiresPasswordChange` boolean
- `user`
	- `userId` GUID string
	- `organizationId` GUID string or `null` for Site Admin
	- `role` string
	- `firstName` string
	- `lastName` string
	- `email` string
	- `status` string

Error responses:
- `401` invalid credentials
- `403` inactive account
- `429` locked out after 5 failed attempts within 15 minutes
- `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")

### `GET /api/v1/auth/me`
Purpose: Return the currently authenticated user summary.

Success response `200`:
- `userId`
- `organizationId`
- `organizationTitle` string or `null` — the organization's display title
- `role`
- `firstName`
- `lastName`
- `email`
- `status`
- `portraitDataUrl` string or `null`
- `viewingAs` object or `null` — populated while a View As session is live

`portraitDataUrl` and `viewingAs` were missing from this document until 2026-09-09 and are **not**
optional: every recorded fixture carries them, and the client depends on `viewingAs` to render the
effective role during impersonation. Verified against `tools/golden/fixtures/auth.me.*`.

`organizationTitle` was added 2026-09-10 (`SPEC/decisions.md`) so the client can name the
organization from the one call it already makes per request. `null` means the caller belongs to no
organization — a Site Admin, whose surfaces read "All organizations" — and nothing else: a caller
with an `organizationId` always has a string here. It is **not** a fallback for a title that could
not be resolved, and clients must keep the two cases apart. This shape is shared by every response
that returns an authenticated user summary: `POST /auth/login` (under `user`), `PUT /auth/me`,
`PUT`/`DELETE /auth/me/portrait`, and both identities on `POST /auth/view-as`.

Error responses:
- `401` caller is not authenticated

### `PUT /api/v1/auth/me`
Purpose: Update the currently authenticated user's editable profile fields.

Request body:
- `firstName` required string, max 100 characters
- `lastName` required string, max 100 characters

Both fields are trimmed before persistence. Email, role, organization, and status cannot be changed through this endpoint.

Success response `200`:
- updated authenticated user summary using the same shape as `GET /api/v1/auth/me`

Error responses:
- `400` missing or invalid name fields
- `401` caller is not authenticated or the authenticated user cannot be resolved

### `POST /api/v1/auth/change-password`
Purpose: Change the current user's password, including the first-login Site Admin password change.

Request body:
- `currentPassword` required string
- `newPassword` required string

Success response:
- `204 No Content`

Error responses:
- `400` invalid password policy
- `401` invalid current password
- `403` caller is authenticated but not allowed to change the password in the current state
- `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")

### `POST /api/v1/users/{userId}/temporary-password`
Purpose: MVP/P1 admin-issued temporary password reset.

Request body:
- empty body or implementation-defined admin note

Success response `200`:
- `temporaryPassword` string
- `mustChangePassword` boolean

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to issue a temporary password for the target user
- `404` target user does not exist or is outside caller scope

Behavior rules:
- the temporary password is displayed one time only
- the temporary password expires after 24 hours if unused
- the user must change the password on first successful use

### `POST /api/v1/auth/password-reset/request`
Purpose: Post-MVP anonymous request for a self-service password-reset email.

Request body:
- `email` required string, valid email format

Success response `202 Accepted`:
- `message` string with the same generic wording for every syntactically valid request

Behavior rules:
- only active accounts with local-password credentials are eligible, including Site Admin and organization users
- unknown, inactive, external-only, throttled, and eligible emails receive the same response
- eligible requests send an unlinked anonymous reset-page URL containing a cryptographically random bearer token
- issuing a new token invalidates every prior token for the account
- the token expires after 24 hours and is single-use
- delivery is limited to 3 requests per normalized email and 10 requests per source IP in a rolling 15-minute window
- requests above either limit return the generic success response without sending an email
- token values are not persisted in plaintext or included in logs, audit metadata, analytics, or responses

Error responses:
- `400` malformed request body, missing email, or invalid email format

### `POST /api/v1/auth/password-reset/confirm`
Purpose: Post-MVP anonymous completion of a self-service password reset using the emailed token.

Request body:
- `token` required string
- `newPassword` required string
- `confirmPassword` required string

Success response:
- `204 No Content`

Behavior rules:
- `newPassword` and `confirmPassword` must match
- the new password must satisfy the existing authentication complexity policy
- invalid, expired, superseded, and used tokens return the same invalid-link failure
- a successful reset consumes the token and revokes all existing sessions for the account
- the response does not authenticate the user; the client shows confirmation and returns to Login
- token and plaintext password values are not persisted or included in logs, audit metadata, analytics, or error responses

Error responses:
- `400` malformed request, password mismatch, password-policy failure, or invalid-link failure

## View As Contracts

Canonical behavior: `SPEC/20-feature-view-as.md`. Impersonation is a **server-side session**, never a claim in the access token — the token continues to identify only the real user, and is not reissued to start or end a session. A captured token therefore never carries impersonation authority.

While a session is active, every other endpoint in this document behaves as though the **impersonated** user were the caller: organization scoping, role checks and returned data are all the target's. The endpoints below are the only ones that operate on the real actor's identity while a session is active.

Only `Active` users are valid targets. The design comp labels a demo account "suspended"; the domain has no such status — read it as `Inactive` (`SPEC/20-feature-view-as.md` rule 10).

### `POST /api/v1/auth/view-as`
Purpose: Start acting as another user.

Actors: Site Admin (any active org-scoped user, any organization); Org Admin (active users in own organization only). All other roles are refused.

Request body:
- `targetUserId` required GUID

Success response `200`:
- `impersonating` — the target's authenticated user summary, same shape as `GET /api/v1/auth/me`
- `realUser` — the caller's own summary, same shape
- `startedAtUtc`
- `expiresAtUtc` — the absolute cap (2 hours from start)

Error responses:
- `400` missing or malformed `targetUserId`
- `401` caller is not authenticated
- `403` caller's role may not impersonate, or may not impersonate this target — an Org Admin naming a user outside their organization, anyone naming a Site Admin (D-SCOPE), or any caller naming an `Inactive` user. All three return the same `403` and the same message, so the endpoint does not disclose whether a given user exists or what role they hold.
- `404` no user with that id
- `409` a session is already active for this caller — sessions are **non-nestable** and are never silently replaced. Exit first.

### `DELETE /api/v1/auth/view-as`
Purpose: Stop acting as another user and restore the caller's own identity.

Actors: any caller with an active session.

Success response `204`.

**Idempotent** — calling it with no active session also returns `204`, so a client that has lost track of state can always return to a known-good position without handling an error.

Error responses:
- `401` caller is not authenticated

### `GET /api/v1/auth/view-as/candidates`
Purpose: The picker's list of users the caller may act as.

Actors: Site Admin, Org Admin. All other roles receive `403`.

Query parameters:
- `search` optional — case-insensitive substring over first name, last name and email

Success response `200`: a list already filtered to what the caller is permitted to target, so the client never has to reproduce the authorization rules:
- for Site Admin, every organization's active users, **grouped by organization**, excluding other Site Admins
- for Org Admin, active users of their own organization only

Each entry carries `userId`, `firstName`, `lastName`, `email`, `role`, `status`, and `organizationId` / `organizationName`. `Inactive` users may be returned so the picker can show them greyed out, but are never valid targets for `POST /api/v1/auth/view-as`; the server refuses them regardless of what the list displayed.

### Effect on `GET /api/v1/auth/me`
While a session is active, `GET /api/v1/auth/me` returns the **impersonated** user's summary — this is what makes every existing client surface render as the target sees it — plus:
- `viewingAs` — object present only during an active session, carrying `realUserId`, `realUserName`, `startedAtUtc` and `expiresAtUtc`

The client renders the persistent banner from this field rather than from remembered local state, so a session that has expired or been ended server-side cannot leave a stale banner on screen.

### Expiry
A session ends after **30 minutes idle** or **2 hours absolute**, whichever comes first, enforced server-side (`SPEC/20-feature-view-as.md` rules 17-19). Expiry restores the real identity; it does **not** sign the caller out, so requests after expiry succeed as the real user rather than returning `401`. Clients detect the transition by `viewingAs` disappearing from `GET /api/v1/auth/me`, not by an error status.

### Site Admin org-content mutations are refused

A Site Admin acting as themselves receives `403` from any endpoint that creates, edits or deletes organization-owned content — boards, statuses, idea types, business impacts, custom fields, ideas, comments, tags (`SPEC/20-feature-view-as.md` rules 25-25b). Reads are unaffected.

The same call succeeds while a View As session is active, because the caller is then acting with the target's role rather than as a Site Admin. Organization and user administration are the bootstrap exception and stay available directly (rule 26).

## Organization Contracts

### `GET /api/v1/organizations`
Purpose: List organizations for Site Admin with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `isArchived` optional boolean
- `sortBy` optional `companyName` or `createdAt`
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `organizationId`
- `title`
- `description`
- `inviteCode`
- `city`
- `state`
- `phone`
- `logoThumbnailUrl` nullable string
- `isArchived`

Default list behavior:
- archived organizations are excluded unless explicitly filtered in

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to list organizations

### `POST /api/v1/organizations`
Purpose: Create an organization, generate its invite code, and provision default statuses plus one default board.

Request body:
- `title` required string
- `description` required string
- `logoUrl` optional string

Optional profile fields:
- `address` optional string
- `city` optional string
- `state` optional string
- `zip` optional string
- `phone` optional string
- `primaryContactFirstName` optional string
- `primaryContactLastName` optional string

Success response `201`:
- `organizationId`
- `inviteCode`
- `defaultBoardId`
- `defaultStatusCount`

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create organizations

### `GET /api/v1/organizations/{organizationId}`
Purpose: Return organization detail.

Response fields also include:
- `inviteCode`
- `logoUrl` nullable string
- `logoThumbnailUrl` nullable string
- `logoHeightPx` nullable integer, max rendered value `150`
- `aiKeyConfigured` boolean indicating whether this organization has its own AI API key stored
- `aiKeyLastFour` nullable string, the last four characters of the stored key, null when `aiKeyConfigured` is false
- `aiKeyUpdatedAtUtc` nullable timestamp
- `aiKeyUpdatedByUserId` nullable GUID string

The stored AI API key value itself is never returned by this or any other endpoint. The three `aiKey*` metadata fields are omitted entirely for callers whose role is `User` or `Read Only`.

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to view this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}`
Purpose: Update organization detail.

Request body:
- same fields as organization create

Success response:
- `200` updated organization detail

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/logo`
Purpose: Upload or replace an organization logo.

Request body:
- `multipart/form-data`
- field `logoFile` required

Behavior rules:
- exactly one active logo per organization
- new upload replaces previous logo atomically
- return thumbnail metadata for immediate preview
- rendered usage in UI is constrained to max height `150px` while preserving aspect ratio

Success response `200`:
- `logoUrl`
- `logoThumbnailUrl`
- `logoHeightPx`

Error responses:
- `400` request body is malformed or violates file constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/invite-code/regenerate`
Purpose: Regenerate the organization invite code, invalidating the previous code.

Success response `200`:
- `inviteCode`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/archive`
Purpose: Archive an organization without hard deletion.

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to archive this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/ai-key`
Purpose: Set or rotate the organization's own AI API key, overriding the deployment default key for all AI calls made in this organization's scope.

Request body:
- `aiApiKey` required string, max 500 characters, trimmed before validation

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- the submitted key is validated with a single low-cost model call before persistence
- a key that fails validation is rejected and any previously stored key is left untouched
- the key is encrypted at rest and is never returned by this or any other endpoint
- replaces any previously stored key for this organization atomically
- generates an audit event recording the acting user and never the key value

Success response `200`:
- `aiKeyConfigured` boolean, always `true`
- `aiKeyLastFour`
- `aiKeyUpdatedAtUtc`
- `aiKeyUpdatedByUserId`

Error responses:
- `400` request body is malformed, violates field constraints, or the key failed provider validation
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `DELETE /api/v1/organizations/{organizationId}/ai-key`
Purpose: Clear the organization's own AI API key, returning the organization to the deployment default key.

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- succeeds idempotently when no key is currently stored
- generates an audit event recording the acting user

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

## User Contracts

### `POST /api/v1/auth/register`
Purpose: Self-register a new user account using an organization invite code. Anonymous endpoint.

Request body:
- `inviteCode` required string
- `firstName` required string
- `lastName` required string
- `email` required string
- `password` required string, must satisfy the authentication complexity policy

Behavior rules:
- the invite code determines the organization the user is associated with
- the created user receives role `User` and status `Active`
- registration against an archived organization is rejected as an invalid invite code
- an email address that is already registered — in **any** organization, since `normalized_email` is globally unique — is refused with `409 Conflict`, `detail` `"Email is already in use."`
- the password is validated **before** the email is looked up, so a probe costs a request carrying a policy-valid password rather than any request at all

**Known open risk: this endpoint is an account-enumeration oracle, and the `409` is not what makes it one.** A caller holding a valid invite code — a standing, non-expiring credential printed on an admin screen — can determine whether **any** email address has an account by registering it: free answers `201`, taken answers a refusal. Because `users.normalized_email` is globally unique the check spans **every tenant**, not the organization the invite code names, so the oracle covers other organizations' users and Site Admins alike, and the caller never signs in.

Hiding the status does not close this. It was tried on 2026-09-10 — the `409` was replaced with a generic field-keyed `400` — and reverted on 2026-09-11, because `201`-vs-`400` is the same per-address boolean as `201`-vs-`409`; the only thing it changed is that a negative probe now created a junk account (`SPEC/decisions.md` 2026-09-11). Do not re-propose a vaguer message as the mitigation.

**What actually bounds it today:** the per-IP rate limit on this route, and nothing else. **What would close it:** an asynchronous verify-by-email registration flow, where the response is identical whether or not the address was free and the outcome is delivered to whoever owns the mailbox. That is a feature, not a wording change, and it is not built.

Success response `201`:
- `userId`
- `organizationId`
- `email`
- `role`
- `status`

Error responses:
- `400` request body is malformed or violates field constraints
- `400` invite code is missing or invalid; response prompts the user to provide a correct invite code
- `409` the email address is already in use, in any organization. Carries no `errors` bag — the reason is in `detail` — so a client keys it onto the `email` field itself. See the known open risk above before changing this
- `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")

### `GET /api/v1/organizations/{organizationId}/users`
Purpose: List users within an organization with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `role` optional
- `status` optional `Active` or `Inactive`
- `sortBy` optional `lastName`, `email`, or `createdAt`
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `userId`
- `organizationId`
- `firstName`
- `lastName`
- `email`
- `role`
- `status`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to list users in this organization
- `404` organization does not exist or is outside caller scope

### `GET /api/v1/organizations/{organizationId}/members`
Purpose: Minimal list of an organization's active members (id, name, email only) for the idea assignee picker and mention lookup. Unlike the admin user listing above, this is available to any authenticated caller scoped to the organization — a plain User or Read Only, not only admins (SPEC/20-feature-ideas-and-engagement.md Permissions). Returns a plain array (no pagination); only `Active` members are included.

Success response `200` array item shape:
- `userId`
- `firstName`
- `lastName`
- `email`

Error responses:
- `401` caller is not authenticated
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/users`
Purpose: Create a user within an organization.

Request body:
- `firstName` required string
- `lastName` required string
- `email` required string
- `role` required string
- `initialPassword` required string
- `status` optional, defaults to `Active`

Success response `201`:
- `userId`
- `organizationId`
- `email`
- `role`
- `status`

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create users in this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/users/import`
Purpose: Bulk-create users in an organization from an uploaded CSV file. Site Admin may import into any organization; Org Admin only into their own.

Request body:
- `multipart/form-data`
- field `csvFile` required

CSV columns:
- `firstName` required
- `lastName` required
- `email` required
- `role` optional, defaults to `User`
- no invite code column; every created user is associated with the organization in the route

Behavior rules:
- each created user receives a system-generated temporary password and must change it on first login
- rows with invalid data or duplicate emails are rejected individually without failing the whole import
- **Bounded (added 2026-09-10):** the request body is capped at **5 MB** and the parsed file at **5,000 data rows**, the same two bounds and the same messages as the idea import below. Both are checked before any per-row work, since the upload is buffered whole and re-materialised as records before the first row is processed. A file over either bound is rejected in full — no partial import. The two answer differently, according to where the upload is stopped: the body limit is enforced at the request pipeline, before the handler runs, and answers `413`; the row ceiling is the handler's own and answers the field-keyed `400`. This endpoint had no bound at all until now, which was an oversight rather than a policy difference: the body buffers into the serving process's heap, so one request could exhaust it

Success response `200`:
- `createdCount`
- `rejectedCount`
- `rows` per-row outcome list with `rowNumber`, `email`, `outcome`, `error` nullable, and `temporaryPassword` for created rows

Error responses:
- `400` file is missing, malformed, or not a valid CSV, or it exceeds 5,000 rows
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create users in this organization
- `404` organization does not exist or is outside caller scope
- `413` the request body exceeds 5 MB; the pipeline refuses it before it reaches the handler

### `GET /api/v1/users/{userId}`
Purpose: Return user detail.

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to view this user
- `404` user does not exist or is outside caller scope

### `PUT /api/v1/users/{userId}`
Purpose: Update user profile, role, or status within the caller's authorized scope.

Request body:
- `firstName` required string
- `lastName` required string
- `email` required string
- `role` required string
- `status` required string

Success response:
- `200` updated user detail

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this user
- `404` user does not exist or is outside caller scope

## Status Contracts

### `GET /api/v1/organizations/{organizationId}/statuses`
Purpose: List all active and visible statuses for an organization.

Success response `200` item shape:
- `statusId`
- `organizationId`
- `name`
- `isDeleted`

Historical display behavior:
- when a soft-deleted status is surfaced through related entities, the prior name remains visible with an archived or deleted label

### `POST /api/v1/organizations/{organizationId}/statuses`
Purpose: Create a new organization status.

Request body:
- `name` required string
- `color` optional string in `#RRGGBB` format (max 20 chars, but the format is what is enforced); defaults to `#64748B` when omitted — drives the swimlane color dot and idea-card status chip. **Format-checked since 2026-09-10**: it was previously length-checked only, and twenty characters is enough for a working CSS `url()`, which the client renders into a `style` attribute
- `sortOrder` optional integer (organization-level catalog order); appended after the current maximum when omitted

Success response `201`:
- `statusId`
- `name`
- `color`
- `sortOrder`

### `PUT /api/v1/statuses/{statusId}`
Purpose: Rename or update a status.

Request body:
- `name` required string
- `color` optional string in `#RRGGBB` format (max 20 chars, but the format is what is enforced)
- `sortOrder` optional integer

### `POST /api/v1/organizations/{organizationId}/statuses/reorder`
Purpose: Replace the complete active-status order atomically.

Request body:
- `orderedStatusIds` required array containing every active organization status ID exactly once

Success response:
- `204 No Content`

### `DELETE /api/v1/statuses/{statusId}`
Purpose: Soft-delete a status while preserving existing references.

Success response:
- `204 No Content`

## Idea Field Option Contracts

Idea Type and Business Impact collections include active and archived options ordered by `sortOrder`, then `name`.
Site Admin may manage any target organization supplied by route context. Org Admin may manage only their own organization. User and Read Only callers receive `403 Forbidden`.

### `GET /api/v1/organizations/{organizationId}/idea-types`
Purpose: List all Idea Type options for an organization, including archived options.

Success response `200` item shape:
- `ideaTypeId`
- `organizationId`
- `name`
- `sortOrder`
- `isDeleted`

### `POST /api/v1/organizations/{organizationId}/idea-types`
Purpose: Create an active Idea Type at the end of the organization's current option order.

Request body:
- `name` required string, max 100 characters

Success response `201`: Idea Type item shape.

### `PUT /api/v1/idea-types/{ideaTypeId}`
Purpose: Rename an active Idea Type.

Request body:
- `name` required string, max 100 characters

Success response `200`: updated Idea Type item shape.

### `POST /api/v1/organizations/{organizationId}/idea-types/reorder`
Purpose: Replace the complete Idea Type order atomically.

Request body:
- `orderedIdeaTypeIds` required array containing every organization Idea Type ID exactly once, including archived options

Success response:
- `204 No Content`

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Purpose: Soft-delete an Idea Type while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Idea Type.

### `GET /api/v1/organizations/{organizationId}/business-impacts`
Purpose: List all Business Impact options for an organization, including archived options.

Success response `200` item shape:
- `businessImpactId`
- `organizationId`
- `name`
- `color` required `#RRGGBB` string
- `sortOrder`
- `isDeleted`

### `POST /api/v1/organizations/{organizationId}/business-impacts`
Purpose: Create an active Business Impact at the end of the organization's current option order.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format

Success response `201`: Business Impact item shape.

### `PUT /api/v1/business-impacts/{businessImpactId}`
Purpose: Rename or recolor an active Business Impact.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format

Success response `200`: updated Business Impact item shape.

### `POST /api/v1/organizations/{organizationId}/business-impacts/reorder`
Purpose: Replace the complete Business Impact order atomically.

Request body:
- `orderedBusinessImpactIds` required array containing every organization Business Impact ID exactly once, including archived options

Success response:
- `204 No Content`

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Purpose: Soft-delete a Business Impact while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Business Impact.

For both option types, labels are trimmed before persistence and active labels are unique case-insensitively within the same organization and option type. Missing resources return `404 Not Found`; cross-organization access returns `403 Forbidden`.

## Idea-Type Field Contracts

Idea Types scope which User-Defined Fields appear on an idea by **direct mapping**: an Idea Type owns an ordered selection of the organization's existing UDFs, each marked required-or-optional *for that type* (`SPEC/20-feature-idea-type-fields.md`). There is no separate "field set" resource. A type has a **field mode** — `AllActiveFields` (default; shows every active org UDF, global required) or `Curated` (shows only the mapped fields, per-type required). Site Admin may manage any organization supplied by route context; Org Admin only their own; User and Read Only callers receive `403 Forbidden`. The Idea Type list/create/rename/reorder/soft-delete contracts are unchanged (see the Idea Field Option Contracts above); the routes below add field selection, appearance, and reassignment.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/fields`
Purpose: Replace the Idea Type's field selection. Supplying a non-empty selection switches the type to `Curated`; an empty selection clears it back to `AllActiveFields`.

Request body:
- `fields` array of `{ fieldDefinitionId (GUID), displayOrder (int), isRequired (bool) }`; every `fieldDefinitionId` must be an active field definition in the org, and each may appear at most once. The array is authoritative — omitted fields are removed, new ones added, existing ones updated in place.

Success response `204 No Content`. `400` on unknown/archived field or duplicate field in the selection; `404` when the Idea Type does not exist in the organization.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/appearance`
Purpose: Set or clear the Idea Type's badge appearance.

Request body:
- `colorHex` string `#RRGGBB` or `null` to clear (contrast is advisory, not blocking)
- `icon` short token string (emoji or icon key) or `null` to clear

Success response `204 No Content`. `400` when `colorHex` is present and not a valid `#RRGGBB`; `404` when the Idea Type does not exist in the organization.

### `PUT /api/v1/organizations/{organizationId}/ideas/{ideaId}/idea-type`
Purpose: **Admin-only reassignment** of an idea's type (the only path that mutates type after creation). Re-resolves the idea's fields; values for fields not in the new type's resolved set are archived (preserved, hidden), not dropped; an `IdeaTypeReassigned` audit event is emitted.

Request body:
- `ideaTypeId` GUID string — must be an active Idea Type in the same organization

Success response `204 No Content`. `400` when `ideaTypeId` names an unknown or archived type; `403` for non-admin callers; `404` when the idea does not exist in the organization.

> **Note (idea update contract):** idea type is immutable on the normal edit path. `PUT`/update paths for an idea must not change `ideaTypeId`; a request that supplies a differing `ideaTypeId` is rejected with `400`. Type changes go only through the admin reassignment route above. The `POST /api/v1/boards/{boardId}/ideas` create contract's required `ideaTypeId` is unchanged.

## Board Contracts

### `GET /api/v1/organizations/{organizationId}/boards`
Purpose: List boards for an organization.

Success response `200` item shape:
- `boardId`
- `organizationId`
- `name`
- `allowUserStatusUpdate` boolean
- `swimlaneCount`
- `ideaCount` — live ideas on the board, excluding soft-deleted ones, so it matches the `totalCount` of `GET /api/v1/boards/{boardId}/ideas`. Added 2026-09-10: the boards list renders the figure on every card, and without it a client has to issue one idea request per board. This endpoint does not page, so that fan-out is unbounded.

### `POST /api/v1/organizations/{organizationId}/boards`
Purpose: Create a board with at least two swimlanes.

Request body:
- `name` required string
- `allowUserStatusUpdate` required boolean
- `swimlanes` required array of
	- `statusId` GUID string
	- `order` integer

Success response `201`:
- `boardId`
- `name`
- `swimlanes`

### `GET /api/v1/boards/{boardId}`
Purpose: Return board detail including swimlanes.

### `PUT /api/v1/boards/{boardId}`
Purpose: Update board name or selected statuses.

Request body:
- `name` required string
- `allowUserStatusUpdate` required boolean
- `swimlanes` required array of `statusId` and `order`

### `POST /api/v1/boards/{boardId}/swimlanes/reorder`
Purpose: Persist swimlane reorder immediately after drag-and-drop.

Request body:
- `swimlanes` required array of
	- `statusId`
	- `order`

Success response:
- `204 No Content`

## Idea Contracts

### `GET /api/v1/boards/{boardId}/ideas`
Purpose: List ideas on a board with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `statusId` optional
- `tag` optional
- `priority` optional `Low`, `Medium`, `High`, or `Critical`
- `dueBefore` optional date string (`YYYY-MM-DD`)
- `sortBy` optional `createdAt`, `updatedAt`, `upvoteCount`, `priority`, or `dueDate`
- `sortDirection` optional `asc` or `desc`

**Phase filtering (added 2026-09-11, Issues and Delivery Slice 1).** This list is the ideation
board, so it returns only `Discovery`-phase items — an idea that has been promoted to an Issue
drops off it, with no data loss (the row and its ideation `statusId` are retained, and it reappears
here if the Issue is returned to Discovery). There is no query parameter for this; the filter is
unconditional. Delivery-phase items are read through `GET /api/v1/organizations/{orgId}/delivery`,
or through the global `/ideas` list with `phase=Issues`. For an organization that has promoted
nothing every idea is `Discovery`, so this endpoint's response is unchanged.

Success response `200` paged item shape:
- `ideaId`
- `boardId`
- `title`
- `priority` string
- `ideaTypeId` GUID string
- `ideaTypeName` string
- `businessImpactId` GUID string
- `businessImpactName` string
- `businessImpactColor` string
- `dueDate` date string (`YYYY-MM-DD`) or `null`
- `assignees` array with at most five items, ordered by `firstName`, then `lastName`; each item contains `userId`, `firstName`, `lastName`, `displayName`, and `isActive`; clients derive persona initials from the name fields
- `tagNames` string array, ordered alphabetically
- `statusId`
- `statusName`
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer
- `authorUserId`
- `createdAtUtc`

### `GET /api/v1/organizations/{organizationId}/ideas`
Purpose: Cross-board, organization-scoped idea list for the global `/ideas` page (`SPEC/20-feature-client-ui-revisions.md` "Ideas Page"). Scoped to the caller's organization.

Query parameters:
- `page`
- `pageSize`
- `search` optional — all-column search across every column the `/ideas` list displays: the idea **Title**, **Created By** (author first/last/full name), **Assigned To** (any assignee's first/last/full name), and **Status** (status name); it also scans the values of Text/Url User-Defined Fields. When the term is a full ISO date (`YYYY-MM-DD`) it additionally matches the **Created Date** column (ideas created on that UTC calendar day). Matching is case-insensitive substring (`LIKE '%term%'`) except the date term, which matches the whole calendar day.
- `scope` optional `all` (default), `created` (authored by the caller), or `assigned` (assigned to the caller) — the caller's me-chips
- `tag` optional — filter to ideas carrying a tag whose normalized name equals the given value (same normalization/semantics as the board list's `tag`)
- `user` optional GUID — user-association search box: filter to ideas the given user **authored or is assigned to** (`SPEC/Bug Triage.md`). `Guid.Empty` is treated as absent. Composes (AND) with `scope`/`tag`/`search`/`fieldFilters` when combined.
- `sortBy` optional `createdAt` (default), `title`, `createdBy` (author name), `assignedTo` (alphabetically-first assignee's name), or `status` (status name)
- `sortDirection` optional `asc` or `desc` (the page requests `desc` for newest-first). All sorts apply a stable `ideaId` tiebreaker so ordering is deterministic across pages.
- `fieldFilters[<fieldDefinitionId>]=<value>` optional, repeatable — filter by User-Defined Field value (T059). Semantics per field type: `Text`/`Url` contains; `Number` range `<min>:<max>` (either side omittable); `Date` range `<from>:<to>` (ISO-8601, either side omittable); `Boolean` `true`/`false`; `Dropdown` exact option id; `MultiSelect` any-of (matches when the stored option ids include the value). Unknown/invalid `fieldDefinitionId` keys and unparseable values are silently ignored.
- `phase` optional (added 2026-09-11, Issues and Delivery Slice 1) — `All` (**default**), `Ideas` (`Discovery`-phase only), or `Issues` (`Delivery`-phase only). Unrecognised values are treated as `All`. Unlike the board list this defaults to spanning **both** phases: this is the list somebody uses to find an item they cannot see on a board, and hiding promoted ones would lose them. Omitting it therefore leaves the response exactly as it was before the parameter existed.

Success response `200`: same paged item shape as `GET /api/v1/boards/{boardId}/ideas`.

### `GET /api/v1/boards/{boardId}/ideas/export`
Purpose: Export a board's active ideas as CSV (T059/T060).

Success response `200`:
- `Content-Type: text/csv` (UTF-8 with BOM), attachment `ideas.csv`
- Columns: `Title`, `Description`, `Priority`, `Idea Type`, `Business Impact`, `Status`, `Due Date`, `Tags`, then one column per active User-Defined Field (header = field name). Dropdown/MultiSelect values render as option labels.
- **`Discovery`-phase only** (added 2026-09-11), matching the board list above: the export is "this board's ideas", and a file that disagreed with the screen it was exported from would be the bug. Unchanged for any organization that has promoted nothing.

Limits and escaping (added 2026-08-11, Sprint 4):
- **Bounded at 10,000 ideas.** A board above the cap is refused with `400` rather than truncated — a silently short extract is worse than a clear failure for a file people use as a reporting export. The whole dataset is materialised in memory, and the endpoint is reachable by any member including Read Only, so the bound is what keeps it from being a cheap way to pressure the host.
- **Formula-injection guarded.** Any cell whose first non-apostrophe character is `=`, `+`, `-`, `@`, tab, or CR is written with a leading guard apostrophe (CWE-1236). The import strips exactly that guard, so an export → edit → re-import round trip returns the original values unchanged.

Error responses:
- `400` the board holds more ideas than the export supports

### `POST /api/v1/boards/{boardId}/ideas/import`
Purpose: Create-only CSV import of ideas onto a board (T059/T060). Multipart form field `csvFile`.

Behavior:
- Each data row creates a new idea. Required columns: `Title`, `Description`, `Priority`, `Idea Type`, `Business Impact`. `Status` is optional (must name a board swimlane; defaults to the left-most swimlane); `Due Date`, `Tags`, and per-UDF-field columns are optional.
- `Idea Type` and `Business Impact` are matched by name (case-insensitive) against active options; a missing or unknown value rejects that row. Dropdown/MultiSelect UDF columns are matched by option label; Boolean accepts `Yes`/`No` or `true`/`false`.
- Invalid rows are rejected individually with a per-row message; valid rows still import.
- **Bounded (added 2026-08-11, Sprint 4):** the request body is capped at **5 MB** and the parsed file at **5,000 data rows**. Both are checked before any per-row work, since the upload is buffered whole and re-materialised as records before the first row is processed. A file over either bound is rejected in full — no partial import. The body limit is enforced at the request pipeline and answers `413`; the row ceiling is the handler's own and answers the field-keyed `400`.
- A leading guard apostrophe written by the export is stripped on import (see the export contract above), so re-importing an exported file is lossless.

Success response `200`:
- `createdCount` integer
- `rejectedCount` integer
- `rows` array of `{ rowNumber, title, outcome (`Created`/`Rejected`), error }`

Error responses:
- `400` the file is missing/empty, its header lacks the required columns, or it exceeds 5,000 rows
- `413` the request body exceeds 5 MB; the pipeline refuses it before it reaches the handler

### `POST /api/v1/boards/{boardId}/ideas`
Purpose: Create a new idea on a board.

Request body:
- `title` required string, max 150 characters
- `description` required string, max 4000 characters
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the board's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the board's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every user must be active and belong to the board's organization
- `statusId` optional GUID string, defaults to the left-most swimlane when omitted
- `tagNames` optional string array
- `mentionEmails` optional string array

Success response `201`:
- `ideaId`
- `boardId`
- `statusId`
- `title`
- `priority`
- `ideaTypeId`
- `businessImpactId`
- `dueDate`

### `POST /api/v1/boards/{boardId}/ideas/ai-draft`
Purpose: Turn a plain-English description into a pre-filled, unsaved idea draft for review. This endpoint never creates an idea; the client submits the reviewed result to `POST /api/v1/boards/{boardId}/ideas` as normal.

Authorized for the same roles as manual idea creation: Site Admin, Org Admin, and `User`. `Read Only` is rejected with `403`.

Request body:
- `rawInput` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- authenticates with the board organization's own AI API key when configured, otherwise the deployment default key; on organization-key failure the call is retried once against the deployment default key
- the extraction call is constrained to the board organization's active Idea Type and Business Impact options and never receives the organization's user or tag lists
- `description` is produced by backend cleaning of `rawInput`, not by the model
- person, tag, and date mentions returned by the model as raw text are resolved in backend code against active organization users, existing tags, and a date parser
- unambiguous resolutions are returned pre-filled; ambiguous or unresolved mentions and no-signal required fields are returned in `clarifications`
- at most one clarification round is supported; the client resolves the returned questions locally and does not call this endpoint again for the same input

Success response `200`:
- `title` string, max 150 characters
- `description` string, max 4000 characters
- `priority` nullable string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` nullable GUID string
- `businessImpactId` nullable GUID string
- `dueDate` nullable date string (`YYYY-MM-DD`)
- `assigneeUserIds` array of zero to five distinct GUID strings, unambiguous resolutions only
- `tagNames` string array, unambiguous resolutions only
- `inferredFields` string array naming every field populated by inference rather than by unambiguous resolution; the client renders these as "inferred, unconfirmed" until the user interacts with them
- `clarifications` array, empty when nothing needs clarifying

`clarifications` item shape:
- `field` required string: `priority`, `ideaType`, `businessImpact`, `assignee`, `tag`, or `dueDate`
- `kind` required string: `choice` when a required field had no usable signal, or `disambiguation` when a mention matched more than one candidate
- `prompt` required string, the question presented to the user
- `sourceMention` nullable string, the raw input text that could not be resolved, null for `choice`
- `options` required array of `{ value, label }`, sourced from the organization's current active options for `choice` and from the matching candidates for `disambiguation`

Error responses:
- `400` request body is malformed or violates field constraints, including `rawInput` below the minimum length
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create ideas on this board
- `404` board does not exist or is outside caller scope
- `409` AI-assisted creation is not configured: neither an organization key nor a deployment default key is available
- `503` the provider failed after both the organization key and the deployment default key were attempted

`409` and `503` are feature-specific extensions to the standard error responses. The client treats both as recoverable by falling back to the blank manual idea form.

### `POST /api/v1/boards/{boardId}/ideas/ai-polish`
Purpose: Rewrite a draft description on explicit user request. This is the opt-in "Polish with AI" action and is never invoked automatically.

Authorized for the same roles as `ai-draft`.

Request body:
- `description` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- uses the same key precedence and fallback behavior as `ai-draft`
- returns rewritten text only; the caller decides whether to accept it, and no idea is created or modified

Success response `200`:
- `description` string, max 4000 characters

Error responses:
- same set as `POST /api/v1/boards/{boardId}/ideas/ai-draft`

### `GET /api/v1/ideas/{ideaId}`
Purpose: Return full idea detail.

Success response `200`:
- `ideaId`
- `boardId`
- `title`
- `description`
- `priority`
- `ideaTypeId`
- `ideaTypeName`
- `ideaTypeColorHex` string or `null` — the Idea Type's chip colour
- `ideaTypeIcon` string or `null` — the Idea Type's icon name
- `businessImpactId`
- `businessImpactName`
- `businessImpactColor`
- `dueDate`
- `assignees` array using the board-list assignee item shape
- `statusId`
- `statusName`
- `tagNames`
- `mentions`
- `comments` array using the comment item shape from `GET /api/v1/ideas/{ideaId}/comments`, every comment on the idea in chronological order and unpaged
- `fieldValues` array of resolved User-Defined Field values (`fieldDefinitionId`, `fieldName`, `fieldType`, `value`), per `SPEC/20-feature-user-defined-fields.md`
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer
- `author` object using the same assignee item shape, or `null` — who raised the idea
- `createdAtUtc` timestamp

`author` and `createdAtUtc` were added 2026-09-10: the detail header renders "by {author} on
{date}" and had no source for either. `author` is the full persona rather than the bare
`authorUserId` the list item carries, so the name renders without a second request per idea
opened. It is nullable only because `ideas.author_user_id` carries no foreign key; no code path
deletes a user, so a `null` there is data damage rather than an ordinary case to design a label
for.

`ideaTypeColorHex`, `ideaTypeIcon` and `fieldValues` were **missing from this document, not from
the endpoint** — all three have been returned since long before the 2026-09-10 additions above, and
the recorded corpus carries them. Written down 2026-09-10 because a contract that omits fields the
endpoint really answers misleads every reader of it; nothing about the response changed.

There is deliberately **no** `reference` field. The comps show `IDEA-101`, but no reference column
exists and the Prisma schema is frozen at S0.2 — a real reference needs a per-organization
sequence and therefore a schema amendment slice.

`PUT /api/v1/ideas/{ideaId}` answers this same detail shape, and carries both fields with it.

### `PUT /api/v1/ideas/{ideaId}`
Purpose: Update idea content.

Request body:
- `title` required string, max 150 characters
- `description` required string, max 4000 characters
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the idea's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the idea's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every newly selected user must be active and belong to the idea's organization
- `tagNames` optional array of no more than 10 distinct normalized tag names
- `mentionEmails` optional string array
- `effort` optional string: `Low`, `Medium`, or `High` — the optional Discovery-phase effort estimate (added 2026-09-11, Issues and Delivery Slice 1)

**`effort` is three-state, and that is deliberate** — it is the only field on this payload that is.
The key being **absent** means "not provided": the stored estimate is left untouched. An explicit
**`null`** clears it. A **value** sets it. A plain two-state optional (absent reading as `null`, the
way `dueDate` does) would make every client that predates this field silently clear the estimate on
an unrelated edit, and on a promoted Issue that estimate is half of what the promotion gate
recorded. An unrecognised value is a field-keyed `400`.

`effort` may only be set while the idea is in the **`Discovery`** phase. Supplying it for a
`Delivery`-phase item returns `400` keyed on `effort`: effort is chosen at the promotion gate,
alongside `promotedByUserId` and `upvoteCountAtPromotion`, and re-estimating a live Issue is not
modelled in this slice. Omitting the key on an Issue is always valid.

UI behavior contract:
- board cards remain compact and show `title`, `priority`, Business Impact chip, the first three alphabetical `tagNames` plus tag overflow count, the first three ordered `assignees` plus assignee overflow count, viewer-local age derived from `createdAtUtc`, current-user upvote state/count, and comment count.
- selecting the card title opens the Idea Detail drawer (right slide-in; URL gains `?idea={ideaId}`, addressable as `/ideas/{ideaId}`) for full idea editing.
- Idea Detail supports all editable idea fields and collaboration fields.
- selecting the card comment action navigates to Idea Detail and focuses the comment composer.
- description updates are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized description changes return `403 Forbidden`.
- assignee updates replace the complete collection atomically and are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized assignment changes return `403 Forbidden`.
- duplicate assignee IDs, more than five assignee IDs, inactive newly selected users, cross-organization users, or more than 10 distinct tags return `400 Bad Request`.

### `POST /api/v1/ideas/{ideaId}/status`
Purpose: Move an idea to another board status.

Request body:
- `statusId` required GUID string

Success response:
- `204 No Content`

### `DELETE /api/v1/ideas/{ideaId}`
Purpose: Soft-delete an idea while preserving its row and audit history.

Authorization:
- Site Admin within the target resource context
- Org Admin within their own organization

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is not an authorized in-scope admin
- `404` idea does not exist, is already deleted, or is outside caller scope

Query behavior:
- normal board, list, and detail endpoints exclude soft-deleted ideas
- no restore endpoint is exposed in this release

## Delivery Contracts

Added 2026-09-11, Issues and Delivery Slice 1 (`SPEC/20-feature-issues-and-delivery.md`). **An Issue
is not a new resource** — it is the same `ideas` row in its `Delivery` phase, so every route below
addresses an idea by its existing `{ideaId}` and there is no `/issues` root. The Slice 2 Outcome and
Roadmap routes are deliberately absent; nothing here carries an `outcomeId`.

Two refusals are distinct on purpose and must not be collapsed:
- **`409`** — the item is in the wrong phase *for the phase transition itself*: promoting something
  already in `Delivery`, or returning something already in `Discovery`. There is nothing to fix in
  the request; the item has already reached the state being asked for.
- **`400`** — a *delivery operation* on a `Discovery` item (delivery status, sprint assignment,
  tasks). The request names a field that has no meaning until the item is promoted, and the response
  is field-keyed like any other invalid field.

**A `sprintId` in a request body is a `400`, never a `404`.** The route addresses the idea, which
exists; the sprint is a value in the body, so an unknown, deleted, cross-organization or malformed
id is a field-keyed validation failure keyed `sprintId`, exactly as an unknown `ideaTypeId` is on
`PUT /api/v1/ideas/{ideaId}`. Only the path id decides between `200` and `404`.

Cross-organization access answers `404` throughout, never `403` — confirming that a sprint, Issue or
task exists in somebody else's organization is the thing a prober is fishing for.

**A Site Admin acting directly is refused every mutation here with `403`**, and reads it all with
`200`. Promotion, delivery status, sprint management and tasks are organization content under
`SPEC/20-feature-view-as.md` rules 25/25c; View As is the path, and while a View As session is live
the effective role is the target's, so the guard does not fire.

### `POST /api/v1/ideas/{ideaId}/promote`
Purpose: The promotion gate — the explicit, audited decision that flips an idea from `Discovery` to `Delivery`. The row, its ideation `statusId`, its upvotes, its tags and its whole comment thread are retained; nothing is copied and no second object is created.

Authorization: the idea's author, or an in-scope admin. A direct Site Admin is refused.

Request body:
- `effort` **required** string: `Low`, `Medium`, or `High`. There is no default — choosing the size is the point of the gate.
- `sprintId` optional GUID string or `null` — the sprint to promote into. `null` or omitted promotes straight to the delivery backlog. Must name a non-`Completed` sprint in the idea's organization.
- `note` optional string — free text recorded on the promotion audit event only. It is **not** stored on the idea and is not returned by any read.

Behavior:
- sets `phase` to `Delivery` and `deliveryStatus` to `Pending`, and records `effort`, `promotedAtUtc`, `promotedByUserId`, and an `upvoteCountAtPromotion` snapshot read at this moment
- the ideation `statusId` is **never cleared** — it is frozen at its last Discovery value for provenance, and ideation `Complete` and delivery `Complete` remain distinct terminal states
- writes an `IdeaPromotedToIssue` audit event and an `IdeaPromoted` notification to the author and assignees, self-suppressed
- the item leaves the ideation board (which filters to `Discovery`) and appears on the sprint board or backlog

Success response:
- `204 No Content`

Error responses:
- `400` `effort` is missing or not one of the three values (keyed `effort`); `sprintId` names no assignable sprint in this organization, or names a `Completed` one (keyed `sprintId`)
- `401` caller is not authenticated
- `403` caller is neither the author nor an in-scope admin, or is a Site Admin acting directly
- `404` idea does not exist, is deleted, or is outside caller scope
- `409` the idea is already in `Delivery` — `"This idea is already in delivery."`

Authorization is evaluated **before** the phase check, so an unauthorized caller gets `403` even when the item is already promoted: a caller who may not promote must not learn the item's phase.

### `POST /api/v1/ideas/{ideaId}/return-to-discovery`
Purpose: Recover a mis-promotion. Deliberately reversible rather than prevented by a stronger confirm.

Authorization: in-scope admin only — not the author. A direct Site Admin is refused.

Request body: none.

Behavior:
- sets `phase` back to `Discovery` and clears `sprintId` and `deliveryStatus`
- **retains** `effort`, the promotion snapshot (`promotedAtUtc`, `promotedByUserId`, `upvoteCountAtPromotion`) and the Issue's **tasks**, so a re-promote is lossless and the audit trail stays coherent. Tasks are hidden with the checklist, never deleted.
- writes an `IssueReturnedToDiscovery` audit event. No notification.
- the item reappears on its ideation board at the `statusId` it was frozen at

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is not an in-scope admin, or is a Site Admin acting directly
- `404` idea does not exist, is deleted, or is outside caller scope
- `409` the idea is already in `Discovery` — `"This idea is not in delivery."`

### `PUT /api/v1/ideas/{ideaId}/delivery-status`
Purpose: Move an Issue between the five fixed delivery statuses — the sprint board's swimlanes.

Authorization: the idea's author, any Issue assignee, or an in-scope admin. A direct Site Admin is refused. `Read Only` is refused.

Request body:
- `deliveryStatus` required string: `Pending`, `Scoping`, `Development`, `Review`, or `Complete`. The set is fixed in this slice and not org-configurable.

Behavior:
- **any status may follow any other.** The board is a kanban and dragging backwards is a normal correction, not an invariant violation.
- **outstanding tasks never block `Complete`.** The UI warns; the API permits. Enforcing "all tasks done" would make the checklist a gate, which this feature explicitly refuses.
- re-applying the status the Issue already has is a no-op: no audit event, no notification
- otherwise writes an `IssueDeliveryStatusChanged` audit event and a notification of the same name to the author and assignees, self-suppressed

Success response:
- `204 No Content`

Error responses:
- `400` `deliveryStatus` is missing or not one of the five (keyed `deliveryStatus`); **or the idea is still in `Discovery`** — keyed `deliveryStatus`, `"A delivery status applies only to a promoted idea."` This is a `400` and not the `409` a wrong-phase promotion gets: see the section preamble.
- `401` caller is not authenticated
- `403` caller is not the author, an assignee, or an in-scope admin, or is a Site Admin acting directly
- `404` idea does not exist, is deleted, or is outside caller scope

### `PUT /api/v1/ideas/{ideaId}/sprint`
Purpose: Pull an Issue into a sprint, or return it to the delivery backlog.

Authorization: in-scope admin only in this slice. A direct Site Admin is refused.

Request body:
- `sprintId` required GUID string **or `null`** — `null` means the delivery backlog. The target must be a non-`Completed` sprint in the idea's organization.

Behavior:
- assigning the sprint the Issue is already in is a no-op: no audit event
- otherwise writes an `IssueSprintAssignmentChanged` audit event. No notification — sprint membership is a planning decision, not something to page the room about.

Success response:
- `204 No Content`

Error responses:
- `400` `sprintId` names no assignable sprint in this organization, or names a `Completed` one — `"A completed sprint cannot take new issues."` (keyed `sprintId`); **or the idea is still in `Discovery`** — keyed `sprintId`, `"Only a promoted idea can be assigned to a sprint."`
- `401` caller is not authenticated
- `403` caller is not an in-scope admin, or is a Site Admin acting directly
- `404` idea does not exist, is deleted, or is outside caller scope

### `GET /api/v1/organizations/{organizationId}/delivery`
Purpose: The sprint board and the delivery backlog — `Delivery`-phase items as cards. Readable by **every** member of the organization, `Read Only` included.

Query parameters:
- `sprintId` optional GUID — the sprint whose Issues to return. **Omitting it reads the BACKLOG** (`Delivery` items with no sprint), not every delivery item: that is the list an admin pulls from, and "everything" is not a view this feature has. A value that is not a canonical GUID applies a filter that matches nothing and returns an empty list rather than a `400` (the same deliberate divergence `statusId` carries on the board list).
- `deliveryStatus` optional — `Pending`, `Scoping`, `Development`, `Review`, or `Complete`. An unrecognised value is ignored rather than refused, matching the board list's other optional filters.

Success response `200`: an **unpaged** array (a sprint is a bounded, human-sized set) of the `GET /api/v1/boards/{boardId}/ideas` item shape plus:
- `phase` string — always `Delivery` for this endpoint
- `effort` string or `null`: `Low`, `Medium`, `High`
- `deliveryStatus` string or `null`
- `sprint` object or `null`: `sprintId`, `name`, `startDate`, `endDate`
- `taskSummary` object: `{ done, total }`. `done` counts only `Done` tasks — `InProgress` is explicitly not half a point, because a task count must not become a velocity proxy.
- `provenance` object: `promotedAtUtc`, `promotedByUserId`, `promotedByDisplayName`, `upvoteCountAtPromotion`, each nullable. `upvoteCountAtPromotion` sits beside the card's live `upvoteCount` deliberately — "42 upvotes when we committed, 61 now" is a more useful fact than either number alone.

Error responses:
- `401` caller is not authenticated
- `404` the organization does not exist or is outside caller scope

## Sprint Contracts

Added 2026-09-11, Issues and Delivery Slice 1. A Sprint is an organization-scoped, soft-deletable, time-boxed container. **Flat** — it is never nested under a Slice 2 Outcome, and an Issue belongs to zero or one Sprint through a nullable `sprintId` on the idea, with no join entity.

**Management is admin-only; reading is open to every member of the organization** including `Read Only`, because the sprint board and backlog are ticked for every role in the feature's Permissions table. A direct Site Admin is refused every mutation and allowed every read.

Sprint item shape (returned by list, create, update, and embedded in the detail read):
- `sprintId`
- `organizationId`
- `name` string, max 100 characters
- `goal` string or `null`, max 500 characters
- `startDate` date string (`YYYY-MM-DD`)
- `endDate` date string (`YYYY-MM-DD`)
- `ownerUserId` GUID string or `null`
- `ownerDisplayName` string or `null`
- `state` string: `Planned`, `Active`, or `Completed`
- `issueCount` integer, `doneCount` integer — **derived per read, never stored.** A stored counter is a second source of truth that drifts the first time an Issue moves without going through the sprint.

Sprint names are **not** unique: "Sprint 12" may legitimately recur across years.

### `GET /api/v1/organizations/{organizationId}/sprints`
Purpose: The organization's sprints. Soft-deleted sprints are excluded.

Query parameters:
- `state` optional — `Planned`, `Active`, or `Completed`. Omitted returns every state. An **unrecognised** value is a `400` keyed `state` rather than being read as absent: silently listing everything would answer `200` with rows the caller explicitly excluded.

Success response `200`: an unpaged array of the sprint item shape.

Error responses:
- `400` `state` is not one of the three values
- `401` caller is not authenticated
- `404` the organization does not exist or is outside caller scope

### `GET /api/v1/organizations/{organizationId}/sprints/{sprintId}`
Purpose: One sprint with the Issues assigned to it — the sprint board in a single read.

Success response `200`: the sprint item shape plus:
- `issues` array of the delivery card shape from `GET /api/v1/organizations/{organizationId}/delivery`

`issues` is the same projection that endpoint answers, filtered to this sprint, so the sprint board and the backlog render from one card shape. It is composed at the API boundary rather than embedded in the sprint read, so there is one place that knows how to build a delivery card.

Error responses:
- `401` caller is not authenticated
- `404` the sprint does not exist, is soft-deleted, or belongs to another organization

### `POST /api/v1/organizations/{organizationId}/sprints`
Purpose: Create a sprint. It always starts `Planned`; `state` is not accepted on the body.

Authorization: in-scope admin. A direct Site Admin is refused.

Request body:
- `name` required string, max 100 characters, trimmed
- `goal` optional string or `null`, max 500 characters, trimmed; blank is stored as `null`
- `startDate` required date string (`YYYY-MM-DD`)
- `endDate` required date string (`YYYY-MM-DD`), must be **on or after** `startDate`
- `ownerUserId` optional GUID string or `null` — must be an active user in this organization

Success response `201`: the sprint item shape, with `state` `Planned` and both counts `0`.

Error responses:
- `400` `name` is blank or too long; `goal` is too long; either date is not a calendar date; `endDate` is before `startDate` (`"End Date must be on or after Start Date."`); `ownerUserId` is not an active user in this organization
- `401` caller is not authenticated
- `403` caller is not an in-scope admin, or is a Site Admin acting directly
- `404` the organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/sprints/{sprintId}`
Purpose: Rename, re-goal, re-date, or reassign the owner. Body is identical to create; the update is a full replacement of those five fields.

Authorization: in-scope admin. A direct Site Admin is refused.

Behavior:
- allowed while `Planned` or `Active`
- **the dates of a `Completed` sprint are locked.** Its window is now a historical record of when the work actually happened, and anything reading back "what shipped in Q3" would silently change answer. Name, goal and owner stay editable there — fixing a typo on a finished sprint rewrites no history.
- `state` is not settable here; use `start` and `complete`

Success response `200`: the sprint item shape.

Error responses:
- `400` same field rules as create; plus `"A completed sprint cannot be re-dated."` (keyed `startDate`) when either date differs on a `Completed` sprint
- `401` caller is not authenticated
- `403` caller is not an in-scope admin, or is a Site Admin acting directly
- `404` the sprint does not exist, is soft-deleted, or belongs to another organization

### `POST /api/v1/organizations/{organizationId}/sprints/{sprintId}/start`
Purpose: `Planned` → `Active`.

Authorization: in-scope admin. A direct Site Admin is refused.

Request body: none.

An explicit action, never derived from `startDate` passing: a sprint the team has not actually picked up is not in progress, whatever the calendar says. There is **no single-active-sprint constraint** in this slice — an organization may run several concurrently.

Success response:
- `204 No Content`

Error responses:
- `400` the sprint is not `Planned` — keyed `state`, `"Only a planned sprint can be started."`
- `401`/`403`/`404` as for update

### `POST /api/v1/organizations/{organizationId}/sprints/{sprintId}/complete`
Purpose: `Active` → `Completed`, with deterministic carry-over.

Authorization: in-scope admin. A direct Site Admin is refused.

Request body: none.

Behavior:
- every assigned Issue whose `deliveryStatus` is not `Complete` is unassigned back to the **delivery backlog** (`sprintId` set to `null`). Carry-over-to-the-next-sprint is a P1 refinement, not this slice's default.
- no Issue is deleted, and Issues already `Complete` stay on the sprint as its record of what shipped
- the transition and every unassignment commit together, so a sprint can never end up `Completed` with unfinished Issues still pointing at it
- writes a `SprintCompleted` audit event carrying the carried-over count and ids
- a `Completed` sprint will not accept new Issues: a later `PUT /api/v1/ideas/{ideaId}/sprint` naming it is a `400`

Success response:
- `204 No Content`

Error responses:
- `400` the sprint is not `Active` — keyed `state`, `"Only an active sprint can be completed."`
- `401`/`403`/`404` as for update

### `DELETE /api/v1/organizations/{organizationId}/sprints/{sprintId}`
Purpose: Soft-delete a sprint.

Authorization: in-scope admin. A direct Site Admin is refused.

Behavior:
- **every assigned Issue is unassigned to the backlog first.** No Issue is ever deleted with a sprint; `ideas.sprint_id` is `ON DELETE RESTRICT` precisely so unassignment cannot be skipped.
- soft-delete, so existing audit references keep resolving. There is no restore endpoint in this release.
- **not idempotent**: a soft-deleted sprint is gone as far as every route here is concerned, so a second `DELETE` answers `404`, as do `GET`, `PUT`, `start` and `complete` on it. This matches the soft-delete behaviour of statuses and ideas.

Success response:
- `204 No Content`

Error responses:
- `401`/`403`/`404` as for update

## Issue Task Contracts

Added 2026-09-11, Issues and Delivery Slice 1. A Task is a **checklist step on an Issue**, not a work item: no sprint of its own, no dates, no estimate, no comments, no upvotes, no tags, no nesting, and no promotion path. Anything needing one of those is an Issue, not a Task.

Nested under the Issue that owns them because a task has no life outside it and carries **no organization of its own** — every route resolves the parent idea first and authorizes against that, which keeps `ideas`' organization scoping the single enforcement point.

Authorization: reading is open to anyone who can see the Issue, `Read Only` included. Every mutation is the idea's author, any Issue assignee, or an in-scope admin — the same set that may change the Issue's delivery status. A direct Site Admin is refused every mutation.

**Task mutations are deliberately NOT audited.** This is a conscious asymmetry with every other mutation in the feature: a checklist ticked a dozen times a day would drown the audit log that exists to answer "who committed us to this work". `completedAtUtc`/`completedByUserId` on the row carry the only record that matters. The one notification anywhere in this surface is `IssueTaskAssigned` to a task's new assignee, self-suppressed — ticking a box must not page the room.

Task item shape:
- `taskId`
- `ideaId` — the parent Issue
- `title` string, max 200 characters, trimmed
- `assigneeUserId` GUID string or `null`
- `assignee` object or `null` — `userId`, `firstName`, `lastName`, `displayName`, `isActive`, `portraitDataUrl`, so a row renders a name and an avatar without a second request
- `state` string: `NotStarted`, `InProgress`, or `Done`
- `sortOrder` integer — **dense and contiguous, `0..n-1`** within the parent Issue, maintained on insert, delete and reorder
- `completedAtUtc` timestamp or `null`, `completedByUserId` GUID string or `null`

### `GET /api/v1/ideas/{ideaId}/tasks`
Purpose: An Issue's checklist in `sortOrder`.

Success response `200`: an unpaged array of the task item shape. An idea with no tasks — including one still in `Discovery` — returns `[]`.

Error responses:
- `401` caller is not authenticated
- `404` the idea does not exist, is deleted, or is outside caller scope

### `POST /api/v1/ideas/{ideaId}/tasks`
Purpose: Append a task to the end of the checklist.

Request body:
- `title` required string, max 200 characters, trimmed
- `assigneeUserId` optional GUID string or `null` — any **active user in the Issue's organization**, who **need not** be an assignee of the parent Issue. This is the one place delivery work is divided between people; constraining it to the Issue's assignees would force spurious Issue assignments just to name a helper.

Behavior:
- appends at `sortOrder = n`, and the `N of M done` rollup on the delivery card updates
- notifies a newly named assignee with `IssueTaskAssigned` (link `/ideas/{ideaId}`), self-suppressed

Success response `201`: the task item shape.

Error responses:
- `400` `title` is blank or too long; `assigneeUserId` is not an active user in this organization; **or the parent idea is still in `Discovery`** — keyed `ideaId`, `"Only a promoted idea can carry tasks."` A task list is a delivery artifact; ideas in Discovery do not have one.
- `401` caller is not authenticated
- `403` caller is not the author, an assignee, or an in-scope admin, or is a Site Admin acting directly
- `404` the idea does not exist, is deleted, or is outside caller scope

### `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}`
Purpose: Rename and/or reassign a task — the two edits the row exposes together. Full replacement of both fields.

Request body: same as create.

Only a genuinely **new** assignee is notified; re-saving a row without touching its assignee must not re-page them.

Success response `200`: the task item shape.

Error responses:
- `400` `title` is blank or too long; `assigneeUserId` is not an active user in this organization
- `401` caller is not authenticated
- `403` as for create
- `404` the idea does not exist or is outside caller scope, **or `{taskId}`'s parent is not `{ideaId}`** — `404`, never `403`, so the nested route cannot be used to probe for ideas in other organizations

### `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}/state`
Purpose: Move a task between its three states.

Request body:
- `state` required string: `NotStarted`, `InProgress`, or `Done`

Three states rather than a bare checkbox, because "started but not finished" is the state a standup actually asks about.

Behavior:
- reaching `Done` stamps `completedAtUtc` and `completedByUserId`; moving **off** `Done` clears both
- re-applying the state a task already has returns it untouched — re-stamping would quietly overwrite who actually finished it, and when
- a task's state never gates the parent Issue: it may be set to delivery `Complete` with tasks outstanding

Success response:
- `204 No Content`

Error responses:
- `400` `state` is missing or not one of the three (keyed `state`)
- `401`/`403`/`404` as for update

### `PUT /api/v1/ideas/{ideaId}/tasks/order`
Purpose: Rewrite the whole checklist's order.

Request body:
- `taskIds` required array of GUID strings, in the intended order

`taskIds` must name **each of this Issue's tasks exactly once** — no missing id, no unknown id, no duplicate. A partial reorder is rejected rather than interpreted, because every reading of a partial list ("move these to the front"? "drop the rest"?) is a guess at what the caller meant. `sortOrder` is then `0..n-1`; unmoved tasks are left untouched so a drag does not re-stamp the whole checklist, and the rewrite commits atomically so a failure cannot leave the list half-renumbered.

Success response:
- `204 No Content`

An omitted `taskIds` key is read as the empty list, which matches exactly when the Issue has no tasks (a `204` no-op) and is a `400` otherwise. A present `taskIds` that is not an array is a `400` keyed `taskIds` (`"Task Ids is invalid."`), the same rule `tagNames` and `mentionEmails` carry — reading it as absent would accept the request and silently discard an order the caller asked for.

Error responses:
- `400` the id set does not match the Issue's tasks exactly, or `taskIds` is present and not an array — keyed `taskIds`
- `401`/`403`/`404` as for update

This route is declared **before** `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}`; `order` is a literal segment, not a task id.

### `DELETE /api/v1/ideas/{ideaId}/tasks/{taskId}`
Purpose: Remove a task from the checklist.

A **hard delete** — the one place in this feature that is not a soft delete. A checklist step keeps no history of its own beyond the completion stamps on the row, so there is nothing to preserve. The survivors are re-densified afterwards, so `sortOrder` stays `0..n-1`.

Success response:
- `204 No Content`

Error responses:
- `401`/`403`/`404` as for update

## Idea Field Option Contracts

Idea Type and Business Impact are dedicated organization-scoped option collections. Active labels are trimmed, case-insensitively unique within their field and organization, and returned in ascending `sortOrder`. The first active option is the default. Every organization must retain at least one active option in each collection.

### `GET /api/v1/organizations/{organizationId}/idea-types`
Purpose: List active Idea Type options. Authorized admins may pass `includeDeleted=true` to include archived options.

Success response `200` item shape:
- `ideaTypeId` GUID string
- `organizationId` GUID string
- `name` string, max 100 characters
- `sortOrder` integer
- `isDeleted` boolean

### `POST /api/v1/organizations/{organizationId}/idea-types`
Purpose: Create an Idea Type option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `sortOrder` required integer, zero or greater

Success response: `201` Idea Type item

### `PUT /api/v1/idea-types/{ideaTypeId}`
Purpose: Rename or reorder an Idea Type option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `sortOrder` required integer, zero or greater

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Purpose: Soft-delete an Idea Type option. Reject deletion with `400` when it is the last active Idea Type in the organization.

### `PUT /api/v1/organizations/{organizationId}/idea-types/reorder`
Purpose: Atomically set the complete active Idea Type order. The first identifier becomes the default for future ideas.

Request body:
- `orderedIdeaTypeIds` required non-empty array of all active Idea Type GUIDs in the organization

### `GET /api/v1/organizations/{organizationId}/business-impacts`
Purpose: List active Business Impact options. Authorized admins may pass `includeDeleted=true` to include archived options.

Success response `200` item shape:
- `businessImpactId` GUID string
- `organizationId` GUID string
- `name` string, max 100 characters
- `color` required string, CSS hex color in `#RRGGBB` format
- `sortOrder` integer
- `isDeleted` boolean

### `POST /api/v1/organizations/{organizationId}/business-impacts`
Purpose: Create a Business Impact option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format
- `sortOrder` required integer, zero or greater

Success response: `201` Business Impact item

### `PUT /api/v1/business-impacts/{businessImpactId}`
Purpose: Rename, recolor, or reorder a Business Impact option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format
- `sortOrder` required integer, zero or greater

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Purpose: Soft-delete a Business Impact option. Reject deletion with `400` when it is the last active Business Impact in the organization.

### `PUT /api/v1/organizations/{organizationId}/business-impacts/reorder`
Purpose: Atomically set the complete active Business Impact order. The first identifier becomes the default for future ideas.

Request body:
- `orderedBusinessImpactIds` required non-empty array of all active Business Impact GUIDs in the organization

Option deletion behavior:
- soft deletion preserves existing idea references and their prior labels
- archived options cannot be assigned on create or update
- existing ideas return archived option labels with an archived indicator

## Tag Contracts

### `GET /api/v1/organizations/{organizationId}/tags`
Purpose: Return tag autocomplete suggestions within an organization.

Query parameters:
- `search` required string, minimum 2 characters
- `limit` optional integer, defaults to `10`, maximum `50`

Success response `200`:
- string array of matching tag names

Rules:
- matching is case-insensitive by normalized tag prefix
- suggestions are organization-scoped

## Comment Contracts

### `GET /api/v1/ideas/{ideaId}/comments`
Purpose: List comments for an idea with pagination and chronological ordering.

Query parameters:
- `page`
- `pageSize`
- `sortBy` fixed to chronological order
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `commentId`
- `ideaId`
- `authorUserId`
- `author` object using the idea-list assignee item shape, or `null` — who wrote the comment
- `body`
- `createdAtUtc`
- `updatedAtUtc`

`author` was added 2026-09-10 for the reason `GET /api/v1/ideas/{ideaId}` gained its own: the
comment thread renders a name and an avatar per comment, and `authorUserId` alone would cost one
request per distinct commenter to turn into either — so the inspector rendered invented commenters
from fixture data instead. It is the **same object** an assignee and the idea's `author` are, and
the same object the detail's embedded `comments` carry, so a thread rendered from either endpoint
agrees with the other and a client needs one way to read a person off an idea payload.

`null` there means no user row for `authorUserId`, and only that. It is nullable because
`comments.author_user_id` carries no foreign key (the schema is frozen at S0.2), and since no code
path deletes a user it does not occur in practice — a `null` is data damage rather than an ordinary
case to design a label for. **A deactivated commenter is not that case**: the row still exists, so
the author comes back named with `isActive` false, exactly as a deactivated assignee does.

### `POST /api/v1/ideas/{ideaId}/comments`
Purpose: Add a comment to an idea.

Request body:
- `body` required string, max 2000 characters, plain text with line breaks
- `mentionEmails` optional string array — same organization-scoped, email-based mention resolution as ideas (`SPEC/20-feature-ideas-and-engagement.md` "Comments" #5); **an unresolved address is rejected with 400**, keyed on `mentionEmails`, using the canonical mention-resolution message in "Validation Message Conventions" above. **Corrected 2026-09-06** — this line previously read "unresolved addresses are ignored", which described behaviour the implementation never had: ideas and comments share one `IMentionResolver`, and it has always thrown. See `SPEC/decisions.md`.

UX rules:
- clients should show a live character counter and inline overflow validation

Success response `201`:
- `commentId`
- `ideaId`

### `PUT /api/v1/comments/{commentId}`
Purpose: Edit a comment authored by the caller.

Request body:
- `body` required string, max 2000 characters, plain text with line breaks

Success response `200`: the edited comment, in the same item shape the list above answers —
`author` included, so the composer can replace the edited comment in place without refetching the
thread.

UX rules:
- clients should show a live character counter and inline overflow validation

### `DELETE /api/v1/comments/{commentId}`
Purpose: Delete a comment authored by the caller or by an authorized admin.

Success response:
- `204 No Content`

## Upvote Contracts

### `POST /api/v1/ideas/{ideaId}/upvote/toggle`
Purpose: Toggle the caller's upvote on an idea.

Success response `200`:
- `ideaId`
- `hasUpvoted` boolean
- `upvoteCount` integer

## AI Idea Assist Contracts

Behavior spec: `SPEC/20-feature-ai-idea-assist.md`. Sprint 7 (`SPEC/sprints/archive/sprint-07-ai-idea-assist.md`). **Built 2026-08-16**, except the per-org `ai-key` endpoints below, which stay deliberately unimplemented (rule 30).

Contract-wide rules for this section:
- the caller's organization is resolved from the access token, never from the request body
- the client never sends a prompt, system instructions, model name, retrieved context, or the organization's scope statement — the server assembles all of it
- these endpoints **never create, update, or delete an idea**; they return draft suggestions that seed the create form, which is submitted separately through `POST /api/v1/boards/{boardId}/ideas` and validated there as normal
- suggested option ids are always active options in the caller's organization; the server rejects a model response containing any id outside the retrieved set rather than passing it to the client

### `POST /api/v1/boards/{boardId}/idea-assist/turns`
Purpose: Advance the idea-drafting conversation by one turn and return the updated draft.

Request body:
- `transcript` required array, ordered oldest-first, **max 20 entries** — user and assistant messages combined, per `20-feature-ai-idea-assist.md` rule 5. This line previously read "max 40 entries of which at most 20 may have `role` of `user`", which contradicted the two references to the 20-entry cap further down this same section, and the shipped implementation. Corrected 2026-09-07 to rule 5a's recorded resolution: **the cap counts entries, not user turns**. Each entry:
  - `role` required string, one of `user`, `assistant`
  - `text` required string, max 4000 characters, trimmed before validation
- `draft` optional object carrying the current draft so the model can revise rather than restate. Same shape as `draft` in the response; unknown or inactive ids are discarded server-side rather than rejected

Behavior rules:
- authorized for any member of the board's organization who may create ideas (Read Only is refused)
- the final transcript entry must have `role` of `user`
- the server assembles retrieval context (active idea types with their resolved field sets, business impacts, board statuses, tags, members) scoped to the caller's organization
- the response schema's `ideaTypeId` and `businessImpactId` are constrained to the retrieved active option ids
- when the turn is judged out of scope, `inScope` is `false`, `draft` is returned unchanged, and `nextQuestion` carries the server's fixed redirect string; the client discards the offending user turn rather than appending it
- three consecutive out-of-scope turns additionally return `conversationClosed` as `true`
- rate limited per user and per organization; each call writes an audit event recording the actor, organization, board, turn count, token usage, and out-of-scope outcome, and never the prompt or transcript content

Success response `200`:
- `inScope` boolean
- `conversationClosed` boolean
- `nextQuestion` string — the assistant's reply; the only free-text field the model produces
- `draft` object:
  - `title` string or null, max 150 characters
  - `description` string or null, max 4000 characters
  - `ideaTypeId` GUID string or null — an active idea type in this organization
  - `businessImpactId` GUID string or null — an active business impact in this organization
  - `priority` string or null, one of the `Priority` enum values
- `turnsRemaining` integer — how many further **user** turns fit under the 20-entry cap, counted from the transcript as it will stand after this turn is applied

Error responses:
- `400` request body is malformed, violates field constraints, exceeds the 20-entry transcript cap, or does not end with a `user` entry
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create ideas on this board
- `404` board does not exist or is outside caller scope
- `429` rate limit exceeded for this user or organization
- `503` AI assist is not configured, the provider is unavailable, **or the deployment's daily token budget is exhausted** (`20-feature-ai-idea-assist.md` rule 28a) — clients degrade to the scripted brainstorm chat rather than surfacing an error. The three causes are deliberately indistinguishable to the client: all three mean "the assistant is unavailable, keep working without it."

### `GET /api/v1/ai-assist/availability`
Purpose: Tell the client whether to open the drafting chat or go straight to the create form (`20-feature-ai-idea-assist.md` rule 32a).

Behavior rules:
- authorized for **any authenticated user** — unlike the org-scoped settings endpoint below, which is admin-only. Idea creation is a `User`-role activity, so an admin-only check could not serve this purpose
- returns a bare boolean and **never** distinguishes unconfigured from provider-unavailable from budget-exhausted, matching the deliberate opacity of the turn endpoint's `503` (rule 31). It carries no key material, no org configuration, and no usage figures
- reflects deployment key configuration and the current UTC day's budget at the moment of the call; it is a snapshot, not a subscription, so clients must still handle a `503` on a turn

Success response `200`:
- `available` boolean

Error responses:
- `401` caller is not authenticated

### `GET /api/v1/ai-assist/prompt`
Purpose: Read the active system-prompt template, the two redirect strings, and the version history (`20-feature-ai-idea-assist.md` rules 34–36).

Behavior rules:
- **Site Admin only.** Deployment configuration, not organization content — the same scope as the deployment API key (rule 29). Org Admin is refused
- when no version is active, returns the built-in default with `version` of `null` and `isBuiltInDefault` true. An empty history is the normal initial state, not an error

Success response `200`:
- `body` string — the active template, including its `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}` placeholders
- `outOfScopeRedirect` string · `conversationClosedRedirect` string
- `version` integer or null · `isBuiltInDefault` boolean
- `versions` array, newest first: `version`, `createdAtUtc`, `createdByUserId`, `createdByDisplayName`, `isActive`

Error responses: `401` unauthenticated · `403` caller is not a Site Admin

### `PUT /api/v1/ai-assist/prompt`
Purpose: Publish a new version.

Request body:
- `body` required string, max 20000 characters. **Must contain both `{{ORGANIZATION_CATALOG}}` and `{{SCOPE_STATEMENT}}`**
- `outOfScopeRedirect` required string, max 500 characters
- `conversationClosedRedirect` required string, max 500 characters

Behavior rules:
- appends a version and makes it active; earlier versions are never modified
- writes an audit event recording actor and version number, never the body (rule 27)

Success response `200`: same shape as the `GET`.

Error responses:
- `400` a placeholder is missing, or a field is empty or over length. The message names the missing placeholder
- `401` unauthenticated · `403` caller is not a Site Admin

### `POST /api/v1/ai-assist/prompt/versions/{version}/restore`
Purpose: Republish an earlier version.

Behavior rules:
- publishes a **copy** of `{version}` as a new version rather than reactivating the old row, so history stays append-only and the restore is itself visible in it

Success response `200`: same shape as the `GET`. Errors: `401` · `403` · `404` no such version.

### `POST /api/v1/ai-assist/prompt/probe`
Purpose: Run advisory safety probes against a draft template before publishing (rule 37).

Request body: `body` required string — the **draft**, which need not have been saved.

Behavior rules:
- runs the injection, fence-closing and off-topic probes against a **synthetic catalog** — never a real organization's — and reports whether each was refused
- **advisory only** — this endpoint never publishes anything and a failing probe never blocks a later `PUT`
- subject to the global daily budget gate, but **not** per-organization rate limited and **not** recorded in the usage meter: both need an organization to attribute spend to and a Site Admin has none (`20-feature-ai-idea-assist.md` rule 37b). Bounded instead by construction — three fixed prompts, Site Admin only
- a failed provider call returns `503` rather than reporting the probe as refused

Success response `200`:
- `probes` array: `id`, `prompt`, `refused` boolean, `expectedRefused` boolean
- `refusedCount` integer · `totalCount` integer

Error responses:
- `400` the draft is missing a required placeholder · `401` · `403` not a Site Admin
- `429` rate limit exceeded · `503` AI assist is unavailable or the daily budget is exhausted

### `GET /api/v1/organizations/{organizationId}/ai-assist/settings`
Purpose: Read the organization's AI assist configuration for the settings UI.

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- reports whether the deployment has a key configured; never returns a key or any part of one

Success response `200`:
- `aiAssistAvailable` boolean — a deployment key is configured and the feature is on
- `scopeStatement` string or null

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/ai-assist/settings`
Purpose: Set or clear the organization's scope statement — the free-text narrowing of what the assistant will discuss.

Request body:
- `scopeStatement` required string or null, max 500 characters, trimmed before validation. Null or empty clears it, leaving the organization's active Idea Types as the only scope boundary

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- generates an audit event recording the acting user and the new value
- takes effect on the next turn; in-flight conversations are not retroactively re-scoped

Success response `200`:
- `scopeStatement` string or null

Error responses:
- `400` request body is malformed or the statement exceeds 500 characters
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `GET /api/v1/ai-assist/usage`
Purpose: Platform-wide AI consumption, one row per organization — the Site Admin's view of who is spending what.

Actors: **Site Admin only.** All other roles receive `403`.

Query parameters:
- `fromUtc` optional date — defaults to the first day of the current UTC month
- `toUtc` optional date — defaults to now

Behavior rules:
- rows cover every organization with usage in the window, including archived ones (spend already incurred does not disappear when an org is archived)
- cost is computed from the rates stored on each usage record, not from current configuration, so a pricing change never re-prices history

Success response `200`:
- `fromUtc`, `toUtc`
- `dailyTokenLimit` integer — the configured ceiling (rule 28a)
- `tokensUsedToday` integer — consumption against that ceiling for the current UTC day, across all organizations
- `organizations` array, ordered by total tokens descending. Each entry:
  - `organizationId` GUID string, `organizationName` string
  - `calls` integer
  - `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `cacheCreationInputTokens` integers
  - `estimatedCost` decimal — in USD, from the stored rates
- `totals` object — the same numeric fields summed across organizations

Error responses:
- `401` caller is not authenticated
- `403` caller is not a Site Admin

### `GET /api/v1/organizations/{organizationId}/ai-assist/usage`
Purpose: One organization's AI consumption.

Actors: Site Admin on any organization, and Org Admin **on their own organization only**. All other roles receive `403`.

Query parameters: `fromUtc`, `toUtc` — same defaults as above.

Success response `200`: a single organization entry in the shape above, plus `fromUtc` / `toUtc`. `dailyTokenLimit` and `tokensUsedToday` are **omitted** — the ceiling is platform-wide and is not an organization's business.

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

## Notification Event Contract

### Internal notification event types
- `IdeaMentioned`
- `CommentMentioned`
- `IdeaCommented`
- `IdeaStatusChanged`

### Internal notification event payload
- `eventId` GUID string
- `eventType` string
- `organizationId` GUID string
- `boardId` GUID string
- `ideaId` GUID string
- `actorUserId` GUID string
- `recipientUserId` GUID string
- `occurredAtUtc` UTC timestamp
- `ideaLink` string using `/ideas/{ideaId}` (drawer-addressable; supersedes both the earlier `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` and the interim `/ideas/{ideaId}/edit` patterns; see `SPEC/20-feature-notifications.md`)
- `message` human-readable event summary string
- `metadata` object for event-specific context

MVP event query scope:
- audit and notification events must be persisted for internal processing and verification
- read or query endpoints for those events are not required in MVP
- verification should be provided through tests and internal diagnostics outside the public API surface

## Notes
- API routes, request/response schemas, and validation rules should be defined here.
- Contract tests should stay aligned with this file.