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

## Decision Log (2026-08-06): Comp C Pivot Propagation and Related Spec Drift

Found during a structured spec-audit interview: the 2026-08-06 client UI pivot from Comp A to Comp C ("Fluent Editorial") — recorded in `CLAUDE.md` and `SPEC/implementation-agent-tracker.md` — had not been propagated into the canonical feature specs, which still described the superseded Comp A overlay pattern. Client Agent tasks (T040-T045, C6-Kanban) were queued next and would have been built against the stale pattern.

### 7. Idea Detail: overlay vs. full page
Resolved: Idea Detail is a full-page, editorial article layout at `/ideas/{ideaId}/edit` (not an overlay), per the Comp C direction. This is one Idea Detail experience reached from two entry points — a board card title and the Ideas list `Details` link — not two separate surfaces. Updated in `20-feature-client-ui.md`, `20-feature-client-ui-revisions.md`, `20-feature-ideas-and-engagement.md`, `20-feature-user-defined-fields.md`, `30-Contracts.md`, `40-test-strategy.md`, `50-technical-implementation-plan.md`, `70-delivery-backlog.md`, `85-implementation-timeline.md`, `Specs Overview.md`, and `implementation-agent-tracker.md`.

**Superseded 2026-08-10:** this full-page resolution is reversed. Idea Detail is now a right slide-in **drawer** (detail + inline edit) with a centered **create modal**, addressable at `/ideas/{ideaId}` / `?idea={ideaId}` — the `/ideas/{ideaId}/edit` route is retired. Reference comp `SPEC/mockups/comp-c-review-09-detail-surfaces.html`; canonical spec `SPEC/20-feature-client-ui.md` → **Idea Detail Surface**. Still one experience, three entry points (Ideas list, Board List rows, Swim Lane cards). Re-propagated across the same spec set on 2026-08-10.

### 8. Notification idea-link route
Resolved: `30-Contracts.md`'s internal notification payload used a stale `ideaLink` format (`/org/{organizationId}/boards/{boardId}/ideas/{ideaId}`) that `20-feature-notifications.md` had already documented as superseded. `30-Contracts.md` is corrected to `/ideas/{ideaId}` to match. *(Update 2026-08-10: the interim `/ideas/{ideaId}/edit` was itself retired when the full-page Idea Detail became a slide-in drawer; the canonical link is now the drawer-addressable `/ideas/{ideaId}`.)*

### 9. Default status set
Resolved: the canonical default status set stays as the existing 5 (`New/Pending`, `In Review`, `In Progress`, `Client Review`, `Complete`) in `20-feature-boards-and-statuses.md`. The comp's proposed 4-status illustrative set (`New`, `Research In Process`, `In Review`, `Complete`) is not adopted; `comp-c-review-05-admin-statuses.html` and `comp-c-review-03-board-list.html` need their illustrative data updated to match before those comps can lock. No canonical spec file needed a text change for this decision, since it confirms the existing value — see `implementation-agent-tracker.md` for the reconciliation task.

## Decision Log (2026-08-07): Follow-Up Interview on Newly Found Items

Resolved via a second structured interview covering the four items flagged open at the end of the 2026-08-06 spec-audit session.

### 10. Status Color/SortOrder fields
Resolved: adopted into the canonical spec now, not deferred until the comp locks. `20-feature-boards-and-statuses.md` gains `Status.Color` (hex/CSS, max 20 chars) and `Status.SortOrder` (int, organization-level catalog order, distinct from a board's independently-reorderable swimlane order). Default `Color`/`SortOrder` values for the 5 canonical default statuses are still unassigned — that specific sub-item remains open (see Remaining MVP Clarifications below).

### 11. Last-status minimum vs. board's 2-swimlane minimum
Resolved: the organization-wide active-status minimum is raised to 2, matching a board's own swimlane minimum (rather than reusing the 1-active-option minimum pattern from Idea Type/Business Impact). A status delete that would drop an organization below 2 active statuses is rejected regardless of whether that status is currently referenced as a swimlane. Recorded in `20-feature-boards-and-statuses.md`. Note: `comp-c-review-05-admin-statuses.html`'s "last-status guard" demo still shows the old 1-remaining threshold and needs updating to 2 — tracked in `implementation-agent-tracker.md`.

### 12. `SPEC/25-client-ui.md` stale duplicate
Resolved: deleted. It had no unique content beyond what `20-feature-client-ui.md`/`20-feature-client-ui-revisions.md` already cover more accurately (it still referenced pre-Settings-rename `/admin/organization/...` routes and Comp A typography).

### 13. C6-Kanban backlog task vs. the `/ideas` list page
Resolved: keep both. `/ideas` remains a cross-board list/search surface (Created by me / Assigned to me) alongside the per-board Kanban/list view — useful when a user's ideas span multiple boards. `implementation-agent-tracker.md`'s C6-Kanban task wording updated to stop implying `/ideas` gets replaced.

## Decision Log (2026-08-07): Auth Implementation Kickoff Questions

Found while the Auth Agent slice (T005-T011) was actively in progress — two contract ambiguities the Backend Developer agent needed answered to proceed correctly.

### 14. Access token format and session revocation
Resolved: `accessToken` is a signed JWT embedding the user's current `SecurityStamp` as a claim (not an opaque server-tracked session token). Every authenticated request revalidates the claim against the user's current database `SecurityStamp`. "Revoke all existing sessions" (admin-issued and self-service password reset) regenerates `SecurityStamp`, invalidating every previously issued token at once. Recorded in `20-feature-auth.md` (new requirements #35-36) and `30-Contracts.md` (new "Access Token Format and Session Revocation" subsection).

### 15. Validation message casing
Resolved: the `errors` object *keys* stay camelCase (matching wire JSON field names); the `<FieldName>` substituted into message *text* uses human-readable, spaced Title Case (e.g. "First Name is required."), independent of the JSON key casing. This closes the judgment call the Epic 1 Foundation agent flagged in `implementation-agent-tracker.md`. Recorded in `30-Contracts.md`'s Validation Message Conventions section.

## Decision Log (2026-08-07): Demo Password Policy Conflict

### 16. Demo password `abc123!` violates the password complexity policy
Found by the Backend Developer agent implementing the Auth Agent slice: `SPEC/10-requirements.md` specified the Development demo password verbatim as `abc123!`, but `SPEC/20-feature-auth.md` requirement #5 requires uppercase + lowercase + numeric + special characters, and `abc123!` has no uppercase. The agent had bypassed policy validation in the seeder to honor the literal value rather than silently resolving the conflict.
Resolved: changed the demo password to `Abc123!` (minimal change — capitalizes the first letter) everywhere it's referenced, rather than carving out a policy exception. Updated in `10-requirements.md`, `20-feature-auth.md`, `40-test-strategy.md`, `Specs Overview.md`, `SPEC/SPECKIT/specs/002-authentication-and-access/spec.md`, and `src/Collega.Infrastructure/Seeding/StartupSeeder.cs` (`DemoPassword` constant, bypass-justifying doc comment removed since it's no longer needed).

## Remaining MVP Clarifications
- Default `Status.Color` and `Status.SortOrder` values for the 5 canonical default statuses (`New/Pending`, `In Review`, `In Progress`, `Client Review`, `Complete`) have not been chosen yet.

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
