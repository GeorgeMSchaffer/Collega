# Feature Specification: Authentication and Access

## Derived Sync Metadata
- Status: Derived
- Canonical Sources:
	- `SPEC/10-requirements.md`
	- `SPEC/20-feature-auth.md`
	- `SPEC/20-feature-user-login.md`
	- `SPEC/30-Contracts.md`
	- `SPEC/contracts/auth.md` (the authentication contracts, split out of `SPEC/30-Contracts.md` on 2026-09-28)
	- `SPEC/40-test-strategy.md`
- Last Canonical Sync Date: 2026-09-29 for the session and required-change lines (they described a stored bearer token until then); 2026-08-08 for the rest

## Summary
Implement authentication with globally unique email credentials, seeded global Site Admin bootstrap, password rules, inactive-account denial, and account lockout behavior.

## Requirements
- Users authenticate with email and password.
- User accounts are organization-scoped, and email is globally unique across the system.
- Passwords follow the defined complexity policy.
- Five failed login attempts within 15 minutes cause a 15-minute lockout.
- Inactive accounts cannot log in.
- The global Site Admin is seeded from an environment-provided initial credential and must change it on first login.
- In Development only, startup seed creates exactly two demo organizations with one Org Admin and two User accounts in each, using demo password `Abc123!` without a forced password change. Each organization has two boards with 11 ideas per board distributed `3/2/2/1/3` in canonical status order. The global Site Admin remains organization-independent.
- Admin-issued temporary password reset is an MVP/P1 capability and uses one-time display temporary passwords that expire after 24 hours and force password change on first use.
- `User.MustChangePassword` gates the standalone required-change route for seeded Site Admin and admin-provided initial or temporary credentials. Authenticated users without the flag use My Profile for voluntary password changes.
- Unauthenticated protected client routes redirect to `/login`; authenticated users without a required password change land on the Dashboard at `/`; `/logout` clears the session and returns to `/login`.
- The session is the httpOnly `collega_session` cookie the API sets on login; no client script can read it, and the client holds no token of its own. A holder of the cookie is not treated as signed in until `GET /api/v1/auth/me` accepts it and returns the current user (`SPEC/20-feature-auth.md` requirement 33).
- When the API rejects the session cookie (expired, revoked, or unknown), the client drops the cookie and redirects to `/login`. An endpoint's own `401` refusal, such as a wrong current password, does not end a session that `GET /api/v1/auth/me` still accepts (requirement 34).
- `MustChangePassword` is enforced at the API: while it is true, every authenticated endpoint except `GET /api/v1/auth/me` and `POST /api/v1/auth/change-password` answers `403`. Completing the change regenerates the user's `SecurityStamp`, which ends that session; the user signs in again with the new password (requirement 32a).
- JWTs expire absolutely after 480 minutes. Browser inactivity expires after 30 minutes, warns at minute 28, synchronizes activity/logout across tabs, and never extends the absolute JWT deadline.
- Idle or absolute expiry returns to Login with a specific session-expired message. Explicit logout and successful required or voluntary password changes return to Login without that message.
- Post-MVP self-service reset sends active local-password users a private, single-use bearer-token link that expires after 24 hours and is invalidated by a newer request.
- Post-MVP reset requests use a generic response, limit delivery to 3 per normalized email and 10 per source IP within 15 minutes, and do not reveal account eligibility.
- Post-MVP reset confirmation requires matching passwords that satisfy the existing complexity policy, consumes the token, revokes all sessions, and returns the user to Login.
- Invalid, expired, superseded, and used reset tokens share one invalid-link state, and reset secrets are excluded from persistence, logs, audit metadata, analytics, and responses.
- Authentication outcomes and password actions are audited.
- OAuth/OIDC and SAML implementation are out of MVP scope and scheduled for post-MVP phases.
