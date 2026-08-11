# Collega MVP Specification Summary (DERIVED — NOT CANONICAL)

> ⚠️ **This file is a derived summary, not a source of truth, and it is not maintained in lockstep with the canonical specs.**
> Its content was last reconciled **2026-08-06**; the canonical `SPEC/*.md` files have moved since.
>
> - **Do not implement from this file.** Read the canonical spec for the area you are changing (`SPEC/README.MD` indexes them; `SPEC/30-Contracts.md` is authoritative for endpoints and payloads).
> - **Where this file disagrees with a canonical spec, the canonical spec wins.** That is a precedence rule, not a conflict — resolve it and move on. It is *not* the "specs conflict, ask the user" case in `CLAUDE.md`, which covers disagreement between two **canonical** specs.
> - **Do not edit behavior here.** Update the canonical spec first; this summary is regenerated from it.
>
> Kept because a single-file overview is genuinely useful for orientation and onboarding. Read it for shape, never for detail.

## Document Metadata
- Status: **Derived summary — non-canonical**
- Last reconciled with canonical specs: 2026-08-06
- Audience: Engineering, Product, QA, AI coding agents — for orientation only
- Purpose: One-file orientation view of the MVP. Canonical rules live in the individual `SPEC/*.md` documents.

## Product Intent
Collega is a tenant-scoped collaboration platform for capturing, refining, and advancing process ideas.
The MVP emphasizes strict role boundaries, predictable lifecycle behavior, and contract-first API implementation.

The system supports organization administration, board workflow configuration, and idea collaboration through tags, mentions, comments, and upvotes.
Security-sensitive flows include password policy enforcement, lockout handling, forced first-login password change, and audited administration actions.

## Source of Truth and Usage
- Canonical behavior lives in the individual `SPEC/*.md` documents, indexed by `SPEC/README.MD`.
- **This file is not an implementation entrypoint.** Use it to orient; read the canonical spec before changing behavior.
- If behavior changes, update the canonical spec first, then reconcile this summary and bump its "Last reconciled" date.

## MVP Scope
### In Scope
- Authentication, first-login password change, and invite-code self-registration
- Organization and user administration
- Boards and statuses with swimlane ordering
- Idea CRUD and status movement
- Tags, mentions, comments, and upvotes
- Audit event generation
- Notification event persistence for internal verification

### Deferred Scope
- OAuth and SSO
- Reporting
- Guaranteed outbound email delivery
- Remember-this-device behavior
- Public event query endpoints

## Roles and Permission Summary
| Role | Core Responsibility | Notable Limits |
|---|---|---|
| Site Admin | Global platform administration across organizations | Not tenant-owned |
| Org Admin | Administration within own organization | Cannot administer outside own org |
| User | Creates/edits ideas and collaborates | No organization administration |
| Read Only | Collaboration via comments and upvotes | Cannot edit idea content or board configuration |

Key rule: all tenant-owned data is organization-scoped; Site Admin is global and not organization-owned.

## Global Invariants and Data Rules
- Emails are globally unique.
- Non-Site Admin users have exactly one organization and one role.
- Organization and user text fields are trimmed before validation and persistence.
- Status deletion is soft-delete only; historical/detail references remain readable.
- Non-2xx API responses use a problem-details-style envelope.
- Update behavior is last-write-wins unless a narrower contract states otherwise.
- Identifiers are GUID strings and timestamps are UTC ISO-8601 strings.
- Pagination shape is `items`, `page`, `pageSize`, `totalCount`, `sortBy`, `sortDirection`.

## Feature Behavior
### Authentication and Access
- Login uses email and password.
- Invited users can self-register from a public `/register` page using a valid organization invite code; the code determines which organization the account joins. A missing or invalid code is rejected with a prompt to provide a correct one.
- Inactive users are denied authentication.
- Lockout: 5 failed attempts in 15 minutes trigger a 15-minute lockout window.
- Seeded Site Admin must change password on first successful login.
- Development-only seed creates exactly 2 demo organizations, each with two boards containing 11 deterministic ideas distributed `3/2/2/1/3` in canonical status order.
- Each demo organization includes one Org Admin and two User accounts initialized with `Abc123!` without a forced password change; the global Site Admin remains organization-independent.
- Access tokens expire absolutely after 480 minutes. Browser inactivity expires after 30 minutes with a synchronized cross-tab warning beginning at minute 28; staying signed in does not extend the token.
- Admin-issued temporary password reset is one-time display, expires in 24 hours, and forces password change on first use.
- Post-MVP self-service reset uses a private single-use email link that expires after 24 hours, returns generic request and invalid-link responses, and revokes all sessions after success.

