# Feature: User Login

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** login, session issue, seeded Site Admin's first-login password change; MFA, social login out.
> - **Key rules:** a failure never reveals which credential was wrong (2); 5 fails in 15 min lock 15 min (3).
> - Seeded Site Admin must change password first (4); unauthenticated → `/login`, `/register` public (6).
> - Signed in only once `GET /api/v1/auth/me` accepts the session cookie (9); a rejected cookie is dropped (10),
>   an endpoint-specific `401` does not end the session (11).
> - **Contracts:** contracts/auth.md
> - **Decisions:** 2026-09-12 "A lockout refuses a wrong password, not a right one"; 2026-09-11 "The
>   account-lockout denial of service is a known open risk; not fixed now"; 2026-09-04 "The session lives
>   in a cookie Nest issues; the reshape takes only what introspection forces"

## Outcome
Users can securely access Collega using organization-scoped credentials.

## Scope
- In: credential validation, session cookie issue, first-login password change for seeded Site Admin
- Out: MFA, social login providers, remember this device

## Login Context
- User email is globally unique across the system.
- User passwords are secured through hashing.

## Scenarios (Given/When/Then)
1. Valid active account, correct email and password → the API authenticates the user, sets the httpOnly session cookie, and returns the login response (no token in the body).
2. Invalid email or password → an authentication failure response that does not expose which credential was incorrect.
3. 5 failed login attempts for the same account within 15 minutes → further attempts before the lockout expires are denied for 15 minutes.
4. Seeded Site Admin logging in for the first time → on success, must change their password before accessing protected application features.
5. Unauthenticated request to a protected feature, without valid authentication → access is denied.
6. Unauthenticated user on a protected client route → redirected to `/login`; `/register` remains publicly accessible.
7. Authenticated user who does not require a password change, on login success or navigating to `/login` → redirected to the Dashboard at `/`.
8. Authenticated user not marked `MustChangePassword`, navigating to `/change-password` → redirected to `/settings/profile` for voluntary password changes.
9. Browser holds the session cookie → the client treats the reader as signed in only after `GET /api/v1/auth/me` accepts the cookie and returns the current user (`apps/web` asks on every authenticated page request).
10. The session cookie is expired or no longer recognized by the API, found on a page request or a protected API request → the client drops the cookie and redirects to `/login`.
11. A protected endpoint returns `401` for an endpoint-specific reason while `GET /api/v1/auth/me` still accepts the session cookie → the client preserves the original error without ending the session.

Scenarios 9–11 rewritten 2026-09-29 (`SPEC/decisions.md`, "Spec contradictions resolved"): they described a client-stored bearer token; the session is the httpOnly cookie Nest issues (decision 2026-09-04, `contracts/auth.md`).

## Edge Cases
- Case-insensitive email match if email lookup is normalized that way by the chosen contract
- Inactive users
- Case-insensitive email match

## Contracts Impacted
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/change-password`

## Acceptance Criteria
- [ ] All scenarios above implemented
- [ ] Valid credentials allow login
- [ ] Invalid credentials are rejected
- [ ] Five failed login attempts within 15 minutes cause a 15-minute lockout
- [ ] Inactive users are denied authentication
- [ ] Seed Site Admin must change password on first login
- [ ] Protected features reject unauthenticated access
- [ ] Protected client routes redirect unauthenticated users to `/login`
- [ ] Authenticated users without a required password change land on `/`
- [ ] `/change-password` is limited to authenticated users marked `MustChangePassword`
- [ ] A session cookie counts as signed in only after `/api/v1/auth/me` accepts it
- [ ] An expired or API-unknown session cookie is dropped and the reader redirected to `/login`
- [ ] Endpoint-specific `401` responses do not end a session that `/api/v1/auth/me` still accepts