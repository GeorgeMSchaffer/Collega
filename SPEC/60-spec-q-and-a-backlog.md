# Remaining Spec Q&A Backlog

## Purpose
Track clarification decisions and any unresolved items that affect future scope or incomplete contract details.

## Decision Log (2026-07-30)

### 1. Validation message conventions
Resolved: Standard validation message patterns are defined in `SPEC/30-Contracts.md`.
Implementation direction:
- API uses standardized wording templates for required, length, format, enum, range, and unresolved mention cases.
- UI mirrors API wording where practical.
- `errors` object keys use request field names.

Resolved field decisions:
- user email is globally unique across the system
- comment body max length is 2000 characters
- comment bodies are plain text and may include line breaks
- first and last name max length is 100 characters
- company name max length is 200 characters
- address max length is 200 characters
- city max length is 100 characters
- state max length is 50 characters
- zip max length is 20 characters
- phone max length is 25 characters
- organization and user text fields are trimmed before validation and persistence
- archived organizations are hidden by default unless explicitly filtered in
- soft-deleted statuses keep their prior name with an archived or deleted label in historical or detail views
- audit events include both human-readable messages and structured metadata
- audit and notification events do not require read or query endpoints in MVP
- temporary passwords are one-time display, expire after 24 hours, and force password change on first use
- unresolved mentions show inline validation and block save
- comment entry uses a live character counter and inline overflow validation
- board and admin views use guided empty states with a primary action and short explanatory text
- event verification uses tests and internal diagnostics outside the public API surface

### 2. Reporting requirements
Resolved: Initial reporting scope and export baseline are defined in `SPEC/20-feature-reporting.md`.
Implementation direction:
- Reporting remains out of MVP.
- First reporting phase defines specific report categories plus CSV-required and JSON-optional exports.

### 3. OAuth and SSO direction
Resolved: OAuth implementation is scheduled for post-MVP Phase 2 with Microsoft Entra ID first, and SAML is scheduled after OAuth stabilization.
Resolved follow-up: account-link conflict handling and claim-mapping edge-case rules are now defined in `SPEC/20-feature-oauth.md`.

### 4. Attachments and rich content
Resolved: Direction is defined in `SPEC/20-feature-ideas-and-engagement.md`.
Implementation direction:
- MVP remains plain text for idea descriptions and comments.
- Rich text, embedded content, and file attachments are deferred to a future phase.

## Decision Log (2026-08-06): Overview Sync Gaps

### 5. `Specs Overview.md` omitted invite-code self-registration
Found while drafting `SPEC/85-implementation-timeline.md`: `SPEC/Specs Overview.md` — despite being "the preferred AI ingestion entrypoint" — omitted invite-code self-registration, invite-code display/regeneration, and the `POST /api/v1/auth/register` and invite-code-regenerate endpoints, even though `SPEC/10-requirements.md`, `SPEC/20-feature-auth.md`, `SPEC/20-feature-organizations-and-users.md`, `SPEC/25-client-ui.md`, and `SPEC/30-Contracts.md` all define this behavior as MVP/canonical, and `SPEC/70-delivery-backlog.md` already tasks it under Epic 3.
Resolved: this was an omission in the overview, not a scope change. Self-registration via invite code remains in MVP scope. `Specs Overview.md` has been updated (Authentication and Access, Organizations and Users, MVP In Scope, and the API Contract Summary Matrix) to match the canonical specs.

### 6. Seed Site Admin credential configuration keys were unnamed
No spec named the actual configuration key(s) for the "environment-provided initial credential" used to seed the global Site Admin.
Resolved: use standard ASP.NET Core configuration keys `SiteAdmin__Email` and `SiteAdmin__Password` (settable via environment variables, `dotnet user-secrets`, or a Kubernetes secret), consistent with the existing `ConnectionStrings__DefaultConnection` convention in `SPEC/50-kubernetes-deployment.md`. Startup must fail fast if either key is missing. Recorded in `SPEC/20-feature-auth.md`, `SPEC/50-technical-implementation-plan.md`, and `SPEC/50-kubernetes-deployment.md`.

## Remaining MVP Clarifications
None.

## Remaining Post-MVP Clarifications
- None currently blocking planning. New questions should be added here when introduced.

## Decision Log (2026-08-04): Password Reset

1. MVP/P1 retains the existing admin-issued temporary-password reset; anonymous email-only password replacement is not allowed.
2. Post-MVP self-service reset uses a cryptographically random bearer token delivered by email to an anonymous reset page that is absent from application navigation.
3. Reset tokens expire after 24 hours, are single-use, and are invalidated when a newer token is issued for the account.
4. Reset requests always return the same generic response and do not reveal whether an account exists, is active, uses local credentials, or is throttled.
5. Delivery is limited to 3 requests per normalized email and 10 requests per source IP in a rolling 15-minute window; excess requests silently suppress email delivery.
6. The reset form requires matching `newPassword` and `confirmPassword` values that satisfy the existing password complexity policy.
7. Invalid, expired, superseded, and used tokens display the same invalid-link state with an action to request a new email.
8. A successful reset revokes all existing sessions and returns the user to Login without automatic authentication.
9. Self-service reset is available only to active local-password accounts, including Site Admin and organization users.
