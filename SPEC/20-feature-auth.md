# Feature: Authentication

## Outcome
Users can securely access the application using organization-scoped accounts.

## Scope
- In: login, seeded Site Admin account, admin-issued password reset
- Out (MVP): OAuth, SAML, MFA, social login
- Post-MVP: self-service password reset by private email link, OAuth in Phase 2, and SAML in a later follow-on phase

## Requirements
1. Users must authenticate with email and password.
2. User accounts are organization-scoped, and user email is globally unique across the system.
4. Unauthorized users cannot access protected application features.
5. Passwords must be at least 6 characters long and include uppercase, lowercase, numeric, and special characters.
6. Five failed login attempts within 15 minutes must trigger a 15-minute account lockout.
7. The seeded Site Admin account is a global platform account and does not belong to an organization.
8. A seed Site Admin account must be created on first run using an environment-provided initial credential, read from configuration keys `SiteAdmin__Email` and `SiteAdmin__Password` (bound via standard ASP.NET Core configuration, so either environment variables or `dotnet user-secrets` may supply them locally). Startup must fail fast if either is missing.
9. The seed Site Admin must be forced to change that initial credential on first login.
10. In Development only, startup seed must also create one Org Admin and two User accounts in each demo organization, each initialized with demo password `Abc123!` (chosen to satisfy the password complexity policy in requirement #5 — the earlier literal `abc123!` from `SPEC/10-requirements.md` had no uppercase character and was changed rather than exempted; see `SPEC/60-spec-q-and-a-backlog.md` decision 16). The global Site Admin remains outside all organizations.
11. Development demo users are not forced to change the demo password on first successful login.
12. Password reset is required in P1 and uses admin-issued temporary passwords.
13. Admin-issued temporary passwords are shown one time only, expire after 24 hours, and require password change on first use.
14. "Remember this device" is out of scope for MVP.
15. Inactive user accounts cannot authenticate.
16. Successful and failed authentication events, password changes, and password resets must be audited.
17. Invited users can self-register through a dedicated Register page (`/register`) using a valid organization invite code.
18. Logout is handled via a dedicated Logout route (`/logout`) that clears the session and redirects to Login.
19. Unauthenticated or unauthorized shells expose only `Login` and `Register` entry points; protected navigation is hidden until authentication succeeds.
20. Authenticated users can update their own first and last name from My Profile without changing their email, role, status, or organization.
21. A successful profile update refreshes the active client session so the updated name appears immediately throughout the application.
22. Post-MVP self-service password reset is available to active accounts with local-password credentials, including the global Site Admin and organization users.
23. The password-reset request always returns the same generic response, whether the email is unknown, inactive, external-only, throttled, or eligible.
24. An eligible reset request sends a private link containing a cryptographically random bearer token. The reset page is anonymous, absent from application navigation, and usable only with a valid token.
25. A reset token expires after 24 hours, is single-use, and is invalidated when a newer token is issued for the account.
26. Password-reset email delivery is limited to 3 requests per normalized email and 10 requests per source IP in a rolling 15-minute window. Requests over either limit retain the generic response but do not send an email.
27. The reset form requires `newPassword` and `confirmPassword`; the values must match and satisfy the existing password complexity policy.
28. Invalid, expired, superseded, and used tokens produce the same invalid-link state with an action to request a new reset email.
29. A successful self-service reset revokes all existing sessions, consumes the token, shows confirmation, and returns the user to Login without authenticating them automatically.
30. Plaintext reset token values and plaintext passwords must not be persisted or written to logs, audit metadata, analytics, or error responses.
31. `User.MustChangePassword` is the persisted source of truth for the standalone required-change flow. It is set for the seeded Site Admin initial credential and admin-provided initial or temporary credentials, and cleared after a successful password change.
32. Authenticated users without `MustChangePassword` use My Profile for voluntary password changes and cannot access the standalone required-change page.
33. Persisted client authentication data is a cached session candidate and must not establish an authenticated client principal until `GET /api/v1/auth/me` accepts the stored bearer token.
34. When the API rejects a stored or active bearer token, the client clears its authentication state and redirects to `/login`. Endpoint-specific authorization failures must not clear a token that `GET /api/v1/auth/me` still accepts.

## Session Mechanism (Resolved 2026-08-07)
35. `accessToken` is a signed JWT embedding the issuing `User.SecurityStamp` value as a claim. Every authenticated request revalidates the embedded `SecurityStamp` against the user's current database value; a mismatch is rejected the same way an expired token is. This is a JWT-plus-server-side-check design, not an opaque session-table design.
36. "Revoke all existing sessions" (requirement #29 and the self-service reset acceptance criteria) is implemented by regenerating `User.SecurityStamp`. This single write immediately invalidates every previously issued JWT for that user, with no token blocklist or session table required.
37. Access tokens have an absolute lifetime of 480 minutes (8 hours). Client activity can never extend this server-enforced JWT expiry.
38. An authenticated browser session expires after 30 minutes without user activity. The client warns at 28 minutes and displays a live two-minute countdown with actions to stay signed in or sign out.
39. Pointer, keyboard, touch, scroll, and document-visibility activity reset the browser idle deadline. Activity timestamps and logout/expiry signals synchronize across tabs for the same browser profile.
40. "Stay signed in" records browser activity and dismisses the idle warning but does not refresh, replace, or extend the JWT.
41. Idle expiry, absolute JWT expiry, and API rejection of an expired token clear client authentication state and return the user to Login with the message "Your session expired. Sign in again to continue."
42. Explicit logout and logout after a successful required or voluntary password change return to Login without the session-expired message.

## Acceptance Criteria
- [ ] Valid credentials allow login
- [ ] Invalid credentials are rejected
- [ ] Five failed login attempts within 15 minutes trigger a 15-minute lockout
- [ ] Inactive users cannot log in
- [ ] Password changes are rejected if they do not satisfy the password complexity policy
- [ ] Seed Site Admin is created at first run
- [ ] Seed Site Admin must change the environment-provided initial credential on first login
- [ ] Startup fails fast with a clear error if `SiteAdmin__Email` or `SiteAdmin__Password` is missing
- [ ] Development startup seed creates one Org Admin and two User accounts per demo organization using `Abc123!`
- [ ] Development startup seeded demo users can log in with `Abc123!` without a forced password change
- [ ] Admin-issued temporary password reset is implemented in P1
- [ ] Temporary passwords are one-time display, expire after 24 hours, and force password change on first use
- [ ] Authentication outcomes and password-related actions generate audit events
- [ ] Invited users can self-register from `/register` using invite code + profile + password inputs
- [ ] `/logout` clears the active session and redirects to `/login`
- [ ] Unauthenticated protected-route navigation redirects to `/login`, while `/register` remains public
- [ ] Authenticated users without a required password change land on the Dashboard at `/`
- [ ] Only users marked `MustChangePassword` can access the standalone `/change-password` flow
- [ ] Reloading with a valid stored token restores the authenticated session from `GET /api/v1/auth/me`
- [ ] Reloading with an expired or API-unknown stored token clears the client session and redirects to `/login`
- [ ] A protected API `401` clears the client session only when `GET /api/v1/auth/me` also rejects the bearer token
- [ ] Unauthenticated/unauthorized users do not see protected navigation links
- [ ] Authenticated users can update their own first and last name from My Profile
- [ ] A profile update trims and validates both names, emits an audit event, and immediately refreshes the displayed session name
- [ ] Post-MVP reset requests use the same generic response for eligible and ineligible email addresses
- [ ] Post-MVP reset email delivery is limited to 3 requests per normalized email and 10 per source IP within 15 minutes
- [ ] Post-MVP reset links use cryptographically random, single-use tokens that expire after 24 hours and are superseded by newer tokens
- [ ] Post-MVP reset requires matching new and confirmation passwords that satisfy the existing complexity policy
- [ ] Invalid, expired, superseded, and used reset links display the same invalid-link state
- [ ] A successful post-MVP reset revokes all sessions and returns the user to Login without automatic authentication
- [ ] Password-reset requests and outcomes are audited without exposing the token or plaintext password
- [ ] `accessToken` is a JWT carrying the issuing `SecurityStamp` claim; a request whose claim no longer matches the user's current `SecurityStamp` is rejected as unauthenticated
- [ ] Regenerating a user's `SecurityStamp` (on any "revoke all sessions" action) invalidates every previously issued token for that user on their very next request
- [ ] Issued access tokens expire exactly 480 minutes after issuance and browser activity never extends that absolute deadline
- [ ] At 28 minutes without activity, the browser displays an accessible warning with a live two-minute countdown and Stay signed in / Sign out actions
- [ ] Pointer, keyboard, touch, scroll, and visibility activity reset the 30-minute idle deadline and synchronize across open tabs
- [ ] Staying signed in resets only the browser idle deadline; idle or absolute expiry clears all tabs and returns to Login with the session-expired message
- [ ] Explicit logout and successful required or voluntary password changes return to Login without showing the session-expired message