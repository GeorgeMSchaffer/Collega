# Contracts: auth

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

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