### Organizations and Users
- Only Site Admin can create organizations.
- Site Admin and Org Admin can edit organizations in authorized scope.
- Every organization has a system-generated, unique invite code, shown in list and detail views; Site Admin and Org Admin (own org) can regenerate it, which invalidates the previous code.
- Users join an organization by self-registering with its invite code, by direct admin creation, or by admin CSV import; the latter two do not require an invite code.
- Archiving an organization invalidates its invite code; self-registration against an archived organization is rejected.
- Organizations are archived, never hard-deleted.
- New organizations auto-provision default statuses and one default board.
- Last Org Admin self-demotion/deactivation is blocked.
- User states are limited to `Active` and `Inactive` in MVP.

### Boards and Statuses
- Statuses are organization-scoped.
- Default statuses are provisioned on organization creation.
- Boards require at least 2 swimlanes.
- Swimlane reorder persists immediately after drag-and-drop completion.
- Boards can select subsets of organization statuses.

### Ideas and Engagement
- Required fields: title, description, priority.
- Limits: title 150, description 4000, comment body 2000, tag name 100.
- Default status is the left-most swimlane when omitted at create time.
- Board cards remain compact: title, priority, assignee display, upvote state.
- Clicking card title opens the Idea Detail drawer (right slide-in; addressable as `/ideas/{ideaId}`, `?idea={ideaId}` over lists/boards) for full edit workflow; the same drawer is reached from the Ideas list. Create uses a centered modal. (See `SPEC/20-feature-client-ui.md` → Idea Detail Surface.)
- Ideas in `Complete` remain editable and collaborative.
- Mentions resolve by same-organization email only.
- Unresolved mentions show inline validation and block save.
- Upvote is a toggle with max one active upvote per user per idea.

### Notifications and Audit
- Notification events are generated for idea mention, comment mention, comment-on-idea, and status change.
- Notification events are persisted for internal verification in MVP.
- Guaranteed outbound email delivery remains deferred.
- Audit events are required for auth, admin, and idea lifecycle actions.

## API Contract Summary Matrix
Route and payload authority: `SPEC/30-Contracts.md`.

