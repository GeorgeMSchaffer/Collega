# Feature: User Login

> **At a glance** (added 2026-09-28; the text below is unchanged and wins where they differ)
> - **Scope:** login, session issue, seeded Site Admin's first-login password change; MFA, social login out.
> - **Key rules:** a failure never reveals which credential was wrong (2); 5 fails in 15 min lock 15 min (3).
> - Seeded Site Admin must change password first (4); unauthenticated → `/login`, `/register` public (6).
> - Restore only after `GET /api/v1/auth/me` accepts the token (9); an unknown token clears the session (10),
>   an endpoint-specific `401` does not (11).
> - **Contracts:** contracts/auth.md
> - **Decisions:** 2026-09-12 "A lockout refuses a wrong password, not a right one"; 2026-09-11 "The
>   account-lockout denial of service is a known open risk; not fixed now"; 2026-09-04 "The session lives
>   in a cookie Nest issues; the reshape takes only what introspection forces"

## Outcome
Users can securely access Collega using organization-scoped credentials.

## Scope
- In: credential validation, protected session/token issue, first-login password change for seeded Site Admin
- Out: MFA, social login providers, remember this device

## Login Context
- User email is globally unique across the system.
- User password are secured through hashing.

## Scenarios (Given/When/Then)
1. Given a valid active user account
   When they submit correct email and password
   Then the API authenticates the user and returns the authenticated session or token response

2. Given an invalid email or password
   When a login attempt is submitted
   Then the API returns an authentication failure response without exposing which credential was incorrect

3. Given 5 failed login attempts for the same account within 15 minutes
   When another login attempt is made before the lockout expires
   Then the API denies authentication for 15 minutes

4. Given the seeded Site Admin account is logging in for the first time
   When authentication succeeds
   Then the user is required to change their password before accessing protected application features

5. Given an unauthenticated request to a protected feature
   When the request is made without valid authentication
   Then access is denied

6. Given an unauthenticated user navigates to a protected client route
   When client route access is evaluated
   Then the user is redirected to `/login`, while `/register` remains publicly accessible

7. Given an authenticated user does not require a password change
   When login succeeds or the user navigates to `/login`
   Then the user is redirected to the Dashboard at `/`

8. Given an authenticated user is not marked `MustChangePassword`
   When the user navigates to `/change-password`
   Then the user is redirected to `/settings/profile` for voluntary password changes

9. Given the browser contains persisted authentication data
   When the client restores the session
   Then it creates an authenticated principal only after `GET /api/v1/auth/me` accepts the stored bearer token and returns the current user

10. Given a persisted or active bearer token is expired or no longer recognized by the API
   When session restoration or a protected API request validates the token
   Then the client clears the persisted and in-memory session and redirects to `/login`

11. Given a protected endpoint returns `401` for an endpoint-specific reason while `GET /api/v1/auth/me` still accepts the bearer token
   When the client evaluates the response
   Then the original error is preserved without clearing the authenticated session

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
- [ ] Persisted client authentication is restored only after `/api/v1/auth/me` accepts the stored token
- [ ] Expired or API-unknown tokens clear the client session and redirect to `/login`
- [ ] Endpoint-specific `401` responses do not clear a token that `/api/v1/auth/me` still accepts