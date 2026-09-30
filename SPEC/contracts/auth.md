# Contracts: auth

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Authentication Contracts

### Access Token Format and Session Revocation (Resolved 2026-08-07)
Rewritten 2026-09-29 (`SPEC/decisions.md`, "Spec contradictions resolved"): the session is the
httpOnly cookie Nest issues (decision 2026-09-04, `08`), not a bearer token the client stores.
This section said "`accessToken` is a signed JWT"; named the .NET lifetime setting
`Auth:AccessTokenLifetimeMinutes` (`Auth__AccessTokenLifetimeMinutes`); said the browser enforces
the idle deadline, without saying it is unbuilt in `apps/web`; and sent expiry to
`/login?sessionExpired=true`.
- The session is an **httpOnly cookie named `collega_session`**, set by the API on a successful `POST /api/v1/auth/login` (`Secure`, `SameSite=Lax`, `Path=/`). Its value is a signed JWT (HS256) carrying the user id (`sub`); no response body carries it, no client script reads it, and no client sends an `Authorization` header. The API reads identity from this cookie and nothing else.
- Every `User` has a server-side `SecurityStamp`: a random value regenerated whenever sessions must be invalidated. Each issued JWT embeds the `SecurityStamp` current at issuance as a claim (`sstamp`).
- `GET /api/v1/auth/me` and every authenticated request revalidate the embedded `SecurityStamp` claim against the User's current `SecurityStamp` in the database. A mismatch is an invalid/expired session (`401`), exactly like an expired JWT.
- "Revoke all existing sessions" (self-service and admin-issued password reset, `SPEC/20-feature-auth.md` requirements #29 and the self-service reset acceptance criteria) regenerates `User.SecurityStamp`. Why: it immediately invalidates every previously issued token for that user without a token blocklist or session table.
- Access tokens expire absolutely 480 minutes after issuance, so a successful login returns `expiresInSeconds: 28800`, and the cookie's lifetime equals the token's so it never outlives the JWT it carries. Deployments may override the lifetime through the environment variable `ACCESS_TOKEN_LIFETIME_MINUTES`. The signing key is `ACCESS_TOKEN_SIGNING_KEY`; production refuses to boot without one of at least 32 characters.
- `apps/web` posts sign-in through a Next Server Function and re-issues the cookie on its own origin under the same name and lifetime (`httpOnly`, `SameSite=Lax`, `Secure` in production), so the browser holds one cookie for one origin; server-rendered requests forward it to the API as a `Cookie` header. Signing out deletes the cookie — there is no logout endpoint, because a stateless JWT has no server-side record to revoke.
- A session the API refuses (expired, revoked, or signed with a key it no longer holds), the browser inactivity deadline, and the token's absolute expiry all send the reader to `/login?expired=1`, where the cookie is dropped. Explicit logout (`/login`) and a successful password change (`/login?passwordChanged=1`) do not use that query state.
- The browser inactivity deadline (30 minutes, a warning at minute 28 with a two-minute countdown, activity and logout synchronized across tabs; staying signed in never changes `expiresInSeconds` or the JWT expiry) is specified in `SPEC/20-feature-auth.md` requirements 38–42; `apps/web` enforces it in the desk layout (`components/auth/idle-sign-out.tsx`), sending idle and absolute-token expiry to `/login?expired=1`.

### Mandatory Password Rotation Gate (Resolved 2026-08-11, Sprint 4)
- While a user's persisted `MustChangePassword` is true, the API refuses every authenticated endpoint except a fixed allowlist, returning `403` with the standard problem-details envelope.
- The allowlist is `GET /api/v1/auth/me` (the client needs it to render the change screen) and `POST /api/v1/auth/change-password` (the only way out).
- Anonymous endpoints — login, register — are unaffected, since an unauthenticated caller owes no rotation.

Rules:
- the flag is read from live persisted state on each request, not from a claim baked into the token at issuance; completing the rotation also regenerates `SecurityStamp`, so the session that made the change is revoked and the next sign-in carries no restriction. *Corrected 2026-09-29 (slice 124): this said completing the rotation lifts the restriction on the next request without a new token; the password change also regenerates `SecurityStamp`, which revokes that token.*
- login still succeeds, still sets the session cookie, and returns `requiresPasswordChange: true`; the session is simply scoped to the allowlist until the rotation is done
- the allowlist is opt-in per endpoint — a newly added endpoint is refused during rotation unless it is explicitly marked
- this is a server-side gate. The client's own `mustChangePassword` routing is a UX convenience layered on top of it and is not the enforcement point
- why: before this gate the rule was enforced only client-side. The issued token was valid everywhere, so a caller holding an admin-issued temporary password could skip the rotation entirely by calling the API directly and continue on a credential the issuing admin still knew.

### Rate limiting on the authentication surface
- `POST /api/v1/auth/login`, `POST /api/v1/auth/register` and `POST /api/v1/auth/change-password` are limited **per caller IP and per route**. Each keeps its own counter, so spending the register allowance does not close login.
- Limits: 10 requests per minute (20 on login) and 100 per hour.
- Exceeding either answers `429` with the standard problem-details envelope, `type` `https://collega.dev/problems/too-many-requests`, and a `Retry-After` header in seconds — the same `429` shape the AI assist endpoints already use for their own limits.
- `Retry-After` is the **only** rate-limit header sent. It is also the only thing on the wire that separates this `429` from a locked-out account's: those two carry the same `type` and `title` and differ only in `detail`, which is prose. The lockout sends no `Retry-After`.
  - Why it matters: a client that must tell "this address has asked too often" from "this account is locked after five failed attempts" reads the header's presence. They are deliberately distinct refusals — a caller's volume versus one account's failed attempts — and `apps/web` depends on telling them apart, because only one of them means the password was wrong.
- No `X-RateLimit-*` headers are exposed: the library's are suffixed with internal bucket names, which are not contract surface. Adding unsuffixed ones is a change to make here first.
- Two properties clients must not read more into than is there:
  - The caller IP is taken from `x-forwarded-for` **only when the process is running on Vercel**, which overwrites that header with the real client address; anywhere else the socket address is used, so a self-hosted run cannot be steered by a caller-supplied header.
  - The counters live in the serving process, which on serverless is neither shared between concurrent instances nor preserved across cold starts. The limit bounds volume; it is not a guarantee of an exact ceiling. A shared store is what would make it one.
- This does **not** replace the account lockout below, and does not prevent it: five failed attempts still lock an account, and five is below any limit that lets real people sign in.
- **Known open risk, following directly from that sentence: the lockout is an anonymous denial of service.** Five failed sign-ins against a known email address lock that account for 15 minutes, repeatable indefinitely, from a caller who holds no account, no invite code and no session. Bounding it needs a per-IP failed-attempt counter, and that needs state outliving a request — either a schema change (frozen at S0.2) or the shared store the rate limiter above already needs to be a real ceiling. Tracked, deliberately not fixed: `SPEC/decisions.md` 2026-09-11.

### `POST /api/v1/auth/login`
Authenticate a user with globally unique email credentials.

- **Roles:** anonymous.
- **Request:**
  - `email` required string
  - `password` required string
- **Response:** `200` authenticated — the body carries **no token**; the cookie below is the session:
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
- **Errors:**
  - `401` invalid credentials
  - `403` inactive account
  - `429` locked out after 5 failed attempts within 15 minutes
  - `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")
- **Rules:**
  - **Session transport (decision `08`, 2026-09-04).** The Nest host issues the session as an **httpOnly cookie** named `collega_session`, not as a bearer token in the body: `Secure`, `SameSite=Lax`, `Path=/`. The client never reads it and never sets an `Authorization` header — why: that keeps `apps/web` a pure client. The API sets it only here; `apps/web` deletes it on sign-out and after a password change. View As start and exit do not touch it: impersonation is resolved server-side on every request (`contracts/view-as.md`).
  - This document said nothing about cookies until 2026-09-08, which is how the frozen .NET API (bearer) and the Nest host (cookie) came to disagree with nothing forcing the question. The body is otherwise unchanged.
  - The `accessToken` field the .NET API returned is **gone**: issuing it alongside the cookie would hand the token back to JavaScript and defeat the point of `httpOnly`. One golden fixture records that field and will diff against Nest until it is re-recorded — the single known cost of this decision, and cheaper than the alternative.

### `GET /api/v1/auth/me`
Return the currently authenticated user summary.

- **Roles:** the authenticated caller.
- **Request:** —
- **Response:** `200`:
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
- **Errors:**
  - `401` caller is not authenticated
- **Rules:**
  - `portraitDataUrl` and `viewingAs` were missing from this document until 2026-09-09 and are **not** optional: every recorded fixture carries them, and the client depends on `viewingAs` to render the effective role during impersonation. Verified against `tools/golden/fixtures/auth.me.*`.
  - `organizationTitle` was added 2026-09-10 (`SPEC/decisions.md`) so the client can name the organization from the one call it already makes per request. `null` means the caller belongs to no organization — a Site Admin, whose surfaces read "All organizations" — and nothing else: a caller with an `organizationId` always has a string here. It is **not** a fallback for a title that could not be resolved, and clients must keep the two cases apart.
  - This shape is shared by every response that returns an authenticated user summary: `POST /auth/login` (under `user`), `PUT /auth/me`, `PUT`/`DELETE /auth/me/portrait`, and both identities on `POST /auth/view-as`.

### `PUT /api/v1/auth/me`
Update the currently authenticated user's editable profile fields.

- **Roles:** the authenticated caller, for their own profile.
- **Request:**
  - `firstName` required string, max 100 characters
  - `lastName` required string, max 100 characters
- **Response:** `200`:
  - updated authenticated user summary using the same shape as `GET /api/v1/auth/me`
- **Errors:**
  - `400` missing or invalid name fields
  - `401` caller is not authenticated or the authenticated user cannot be resolved
- **Rules:**
  - Both fields are trimmed before persistence.
  - Email, role, organization, and status cannot be changed through this endpoint.

### `PUT /api/v1/auth/me/portrait`
Set the current user's portrait.

*Written 2026-09-29 from the code (slice 124, `SPEC/decisions.md` 2026-09-29 "Contracts and wording
written from the code"): `apps/api/src/authentication/authentication.controller.ts` and
`AuthService.updatePortrait`.*

- **Roles:** the authenticated caller, for their own portrait. Not on the mandatory-rotation
  allowlist, so it answers `403` while a password change is required.
- **Request:** JSON body
  - `imageBase64` required string — the image file as Base64, or a whole `data:` URL (everything
    up to the first comma is dropped). Whitespace inside the payload is ignored.
- **Response:** `200`, the authenticated user summary (the `GET /api/v1/auth/me` shape), with
  `portraitDataUrl` set to `data:image/png;base64,…`.
- **Errors:**
  - `400` `imageBase64` `"Image Base64 is required."` when it is missing or blank, and `"The uploaded
    image could not be read."` when it is not valid Base64 — both request-shape failures, with no
    `traceId`
  - `400` `portrait` `"That file isn't a supported image. Upload a GIF, JPEG, or PNG."` when the
    bytes do not decode as one of those three formats
  - `401` caller is not authenticated or cannot be resolved
  - `403` a password change is required
- **Rules:**
  - What is stored is not what was sent: the image is decoded, scaled to fit within 25 × 25 pixels
    without enlarging, and re-encoded as PNG. Content that only claims to be an image is rejected,
    never stored.
  - Audited as `UserPortraitUpdated`.
  - The `tools/golden/fixtures/profile.portrait.*` summaries were recorded before
    `organizationTitle` existed (added 2026-09-10) and lack it; they agree with this contract
    otherwise, for both routes and all four roles.

### `DELETE /api/v1/auth/me/portrait`
Remove the current user's portrait, so the initials avatar shows again.

*Written 2026-09-29 from the code, as above.*

- **Roles:** the authenticated caller, for their own portrait. Not on the mandatory-rotation
  allowlist.
- **Request:** —
- **Response:** `200` (not `204`), the authenticated user summary with `portraitDataUrl` `null`, so
  the client can re-render from the answer.
- **Errors:**
  - `401` caller is not authenticated or cannot be resolved
  - `403` a password change is required
- **Rules:** Answers `200` when there was no portrait to remove. Audited as `UserPortraitRemoved`.

### `POST /api/v1/auth/change-password`
Change the current user's password, including the first-login Site Admin password change.

- **Roles:** the authenticated caller, for their own password.
- **Request:**
  - `currentPassword` required string
  - `newPassword` required string
- **Response:** `204 No Content`
- **Errors:**
  - `400` invalid password policy
  - `401` invalid current password
  - `403` caller is authenticated but not allowed to change the password in the current state
  - `429` too many requests from this caller IP (see "Rate limiting on the authentication surface")
- **Rules:** —

### `POST /api/v1/users/{userId}/temporary-password`
MVP/P1 admin-issued temporary password reset.

- **Roles:** — (not stated; the `403` is under Errors).
- **Request:**
  - empty body or implementation-defined admin note
- **Response:** `200`:
  - `temporaryPassword` string
  - `mustChangePassword` boolean
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is authenticated but not allowed to issue a temporary password for the target user
  - `404` target user does not exist or is outside caller scope
- **Rules:**
  - the temporary password is displayed one time only
  - the temporary password expires after 24 hours if unused
  - the user must change the password on first successful use

### `POST /api/v1/auth/password-reset/request`
Post-MVP anonymous request for a self-service password-reset email.

- **Roles:** anonymous.
- **Request:**
  - `email` required string, valid email format
- **Response:** `202 Accepted`:
  - `message` string with the same generic wording for every syntactically valid request
- **Errors:**
  - `400` malformed request body, missing email, or invalid email format
- **Rules:**
  - only active accounts with local-password credentials are eligible, including Site Admin and organization users
  - unknown, inactive, external-only, throttled, and eligible emails receive the same response
  - eligible requests send an unlinked anonymous reset-page URL containing a cryptographically random bearer token
  - issuing a new token invalidates every prior token for the account
  - the token expires after 24 hours and is single-use
  - delivery is limited to 3 requests per normalized email and 10 requests per source IP in a rolling 15-minute window
  - requests above either limit return the generic success response without sending an email
  - token values are not persisted in plaintext or included in logs, audit metadata, analytics, or responses

### `POST /api/v1/auth/password-reset/confirm`
Post-MVP anonymous completion of a self-service password reset using the emailed token.

- **Roles:** anonymous.
- **Request:**
  - `token` required string
  - `newPassword` required string
  - `confirmPassword` required string
- **Response:** `204 No Content`
- **Errors:**
  - `400` malformed request, password mismatch, password-policy failure, or invalid-link failure
- **Rules:**
  - `newPassword` and `confirmPassword` must match
  - the new password must satisfy the existing authentication complexity policy
  - invalid, expired, superseded, and used tokens return the same invalid-link failure
  - a successful reset consumes the token and revokes all existing sessions for the account
  - the response does not authenticate the user; the client shows confirmation and returns to Login
  - token and plaintext password values are not persisted or included in logs, audit metadata, analytics, or error responses