| Endpoint | Primary Actors | Request Summary | Success Summary | Key Errors |
|---|---|---|---|---|
| `POST /api/v1/auth/login` | Anonymous | `email`, `password` | Auth payload with token/session data and `requiresPasswordChange` | 401, 403, 429 |
| `POST /api/v1/auth/register` | Anonymous | `inviteCode`, `firstName`, `lastName`, `email`, `password` | `201` with `userId`, `organizationId`, `email`, `role`, `status` | 400, 409 |
| `GET /api/v1/auth/me` | Authenticated | None | Current user summary | 401 |
| `POST /api/v1/auth/change-password` | Authenticated | `currentPassword`, `newPassword` | 204 | 400, 401, 403 |
| `POST /api/v1/users/{userId}/temporary-password` | Site Admin, Org Admin (scope) | Admin-issued reset intent | Temporary password + must-change flag | 401, 403, 404 |
| `POST /api/v1/auth/password-reset/request` (post-MVP) | Anonymous | `email` | Generic 202 response | 400 |
| `POST /api/v1/auth/password-reset/confirm` (post-MVP) | Anonymous with reset token | `token`, `newPassword`, `confirmPassword` | 204; sessions revoked | 400 |
| `GET /api/v1/organizations` | Site Admin | Paging/filter/sort query | Paged organization list | 401, 403 |
| `POST /api/v1/organizations` | Site Admin | Organization create fields | `organizationId`, `defaultBoardId`, `defaultStatusCount` | 400, 401, 403 |
| `GET /api/v1/organizations/{organizationId}` | Site Admin, Org Admin (scope) | None | Organization detail | 401, 403, 404 |
| `PUT /api/v1/organizations/{organizationId}` | Site Admin, Org Admin (scope) | Organization update fields | Updated organization detail | 400, 401, 403, 404 |
| `PUT /api/v1/organizations/{organizationId}/logo` | Site Admin, Org Admin (scope) | `multipart/form-data` logo file | Logo URL/thumbnail/height metadata | 400, 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/archive` | Site Admin, Org Admin (scope) | None | 204 | 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/invite-code/regenerate` | Site Admin, Org Admin (scope) | None | `inviteCode` | 401, 403, 404 |
| `GET /api/v1/organizations/{organizationId}/users` | Site Admin, Org Admin (scope) | Paging/filter/sort query | Paged user list | 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/users` | Site Admin, Org Admin (scope) | User create fields | User create summary | 400, 401, 403, 404 |
| `GET /api/v1/organizations/{organizationId}/users/import-template` | Site Admin, Org Admin (scope) | None | UTF-8 CSV template attachment | 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/users/import` | Site Admin, Org Admin (scope) | `multipart/form-data` CSV file | Organization ID + created-user count | 400, 401, 403, 404 |
| `GET /api/v1/users/{userId}` | Site Admin, Org Admin (scope) | None | User detail | 401, 403, 404 |
| `PUT /api/v1/users/{userId}` | Site Admin, Org Admin (scope) | User update fields | Updated user detail | 400, 401, 403, 404 |
| `GET /api/v1/organizations/{organizationId}/statuses` | Site Admin, Org Admin, User, Read Only (scope) | None | Status list | 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/statuses` | Site Admin, Org Admin (scope) | `name` | Status create summary | 400, 401, 403, 404 |
| `PUT /api/v1/statuses/{statusId}` | Site Admin, Org Admin (scope) | `name` | Updated status summary | 400, 401, 403, 404 |
| `DELETE /api/v1/statuses/{statusId}` | Site Admin, Org Admin (scope) | None | 204 | 401, 403, 404 |
| `GET /api/v1/organizations/{organizationId}/boards` | Site Admin, Org Admin, User, Read Only (scope) | None | Board list | 401, 403, 404 |
| `POST /api/v1/organizations/{organizationId}/boards` | Site Admin, Org Admin (scope) | Board name + swimlane map | Board create summary | 400, 401, 403, 404 |
| `GET /api/v1/boards/{boardId}` | Site Admin, Org Admin, User, Read Only (scope) | None | Board detail | 401, 403, 404 |
| `PUT /api/v1/boards/{boardId}` | Site Admin, Org Admin (scope) | Board update payload | Updated board detail | 400, 401, 403, 404 |
| `POST /api/v1/boards/{boardId}/swimlanes/reorder` | Site Admin, Org Admin (scope) | Swimlane order payload | 204 | 400, 401, 403, 404 |
| `GET /api/v1/boards/{boardId}/ideas` | Site Admin, Org Admin, User, Read Only (scope) | Paging/filter/sort query | Paged idea list | 401, 403, 404 |
| `POST /api/v1/boards/{boardId}/ideas` | Site Admin, Org Admin, User (scope) | Idea create payload | Idea create summary | 400, 401, 403, 404 |
| `GET /api/v1/ideas/{ideaId}` | Site Admin, Org Admin, User, Read Only (scope) | None | Idea detail with collaboration data | 401, 403, 404 |
| `PUT /api/v1/ideas/{ideaId}` | Site Admin, Org Admin, User (scope) | Idea update payload | Updated idea detail | 400, 401, 403, 404 |
| `POST /api/v1/ideas/{ideaId}/status` | Site Admin, Org Admin, User (board-configured) | `statusId` | 204 | 400, 401, 403, 404 |
| `GET /api/v1/ideas/{ideaId}/comments` | Site Admin, Org Admin, User, Read Only (scope) | Paging query | Paged chronological comments | 401, 403, 404 |
| `POST /api/v1/ideas/{ideaId}/comments` | Site Admin, Org Admin, User, Read Only (scope) | `body` | Comment create summary | 400, 401, 403, 404 |
| `PUT /api/v1/comments/{commentId}` | Comment author (scope) | `body` | Updated comment summary | 400, 401, 403, 404 |
| `DELETE /api/v1/comments/{commentId}` | Comment author, Site Admin, Org Admin (scope) | None | 204 | 401, 403, 404 |
| `POST /api/v1/ideas/{ideaId}/upvote/toggle` | Site Admin, Org Admin, User, Read Only (scope) | None | `hasUpvoted`, `upvoteCount` | 401, 403, 404 |

## Validation and Error Semantics
- API boundary validates shape, required fields, and basic field constraints.
- Application and Domain enforce business rules, authorization rules, and invariants.
- Problem-details envelope is mandatory for all non-2xx responses.
- Sensitive flows define success, failure, expiry, and recovery behavior explicitly.

## Architecture Boundaries
- API: HTTP mapping, authentication middleware, validation, response contracts
- Application: use-case orchestration, tenant scoping, authorization enforcement
- Domain: entity invariants and lifecycle rules
- Infrastructure: persistence, hashing, seeding, audit/notification event storage
- Client: role-aware UX and clear validation feedback without owning business rules

## Test and Verification Mapping
### Unit
- Authentication rules and lockout behavior
- Site Admin and Development seed rules, including idempotency
- User CSV parsing, validation, duplicate detection, and atomic rejection behavior
- Board validation rules
- Tag normalization and concurrency merge behavior
- Mention resolution behavior
- Upvote toggle and ownership behavior

### Integration
- Auth success/failure/lockout branches
- Protected endpoints rejecting unauthenticated calls
- Site Admin forced password change on first login
- Development demo seed graph and user setup
- Tenant-scoped organization and user CRUD
- User CSV template download and authorized atomic import success/failure paths
- Board minimum-swimlane enforcement
- Idea comment and upvote role behavior

### Contract
- Response and request semantics aligned with `SPEC/30-Contracts.md`
- Problem-details envelope on all non-2xx responses
- Authentication, organization, user, board, status, idea contract alignment with `SPEC/30-Contracts.md`

### Startup Safety
- Demo seed runs only in Development
- Non-Development startup suppresses demo seed

## Delivery Constraints and Non-Goals
- No hardcoded secrets.
- No new package additions without explicit approval.
- Deferred scope must not leak into MVP implementation.
- Spec changes must be reflected in contract and verification artifacts.

## Resolved Decisions (2026-07-30)
- Validation message conventions are standardized in `SPEC/30-Contracts.md` and must be mirrored by UI text where practical.
- Reporting baseline requirements and export formats are defined in `SPEC/20-feature-reporting.md` as post-MVP scope.
- OAuth account-link and claim-mapping edge-case decisions are defined in `SPEC/20-feature-oauth.md`.
- Rich-content and attachment direction is defined in `SPEC/20-feature-ideas-and-engagement.md` as out of MVP and out of initial OAuth phase scope.

Open questions remaining for MVP: none.

## AI Agent Usage Notes
### Recommended Reading Order for Implementation
1. MVP Scope and Roles
2. Global Invariants
3. Relevant Feature Behavior section
4. API Contract Summary Matrix row(s)
5. Validation and Error Semantics
6. Test and Verification Mapping

### Clarification Rule
If behavior is ambiguous or conflicting, ask for clarification before implementation.

### Change Control Rule
Update canonical `SPEC/*.md` first, then align this overview, implementation, and tests.

## Traceability Matrix
| Behavior Rule | Canonical Source(s) | Verification Target(s) |
|---|---|---|
| Global email uniqueness for login and users | `SPEC/10-requirements.md`, `SPEC/20-feature-auth.md`, `SPEC/20-feature-organizations-and-users.md`, `SPEC/30-Contracts.md` | Unit: auth and user uniqueness rules. Integration: login and user CRUD scope checks. |
| Organization user CSV template and atomic import | `SPEC/10-requirements.md`, `SPEC/20-feature-organizations-and-users.md`, `SPEC/30-Contracts.md` | Unit: CSV parsing, limits, defaults, role restrictions, and duplicate detection. Integration/Contract: template response and import success, authorization, row errors, and no partial persistence. |
| Lockout after 5 failed attempts in 15 minutes with 15-minute lockout | `SPEC/20-feature-auth.md`, `SPEC/20-feature-user-login.md`, `SPEC/30-Contracts.md` | Unit: lockout threshold/expiry. Integration: `/api/v1/auth/login` lockout branch. |
| Seeded Site Admin must change password on first login | `SPEC/20-feature-auth.md`, `SPEC/20-feature-user-login.md` | Unit: first-login flag behavior. Integration: first-login password-change gating. |
| Development-only demo seed and non-Development suppression | `SPEC/10-requirements.md`, `SPEC/20-feature-auth.md`, `SPEC/20-feature-organizations-and-users.md`, `SPEC/40-test-strategy.md` | Unit: idempotent seed graph creation. Integration/Startup Safety: Development-only seeding and suppression outside Development. |
| Organization archive behavior and default hidden archived records | `SPEC/20-feature-organizations-and-users.md`, `SPEC/30-Contracts.md` | Integration: organization list/archive behavior and role boundaries. |
| New organization bootstrap provisions default statuses and one default board | `SPEC/20-feature-organizations-and-users.md`, `SPEC/20-feature-boards-and-statuses.md`, `SPEC/30-Contracts.md` | Integration: organization create bootstrap assertions. |
| Status soft-delete with historical name visibility | `SPEC/20-feature-boards-and-statuses.md`, `SPEC/30-Contracts.md` | Unit: status lifecycle logic. Integration: status delete/history behavior. |
| Board must have at least two swimlanes and reorder persists immediately | `SPEC/20-feature-boards-and-statuses.md`, `SPEC/30-Contracts.md` | Unit: board validation. Integration: create reject path and reorder persistence. |
| Idea and collaboration field constraints (title/description/comment/tag) | `SPEC/20-feature-ideas-and-engagement.md`, `SPEC/30-Contracts.md` | Unit: validation rules and normalization behavior. Contract: schema alignment checks. |
| Mention resolution is same-organization only and unresolved mentions block save | `SPEC/20-feature-ideas-and-engagement.md`, `SPEC/60-spec-q-and-a-backlog.md` | Unit: mention resolution/validation logic. Integration: idea/comment save behavior with mentions. |
| Upvote toggle, one active upvote per user per idea, owner-only removal | `SPEC/20-feature-ideas-and-engagement.md`, `SPEC/30-Contracts.md` | Unit: upvote ownership/toggle behavior. Integration: upvote endpoint role behavior. |
| Problem-details envelope on all non-2xx responses | `SPEC/30-Contracts.md`, `SPEC/40-test-strategy.md` | Contract: error-envelope assertions. Integration: protected and validation failure response checks. |
| Notification events persisted in MVP while outbound email remains deferred | `SPEC/20-feature-notifications.md`, `SPEC/30-Contracts.md`, `SPEC/50-technical-implementation-plan.md` | Unit/Integration: event emission and persistence checks. Release hardening: deferred outbound delivery remains out of scope. |
| Audit events required for auth, admin, and idea lifecycle actions | `SPEC/20-feature-auth.md`, `SPEC/20-feature-organizations-and-users.md`, `SPEC/20-feature-ideas-and-engagement.md`, `SPEC/50-technical-implementation-plan.md` | Unit/Integration: audit generation for required workflows. |

## Source Index
- `SPEC/00-project-brief.md`
- `SPEC/10-requirements.md`
- `SPEC/20-feature-auth.md`
- `SPEC/20-feature-oauth.md`
- `SPEC/20-feature-saml.md`
- `SPEC/20-feature-user-login.md`
- `SPEC/20-feature-organizations-and-users.md`
- `SPEC/20-feature-boards-and-statuses.md`
- `SPEC/20-feature-ideas-and-engagement.md`
- `SPEC/20-feature-notifications.md`
- `SPEC/30-Contracts.md`
- `SPEC/40-test-strategy.md`
- `SPEC/50-technical-implementation-plan.md`
- `SPEC/60-spec-q-and-a-backlog.md`
- `SPEC/70-delivery-backlog.md`
- `SPEC/80-workstream-roadmap.md`
- `SPEC/85-implementation-timeline.md`
- `SPEC/90-definition-of-done.md`