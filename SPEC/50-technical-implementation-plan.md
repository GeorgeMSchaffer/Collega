# Technical Implementation Plan

## Goal
Deliver the Collega MVP as a layered ASP.NET Core application with a Blazor client, SQL Server persistence, organization-scoped authorization, audit coverage, and contract-aligned API behavior.

## Restart Baseline
- This plan assumes implementation is restarting from the beginning.
- Treat every slice and phase in this document as planned work, not accepted or partially completed work.
- Re-record progress only in the tracker after implementation is intentionally restarted.

## Scope Alignment
- MVP in scope: authentication, organization and user management, boards, statuses, organization-managed Idea Type and Business Impact options, ideas, tags, comments, upvotes, mentions, audit events, and notification event definitions.
- Later phase: queued email notification delivery.
- Post-MVP Phase 2: OAuth/OIDC implementation (Microsoft Entra ID first).
- Post-MVP later phase: SAML implementation.
- Out of scope for MVP: reporting, MFA, social login, and remember-this-device.
- P1 follow-up: admin-issued temporary password reset.

## Delivery Objective
Produce an implementation plan that is detailed enough to drive engineering execution with minimal interpretation by defining:
- the ownership of responsibilities across solution layers
- the persistence and contract strategy
- the build order of feature slices
- the validation gates that confirm spec compliance before moving forward
- the client composition needed for the documented workflows

## Architecture Plan
### Solution Layers
- `Collega.Domain`: entities, enums, value objects, and invariants.
- `Collega.Application`: use cases, authorization rules, validation, audit orchestration, and tenant-aware workflows.
- `Collega.Infrastructure`: EF Core persistence, seeding, auditing persistence, and later-phase notification delivery integrations.
- `Collega.API`: HTTP endpoints, request/response mapping, auth middleware, contract validation, and OpenAPI.
- `Collega.Client`: Blazor UI, forms, boards, and collaboration interactions.

### Layer Responsibilities
#### Domain
- Own entity state and invariant enforcement.
- Model `Organization`, `User`, `Status`, `Board`, `BoardSwimlane`, `IdeaType`, `BusinessImpact`, `Idea`, `Tag`, `IdeaTag`, `Mention`, `Comment`, `Upvote`, `AuditEvent`, and `NotificationEvent`.
- Protect business invariants such as:
  - non-Site Admin users always belonging to exactly one organization
  - one active upvote per user per idea
  - minimum two swimlanes per board
  - soft-delete semantics for statuses
	- at least one active Idea Type and Business Impact per organization
	- required active Idea Type and Business Impact assignment for new and updated ideas

#### Application
- Orchestrate feature workflows and authorization checks.
- Resolve organization scope from caller identity and resource context.
- Coordinate login, organization bootstrap, atomic user CSV import validation and creation, tag normalization, mention resolution, comment permissions, upvote toggling, audit emission, and notification event creation.
- Define ports for persistence, password hashing, token generation, environment configuration, and event persistence.

#### Infrastructure
- Implement EF Core mappings, migrations, repositories or persistence adapters, and transaction boundaries.
- Provide concrete password hashing, token issuance, and seed credential loading.
- Persist audit and notification events.
- Keep later-phase email delivery behind an interface so MVP does not depend on outbound integration.

#### API
- Expose `/api/v1` endpoints matching `SPEC/30-Contracts.md`.
- Validate request shape and field constraints.
- Return problem-details-style error responses for non-2xx outcomes.
- Keep HTTP endpoints thin by delegating all business decisions to Application and Domain services.

#### Client
- Present role-aware workflows using Fluent UI-based pages and components.
- Handle login, admin workflows, board collaboration flows, and detail editing.
- Surface validation clearly without duplicating server-only business rules.

### Core Technical Decisions
- Enforce organization scoping in the Application layer, not in controllers or UI.
- Use a single SQL Server database with organization-owned rows, foreign keys, and a global Site Admin account outside tenant ownership.
- Keep API contracts versioned under `/api/v1` and aligned with `SPEC/30-Contracts.md`.
- Use problem-details-style error responses for all non-2xx outcomes.
- Validate request shape and field constraints at the API boundary; enforce business rules in Application and Domain layers.
- Use last-write-wins updates in MVP unless a narrower contract explicitly says otherwise.
- Treat audit generation as a first-class application concern for auth, administration, and idea lifecycle events.
- Model notification triggers now, but defer guaranteed email delivery infrastructure to a later phase.

### Runtime Architecture
- Authentication is API-driven with a current-user endpoint and a first-login password-change flag.
- Organization scope is applied centrally to all tenant-owned resource operations.
- Audit events are written during successful business transactions where applicable and during both successful and failed auth outcomes.
- Notification events are persisted as internal records during collaboration workflows without requiring outbound email dispatch.

## Implementation Slices
### Slice 1: Auth and Identity
- login, password verification, lockout behavior, inactive-account denial, current-user retrieval, first-login password change

### Slice 2: Tenant Administration
- organization create and archive flows, automatic default board and status provisioning, organization-scoped user CRUD, downloadable user CSV template, atomic user CSV import, lifecycle state handling, last-Org-Admin safeguards

### Slice 3: Workflow Configuration
- statuses, boards, swimlane ordering, soft-delete status behavior, board status subset selection, Idea Type options, Business Impact options

### Slice 4: Idea Collaboration
- idea CRUD and soft delete, field assignments, tags, mentions, comments, upvotes, board-configured user moves, completed-idea behavior

### Slice 5: Cross-Cutting Eventing
- audit events, notification events, event payloads, future extension seams for event queries or delivery

## Detailed Delivery Phases
### Phase 1: Foundation
1. Create the solution structure and project references.
2. Establish shared primitives:
	- GUID identifier conventions
	- UTC timestamp handling
	- enums for roles and lifecycle states
	- reusable problem-details response mapping
3. Add EF Core DbContext, migrations, audit storage design, and base auditing fields.
4. Implement API conventions for `/api/v1`, problem-details handling, and request validation.
5. Set up authentication middleware, authorization policy registration, and current-user context resolution.
6. Seed the global Site Admin using an environment-provided initial credential (`SiteAdmin__Email` / `SiteAdmin__Password`, see `SPEC/20-feature-auth.md`) and mark it for forced password change. Fail startup fast if either configuration key is missing.

Validation gate:
- application boots successfully
- migrations apply cleanly
- non-2xx responses use the standard problem-details envelope
- protected endpoints reject anonymous callers

### Phase 2: Authentication and Access
1. Implement login with globally unique email credentials.
2. Enforce password complexity policy.
3. Enforce inactive-user denial.
4. Implement 5 failed attempts within 15 minutes causing a 15-minute lockout.
5. Implement first-login password change for the seeded Site Admin.
6. Add `GET /api/v1/auth/me` for client bootstrap.
7. Implement the MVP/P1 admin-issued temporary password reset path without requiring self-service email reset.
8. Emit audit events for successful login, failed login, password change, and temporary password issuance.

Validation gate:
- login returns the authenticated payload for valid credentials
- invalid credentials, inactive accounts, and lockout behavior match the contract
- first-login password change is enforced before protected application use

### Phase 3: Organizations and Users
1. Implement organization create, detail, list, edit, and archive flows.
2. Hide archived organizations from default list results unless explicitly filtered in.
3. Automatically provision default statuses and one default board when a new organization is created.
4. Implement user CRUD with exactly one organization and one role for each non-Site Admin user.
5. Support `Active` and `Inactive` user states only.
6. Enforce globally unique email addresses.
7. Trim organization and user text fields before validation and persistence.
8. Enforce organization and user field maximum lengths from the contracts document.
9. Prevent the last Org Admin from removing their own admin access or deactivating themselves.
10. Emit audit events for organization changes, user changes, role changes, and account status changes.

Validation gate:
- Site Admin and Org Admin permissions match the rules matrix
- organization bootstrap creates the expected default board and status set
- archived organizations remain retained but excluded by default from list queries

### Phase 4: Boards and Statuses
1. Implement organization-scoped statuses with default provisioning.
2. Implement soft-delete status behavior while preserving existing idea and board references.
3. Implement boards with selectable subsets of organization statuses.
4. Enforce a minimum of two swimlanes per board.
5. Represent swimlane ordering explicitly through an ordered mapping entity.
6. Persist swimlane order immediately on drag-and-drop completion.
7. Preserve prior status names in detail and historical contexts with an archived or deleted label.
8. Add organization-scoped Idea Type and Business Impact option management with case-insensitive active-name uniqueness, soft deletion, and admin-controlled sort order.
9. Provision `Continuous Improvement`, `Process Revision` and `Low`, `Medium`, `High`, `Critical` for every new organization.
10. Use the first active option by sort order as the default and reject deletion of the last active option.
11. Persist an editable `#RRGGBB` color for Business Impact; do not add color to Idea Type.

Validation gate:
- default statuses exist after organization creation
- boards reject fewer than two swimlanes
- status deletion does not orphan related ideas or board history
- swimlane reorder persists immediately and survives reload
- option order determines defaults deterministically and every organization retains one active option of each type

### Phase 5: Ideas and Engagement
1. Implement idea create, detail, list, edit, and status update flows.
2. Enforce title maximum length of 150 characters and description maximum length of 4000 characters.
3. Default idea status to the left-most board swimlane when omitted.
4. Implement tag autocomplete after 2 characters.
5. Implement tag normalization:
	- trim whitespace
	- compare case-insensitively
	- enforce organization-scoped uniqueness
	- limit tag values to 100 characters
6. Merge concurrent creation of the same normalized tag into one stored tag.
7. Resolve mentions by same-organization email lookup for both ideas and comments.
8. Implement comments with chronological display, author edit and delete, admin delete in scope, and plain-text bodies up to 2000 characters.
9. Implement upvote toggle with one active upvote per user per idea and user-only removal.
10. Support board-configured User status changes for any idea on the board.
11. Keep completed ideas fully collaborative.
12. Emit audit events for idea creation, edits, status changes, comments, and upvote toggles.
13. Add required `IdeaTypeId` and `BusinessImpactId` relationships to `Idea`; backfill existing ideas to `Continuous Improvement` and `Medium` in the migration before making the foreign keys non-nullable.
14. Return field labels, Business Impact color, comment count, and current-user upvote state in board list projections.
15. Restrict description changes to the author, in-scope Org Admin, or Site Admin while retaining existing permissions for other editable fields.
16. Implement admin-only idea soft delete with `IsDeleted`, `DeletedAtUtc`, and `DeletedByUserId`; exclude deleted ideas from normal list, board, and detail queries.
17. Keep idea restore out of the current API and client.

Validation gate:
- collaboration permissions match the feature specs
- same-organization mention resolution works in ideas and comments
- duplicate concurrent tags converge to one normalized stored tag
- completed ideas remain editable and interactive
- field references and description/delete authorization match the resolved role matrix
- soft-deleted ideas are absent from normal queries and retained for audit history

### Phase 6: Notifications and Audit Readiness
1. Emit notification events for idea mentions, comment mentions, comments on ideas, and idea status changes.
2. Persist canonical idea links using `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}`.
3. Include both a human-readable message and structured metadata in audit events.
4. Persist audit and notification events for internal verification and processing only.
5. Do not expose event query endpoints in MVP unless scope changes.
6. Keep outbound email delivery explicitly deferred outside MVP.

Validation gate:
- required auth, admin, and idea lifecycle actions emit audit events
- collaboration triggers emit notification events
- event persistence works without an outbound notification subsystem

### Phase 7: Client Experience
1. Build the login flow for globally unique email credentials.
2. Build first-login password change and inactive-account handling states.
3. Build organization and user administration screens within a dedicated Admin section.
4. Build board and status administration screens, including immediate swimlane reorder persistence.
5. Build idea detail and board workflows with tags, email-based mentions, comments, and upvotes.
6. Reflect role boundaries clearly for Site Admin, Org Admin, User, and Read Only users.
7. Surface archived organizations, inactive users, and deleted-status historical references clearly but safely.
8. Replace user-facing Workflow terminology with Board terminology. Make `/boards` and `/board/{boardId}` canonical; add redirects from `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}`.
9. Add **Settings > Idea Fields** at `/settings/organizations/{organizationId}/idea-fields` with separate sortable Idea Type and Business Impact lists, role-aware organization scope, and last-option deletion feedback.
10. Fix board movement using a dedicated desktop drag handle, optimistic local relocation, one status API call, and rollback/toast behavior.
11. Apply successful status changes from Idea Detail to the board collection immediately so the card reflects its new status on return to the board, without waiting for a full reload.
12. Add Business Impact chips, current-user upvote toggle/count, and comment count/action to cards. Prevent card actions from starting drag or opening detail unintentionally.
13. Open Idea Detail from the comment action, scroll to comments, and focus the composer; use the comments heading as fallback.
14. Add author/admin description editing and an admin-only confirmed Delete action that closes detail and removes the card after success.

Implementation guidance:
- use Fluent UI command bars, panels, dialog patterns, details lists, form layouts, and cards consistently
- prefer clear labels, large action targets, inline helper text, and visible validation summaries
- keep admin surfaces separate from collaboration surfaces to reduce accidental misuse

Validation gate:
- core screens match documented user flows
- UI makes invalid actions difficult without replacing server enforcement
- role-based affordances are visible and understandable
- canonical Board routes and compatibility redirects work without visible Workflow terminology
- drag, status selection, upvote, comment focus, description editing, and deletion synchronize card state immediately

## Board Enhancement Execution Plan (Approved 2026-08-04)

### Phase BE-1: Domain and Persistence
Dependencies: existing organization, board, status, idea, and audit models.

1. Add `IdeaType` and `BusinessImpact` domain entities with `OrganizationId`, `Name`, `SortOrder`, soft-delete metadata, and `BusinessImpact.Color`.
2. Add required `Idea.IdeaTypeId` and `Idea.BusinessImpactId` relationships plus idea deletion metadata (`DeletedAtUtc`, `DeletedByUserId`) alongside the existing `IsDeleted` flag.
3. Configure active-name uniqueness per organization and field, sort-order indexes, foreign keys, color length/format constraints, and query filters only where they do not hide required historical references.
4. Create one EF Core migration that creates option tables, seeds/backfills options for every existing organization, assigns existing ideas to `Continuous Improvement` and `Medium`, and then makes both idea foreign keys non-nullable.
5. Extend organization bootstrap and Development seed services so repeated execution is idempotent and preserves admin-edited option labels, order, colors, and deletion state.
6. Add an `IdeaAssignee` join entity/table with composite uniqueness on `(IdeaId, UserId)`, cascade delete from Idea, restricted delete from User, and an index supporting assigned-user queries.
7. In the same assignment migration, copy every valid non-null legacy `Idea.AssigneeUserId` into `idea_assignees`, verify organization consistency, then remove the singular assignee foreign key, index, navigation, and column.

Completion criteria:
- migration applies to an existing populated database without null foreign keys
- every organization has the canonical options after first provisioning
- reseeding does not reset administrator-managed options
- every valid existing singular assignment is preserved as one join row and no legacy singular assignment column remains

### Phase BE-2: Application Rules and API
Dependencies: BE-1.

1. Add application models and use cases for list/create/update/reorder/soft-delete of both option types.
2. Enforce Site Admin resource context and Org Admin own-organization scope in Application services.
3. Enforce trimmed case-insensitive active-name uniqueness, complete-list atomic reorder, first-active default behavior, and last-active deletion rejection.
4. Validate that idea create/update references active options in the board's organization.
5. Split idea update authorization so description changes require author/admin while unchanged descriptions do not block otherwise-authorized edits.
6. Extend idea soft delete to persist actor/time metadata, emit an audit event, and return not found for already deleted or out-of-scope ideas.
7. Correct every board/list query to exclude `IsDeleted=true`; continue loading archived field options for existing idea projections.
8. Extend list/detail mappings with option identifiers/labels/color, `commentCount`, and caller-specific `hasUpvoted`.
9. Expose the endpoints and problem-details failures defined in `SPEC/30-Contracts.md`; update the canonical contract and contract tests in the same change.
10. Replace singular assignee request/projection fields with `assigneeUserIds` and ordered assignee summary collections. Enforce optional zero-to-five distinct active same-organization users and authorize assignment changes only for the author or in-scope admin.
11. Limit each idea to 10 distinct normalized tags and return alphabetically ordered tag names in board/detail projections.
12. Update assigned-user queries, notifications, audit descriptions, CSV parsing, and `Assigned to me` filtering to use the join collection. CSV `AssignedTo` accepts zero to five pipe-delimited emails.

Completion criteria:
- option invariants and authorization are server-enforced
- board projections supply every card field in one read
- normal APIs never return deleted ideas

### Phase BE-3: Client Navigation and Administration
Dependencies: stable BE-2 contracts.

1. Rename visible Workflow navigation, headings, breadcrumbs, actions, empty states, and client page/component names to Board terminology.
2. Implement canonical routes and compatibility redirect components without changing internal Application-layer `Workflow` symbols.
3. Add client contracts/API methods for both option collections and expanded idea projections.
4. Implement **Settings > Idea Fields** with separate sortable lists, explicit archived state, Business Impact color controls, and inline last-option errors.
5. Add Idea Type and Business Impact selectors to create/detail forms; order options by `SortOrder`, select the first active option for create, and display archived values read-only on existing ideas.
6. Apply the primary-navigation active style with no radius or left border, a flat selected background, stronger text/icon color, `aria-current="page"`, and unchanged focus visibility. Do not apply this rule to tabs, pivots, chips, or segmented controls.
7. Replace the singular assignee control with a searchable multi-select sourced from active users in the idea's organization, capped at five, while rendering inactive historical assignees as nonselectable retained values.
8. Replace comma-delimited tag text entry with a searchable multi-value selector/creator capped at 10 and backed by reusable organization tags.

Completion criteria:
- all visible terminology and links use Board/Boards
- admins can manage both option types in authorized organization scope
- authorized idea editors can manage bounded tag and assignee collections without cross-organization options

### Phase BE-4: Board Interaction and State Synchronization
Dependencies: BE-2 and BE-3.

1. Add a dedicated accessible drag handle to each card and lane drop targets using desktop HTML5 drag events.
2. On drop, snapshot the source status, move the card locally, invoke the status endpoint once, and restore the snapshot plus show an error toast on failure.
3. Reuse the same local move helper after Idea Detail status changes so lane counts update immediately once the board is revisited.
4. Add Business Impact chip color, upvote icon/count, and comment icon/count to cards.
5. Make upvote optimistic with per-card in-flight disabling and rollback from the pre-click `hasUpvoted`/count snapshot.
6. Make comment activation open detail with a focus intent; after render, scroll to and focus the composer or comments heading fallback.
7. Add role-aware description edit mode and confirmed admin Delete; after success close detail and remove the idea locally.
8. Restyle `/board/{boardId}` from `mockups/sprint-management/idea-board.html`, preserving configured statuses and approved controls while excluding demo-only pivots, conversion actions, duplicate commands, and sprint features.
9. Render the first three alphabetical tags plus `+N` and the first three assignees ordered by first/last name plus `+N`; render each persona as first/last initials followed by first name and expose complete values accessibly.
10. Add an injectable client clock/time-zone boundary for viewer-local calendar-day age and render `0 days ago`, singular `1 day ago`, plural `{N} days ago`, with future values clamped to zero.

Completion criteria:
- card controls do not trigger drag or unrelated card actions
- all successful mutations update lane/card state immediately
- failed optimistic mutations restore exact prior state

### Phase BE-5: Verification and Spec Sync
Dependencies: BE-1 through BE-4.

1. Add Domain/Application tests for field invariants, field scope, description authorization, soft delete, and status movement.
2. Add Infrastructure migration/seed tests for populated-database backfill and idempotency.
3. Add API integration and OpenAPI contract tests for option CRUD/reorder/delete, expanded projections, idea delete, and `400`/`403`/`404` behavior.
4. Add Client/component tests for route redirects, terminology, drag rollback, Idea Detail status movement, upvote rollback, comment focus, and role-aware editing/deletion.
5. Add Playwright coverage for the desktop critical path and verify mobile uses the status selector rather than touch drag.
6. Run `scripts/spec_drift_gate.ps1`, solution build, affected test projects, and browser tests before completion.
7. Add migration and Application/API tests proving valid singular assignments are preserved, invalid assignee collections are rejected, assignment authorization is enforced, notifications deduplicate recipients, CSV supports pipe-delimited assignees, and tag limits are enforced.
8. Add Client/browser accessibility and visual-regression tests for primary-nav active styling, Board reference fidelity, tag/persona overflow, full-name exposure, and deterministic local-day age.

Completion criteria:
- canonical specs, implementation, and contract tests have no drift
- all affected automated quality gates pass

### Phase 8: Hardening and Release
1. Align every implemented `/api/v1` endpoint and problem-details failure with `SPEC/30-Contracts.md` and the contract tests.
2. Cover acceptance criteria with targeted unit, integration, contract, and end-to-end tests from `SPEC/40-test-strategy.md`.
3. Verify seed data, role boundaries, organization scoping, audit generation, notification event generation, and default organization bootstrap end-to-end.
4. Confirm deferred items stay deferred: OAuth, reporting, guaranteed email delivery, remember-this-device, and event query endpoints.

### Post-MVP: Self-Service Password Reset
1. Add anonymous password-reset request and confirmation endpoints using the contracts in `SPEC/30-Contracts.md`.
2. Generate cryptographically random reset tokens, persist only protected token material, expire tokens after 24 hours, and invalidate prior tokens when issuing a new one.
3. Deliver reset links only for active local-password accounts while returning one generic request response for every syntactically valid email.
4. Enforce rolling delivery limits of 3 per normalized email and 10 per source IP within 15 minutes without changing the generic response.
5. Build an unlinked anonymous request page and token-backed reset form with matching new-password fields and existing complexity-policy feedback.
6. Consume the token and revoke all existing sessions atomically after a successful password update, then return the user to Login.
7. Audit reset requests and outcomes without storing or emitting token or plaintext-password values.

Validation gate:
- account existence and eligibility cannot be inferred from reset-request responses
- invalid, expired, superseded, and used links share one invalid-link result
- token expiry, replay prevention, throttling, password validation, and session revocation match the canonical specs
- no reset token or plaintext password appears in persistence, responses, logs, audit metadata, or analytics

### Post-MVP Phase 2: OAuth (Microsoft Entra ID)
1. Add organization-scoped OAuth configuration and administration surfaces.
2. Implement challenge/callback flow and provider validation.
3. Implement external identity linking, email fallback matching, and auto-provisioning with default role `User`.
4. Preserve local login coexistence and break-glass Site Admin access.
5. Add audit and test coverage for OAuth success/failure and provisioning outcomes.

Execution-ready task slices:
- Infrastructure
	- add `ExternalIdentity` persistence model and migration for provider subject mapping
	- add organization-scoped OAuth provider configuration persistence and encryption-at-rest handling
	- implement provider client configuration binding and secure options validation
- Application
	- add `StartOAuthSignIn` use case for org-scoped challenge composition
	- add `CompleteOAuthSignIn` use case for callback completion, identity linking, and email fallback matching
	- add auto-provision workflow for unmatched users with default role `User` and inactive-user guardrail
	- add audit event orchestration for success, denied, and failure outcomes
- API
	- add `GET /api/v1/auth/oauth/{organizationSlug}/start` challenge endpoint
	- add `GET /api/v1/auth/oauth/callback` callback endpoint with contract-aligned problem-details failures
	- add org-admin OAuth configuration endpoints with validation and authorization enforcement
- Client
	- add organization login entry-point with "Sign in with Microsoft" action
	- add callback completion screen and fallback error state handling
	- add org-admin OAuth configuration UX with safe save/test flow
- QA
	- add unit tests for linking precedence (external identity first, email fallback second)
	- add integration tests for callback success, inactive-user denial, and auto-provision behavior
	- add regression tests proving local login and break-glass Site Admin behavior remain intact

Validation gate:
- OAuth flow is functional for configured organizations
- local login remains fully functional
- linking and provisioning rules match feature specifications

### Post-MVP Phase 3: SAML
1. Add organization-scoped SAML configuration and metadata validation.
2. Implement SP-initiated assertion handling.
3. Reuse external identity linking and provisioning flow established in OAuth phase.
4. Add protocol-specific validation, audit coverage, and regression tests.

Execution-ready task slices:
- Infrastructure
	- add SAML configuration metadata and certificate-reference persistence
	- add safe metadata refresh and certificate rotation support for configured organizations
- Application
	- add `StartSamlSignIn` orchestration for org-scoped SP initiation
	- add `CompleteSamlSignIn` orchestration that maps assertions into the shared external identity model
	- reuse OAuth identity linking and auto-provision rules without forking policy logic
	- add audit event orchestration for SAML success, denied, and failure outcomes
- API
	- add `GET /api/v1/auth/saml/{organizationSlug}/start` initiation endpoint
	- add `POST /api/v1/auth/saml/acs` assertion-consumer endpoint
	- add org-admin SAML configuration endpoints with metadata validation responses
- Client
	- add organization login entry-point with "Sign in with SSO" action for SAML-enabled orgs
	- add admin UX for SAML metadata and certificate configuration with validation guidance
	- preserve coexistence affordances for local and OAuth login options
- QA
	- add protocol validation tests for malformed, expired, or mismatched assertions
	- add integration tests for assertion mapping, linking, and provisioning outcomes
	- add full regression matrix for local + OAuth + SAML coexistence

Validation gate:
- SAML flow is functional for configured organizations
- SAML and OAuth coexist without regressing local login
- protocol validation and audit coverage meet feature acceptance criteria

Validation gate:
- contracts and OpenAPI remain synchronized
- acceptance criteria are traceable to executable tests
- deferred scope does not leak into the release

## Data Model Outline
- Organization
- User
- Role
- Board
- BoardSwimlane or swimlane mapping
- Status
- Idea
- Tag
- IdeaTag
- Mention
- Comment
- Upvote
- AuditEvent
- NotificationEvent

## Persistence Design
### Core Tables or Aggregates
- `organizations`
- `users`
- `statuses`
- `boards`
- `board_swimlanes`
- `ideas`
- `tags`
- `idea_tags`
- `mentions`
- `comments`
- `upvotes`
- `audit_events`
- `notification_events`

### Table Outline
#### `organizations`
- `organization_id` uniqueidentifier primary key
- `company_name` nvarchar(200)
- `address` nvarchar(200)
- `city` nvarchar(100)
- `state` nvarchar(50)
- `zip` nvarchar(20)
- `phone` nvarchar(25)
- `primary_contact_first_name` nvarchar(100)
- `primary_contact_last_name` nvarchar(100)
- `is_archived` bit
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `users`
- `user_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier nullable for Site Admin only
- `first_name` nvarchar(100)
- `last_name` nvarchar(100)
- `email` nvarchar(320)
- `normalized_email` nvarchar(320)
- `password_hash` nvarchar(max)
- `role` nvarchar(50)
- `status` nvarchar(20)
- `must_change_password` bit
- `failed_login_count` int
- `lockout_window_start_utc` datetime2 nullable
- `locked_until_utc` datetime2 nullable
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `statuses`
- `status_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `name` nvarchar(100)
- `is_deleted` bit
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `boards`
- `board_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `name` nvarchar(150)
- `allow_user_status_update` bit — controls whether the User role can move ideas on this board
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `board_swimlanes`
- `board_id` uniqueidentifier foreign key
- `status_id` uniqueidentifier foreign key
- `display_order` int

#### `ideas`
- `idea_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `board_id` uniqueidentifier foreign key
- `author_user_id` uniqueidentifier foreign key
- `assignee_user_id` uniqueidentifier nullable foreign key
- `status_id` uniqueidentifier foreign key
- `title` nvarchar(150)
- `description` nvarchar(4000)
- `priority` nvarchar(20) — `Low`, `Medium`, `High`, or `Critical`
- `due_date` date nullable
- `is_deleted` bit — soft-delete; deleted ideas are excluded from board views and list queries
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `tags`
- `tag_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `name` nvarchar(100)
- `normalized_name` nvarchar(100)
- `created_at_utc` datetime2

#### `idea_tags`
- `idea_id` uniqueidentifier foreign key
- `tag_id` uniqueidentifier foreign key

#### `mentions`
- `mention_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `idea_id` uniqueidentifier nullable
- `comment_id` uniqueidentifier nullable
- `mentioned_user_id` uniqueidentifier foreign key
- `source_text` nvarchar(320)
- `created_at_utc` datetime2

#### `comments`
- `comment_id` uniqueidentifier primary key
- `idea_id` uniqueidentifier foreign key
- `author_user_id` uniqueidentifier foreign key
- `body` nvarchar(2000)
- `created_at_utc` datetime2
- `updated_at_utc` datetime2

#### `upvotes`
- `idea_id` uniqueidentifier foreign key
- `user_id` uniqueidentifier foreign key
- `created_at_utc` datetime2

#### `audit_events`
- `audit_event_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier nullable
- `actor_user_id` uniqueidentifier nullable
- `event_type` nvarchar(100)
- `entity_type` nvarchar(100)
- `entity_id` uniqueidentifier nullable
- `message` nvarchar(500)
- `metadata_json` nvarchar(max)
- `occurred_at_utc` datetime2

#### `notification_events`
- `notification_event_id` uniqueidentifier primary key
- `organization_id` uniqueidentifier foreign key
- `board_id` uniqueidentifier foreign key
- `idea_id` uniqueidentifier foreign key
- `actor_user_id` uniqueidentifier foreign key
- `recipient_user_id` uniqueidentifier foreign key
- `event_type` nvarchar(100)
- `idea_link` nvarchar(500)
- `message` nvarchar(500)
- `metadata_json` nvarchar(max)
- `occurred_at_utc` datetime2

### Suggested Constraints
- unique normalized email across the system on `normalized_email`
- unique normalized tag per organization on `(organization_id, normalized_name)`
- unique upvote per `(idea_id, user_id)`
- foreign keys from all tenant-owned entities back to `organization_id` where appropriate

### Audit Metadata Recommendations
- `created_at_utc`
- `updated_at_utc`
- `created_by_user_id`
- `updated_by_user_id`
- event-specific `message`
- structured `metadata`

## Domain Notes
- Site Admin is a global account and does not belong to an organization.
- Non-Site Admin users belong to exactly one organization.
- User accounts support `Active` and `Inactive` states only.
- Status deletion is soft-delete only.
- Comment bodies are plain text with line breaks only.

## Application Services and Workflows
### Authentication Services
- login service
- password policy service
- lockout tracking service
- current user service
- temporary password issuance service for P1

### Administration Services
- organization bootstrap service
- organization management service
- user management service
- role guard service

### Collaboration Services
- board management service
- status management service
- idea service
- tag normalization and resolution service
- mention parsing and resolution service
- comment service
- upvote service

### Cross-Cutting Services
- audit event writer
- notification event writer
- current user context provider
- UTC clock provider

## API Surface Outline
- Auth endpoints: login, organization resolution as needed, current user, and change password.
- Organization endpoints: create, edit, archive, list, and detail.
- User endpoints: create, edit, activate or inactivate, list, and detail.
- Board endpoints: create, edit, reorder swimlanes, list, and detail.
- Status endpoints: create, edit, soft-delete, list, and detail as needed.
- Idea endpoints: create, edit, list, detail, and status update.
- Engagement endpoints: comments, comment edits and deletes, upvotes, and mention resolution support.
- Notification handling: internal event generation in MVP, email delivery contracts later.

## Endpoint to Service Mapping
### Authentication
- `POST /api/v1/auth/login` -> `LoginService`, `LockoutTrackingService`, `AuditEventWriter`
- `GET /api/v1/auth/me` -> `CurrentUserService`
- `POST /api/v1/auth/change-password` -> `PasswordPolicyService`, `CurrentUserService`, `AuditEventWriter`
- `POST /api/v1/users/{userId}/temporary-password` -> `TemporaryPasswordIssuanceService`, `UserManagementService`, `AuditEventWriter`

### Organizations and Users
- `GET /api/v1/organizations` -> `OrganizationManagementService`
- `POST /api/v1/organizations` -> `OrganizationManagementService`, `OrganizationBootstrapService`, `AuditEventWriter`
- `GET /api/v1/organizations/{organizationId}` -> `OrganizationManagementService`
- `PUT /api/v1/organizations/{organizationId}` -> `OrganizationManagementService`, `AuditEventWriter`
- `POST /api/v1/organizations/{organizationId}/archive` -> `OrganizationManagementService`, `AuditEventWriter`
- `GET /api/v1/organizations/{organizationId}/users` -> `UserManagementService`
- `POST /api/v1/organizations/{organizationId}/users` -> `UserManagementService`, `PasswordPolicyService`, `AuditEventWriter`
- `GET /api/v1/users/{userId}` -> `UserManagementService`
- `PUT /api/v1/users/{userId}` -> `UserManagementService`, `RoleGuardService`, `AuditEventWriter`

### Boards and Statuses
- `GET /api/v1/organizations/{organizationId}/statuses` -> `StatusManagementService`
- `POST /api/v1/organizations/{organizationId}/statuses` -> `StatusManagementService`, `AuditEventWriter`
- `PUT /api/v1/statuses/{statusId}` -> `StatusManagementService`, `AuditEventWriter`
- `DELETE /api/v1/statuses/{statusId}` -> `StatusManagementService`, `AuditEventWriter`
- `GET /api/v1/organizations/{organizationId}/boards` -> `BoardManagementService`
- `POST /api/v1/organizations/{organizationId}/boards` -> `BoardManagementService`, `AuditEventWriter`
- `GET /api/v1/boards/{boardId}` -> `BoardManagementService`
- `PUT /api/v1/boards/{boardId}` -> `BoardManagementService`, `AuditEventWriter`
- `POST /api/v1/boards/{boardId}/swimlanes/reorder` -> `BoardManagementService`, `AuditEventWriter`

### Ideas and Engagement
- `GET /api/v1/boards/{boardId}/ideas` -> `IdeaService`
- `POST /api/v1/boards/{boardId}/ideas` -> `IdeaService`, `TagResolutionService`, `MentionResolutionService`, `AuditEventWriter`, `NotificationEventWriter`
- `GET /api/v1/ideas/{ideaId}` -> `IdeaService`
- `PUT /api/v1/ideas/{ideaId}` -> `IdeaService`, `TagResolutionService`, `MentionResolutionService`, `AuditEventWriter`, `NotificationEventWriter`
- `POST /api/v1/ideas/{ideaId}/status` -> `IdeaService`, `BoardManagementService`, `AuditEventWriter`, `NotificationEventWriter`
- `GET /api/v1/ideas/{ideaId}/comments` -> `CommentService`
- `POST /api/v1/ideas/{ideaId}/comments` -> `CommentService`, `MentionResolutionService`, `AuditEventWriter`, `NotificationEventWriter`
- `PUT /api/v1/comments/{commentId}` -> `CommentService`, `MentionResolutionService`, `AuditEventWriter`, `NotificationEventWriter`
- `DELETE /api/v1/comments/{commentId}` -> `CommentService`, `AuditEventWriter`
- `POST /api/v1/ideas/{ideaId}/upvote/toggle` -> `UpvoteService`, `AuditEventWriter`

## Client Composition Plan
### Primary Pages
- login page
- first-login password change page
- admin organizations page
- admin users page
- board overview page
- idea detail drawer (right slide-in) + create modal
- status management page

### Shared Components
- application shell
- admin navigation rail
- command bar and filter components
- details list wrappers
- swimlane column component
- idea card component
- tag pill component
- mention picker
- comment thread component
- validation summary component

### State and Data Loading
- auth state provider for current user and role context
- page-level query and mutation services that wrap the API contracts
- explicit reload after critical mutations when authoritative state is needed

## Test Strategy
- Unit tests for authentication rules, first-login password change, organization-scoped authorization, lockout thresholds, board validation, tag normalization, mention resolution, comment validation, and upvote toggling.
- Integration tests for `/api/v1/auth/login`, protected endpoints, organization-scoped CRUD, board creation constraints, status lifecycle, and idea comment and upvote flows.
- Contract tests to keep `SPEC/30-Contracts.md` and OpenAPI aligned, including problem-details non-2xx responses.
- End-to-end tests for the seeded Site Admin flow, organization bootstrap, first-login password change, and core idea collaboration scenarios.

## Traceability Guidance
- map each implementation slice back to the relevant `SPEC/20-feature-*.md` file
- keep `SPEC/30-Contracts.md` and OpenAPI artifacts synchronized with endpoint changes
- use `SPEC/archive/70-delivery-backlog.md` as the execution tracker derived from this plan

## Implementation Notes
- Put business rules in Domain and Application layers; keep controllers and components thin.
- Apply organization filtering centrally so the client cannot bypass it.
- Model notifications as events early, even if delivery is introduced in a later phase.
- Use admin-issued temporary password reset instead of self-service email reset in the current scope.
- Defer OAuth and SAML implementation until their post-MVP phases begin; defer reporting, guaranteed email delivery, event query endpoints, and remember-this-device outside MVP.
- Treat the original `SPEC` documents as the authoritative source and the Spec Kit port as an execution aid when there is any mismatch.

---

## Post-MVP Feature: User-Defined Fields (UDFs) for Ideas

> Full feature spec: `SPEC/20-feature-user-defined-fields.md`

### Feature Summary

Organization admins can define custom fields (UDFs) on ideas. Field definitions are org-scoped and shared across all boards. All organization members can fill in UDF values on idea forms. UDF values participate in filtering, search, audit, and CSV export/import.

### Domain Model Changes

New entities added to `Collega.Domain`:

| Entity | Base Class | Purpose |
|---|---|---|
| `FieldDefinition` | `AuditableEntityBase` | Org-scoped field schema entry; soft-deletable |
| `FieldDefinitionOption` | `EntityBase` | Option labels for Dropdown/MultiSelect types |
| `IdeaFieldValue` | `AuditableEntityBase` | One value per (idea, field definition); value stored as string |

New enum: `FieldType` (`Text=1`, `Number=2`, `Date=3`, `Boolean=4`, `Dropdown=5`, `MultiSelect=6`, `Url=7`)

`Idea` gains: `ICollection<IdeaFieldValue> FieldValues`

### New Tables

```
field_definitions
  - id uniqueidentifier PK
  - organization_id uniqueidentifier FK → organizations
  - name nvarchar(100)
  - description nvarchar(500) nullable
  - field_type int (FieldType enum)
  - is_required bit
  - display_order int
  - is_deleted bit
  - deleted_at_utc datetime2 nullable
  - deleted_by_user_id uniqueidentifier nullable
  - created_at_utc, updated_at_utc datetime2

field_definition_options
  - id uniqueidentifier PK
  - field_definition_id uniqueidentifier FK → field_definitions (cascade delete)
  - label nvarchar(200)
  - display_order int

idea_field_values
  - id uniqueidentifier PK
  - idea_id uniqueidentifier FK → ideas (cascade delete)
  - field_definition_id uniqueidentifier FK → field_definitions
  - value nvarchar(4000) nullable
  - created_at_utc, updated_at_utc datetime2

Unique index: field_definitions (organization_id, name) WHERE is_deleted = 0
Unique index: idea_field_values (idea_id, field_definition_id)
Index:        idea_field_values (field_definition_id, value)
```

EF Core migration name: `AddUserDefinedFields`

### New API Endpoints

All under `FieldDefinitionsController` at `/api/v1/organizations/{orgId}/field-definitions`:

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `.../field-definitions` | OrgAdmin, SiteAdmin | List active definitions (`?includeDeleted=true` for archived) |
| `POST` | `.../field-definitions` | OrgAdmin, SiteAdmin | Create definition |
| `GET` | `.../field-definitions/{id}` | OrgAdmin, SiteAdmin | Get single definition |
| `PUT` | `.../field-definitions/{id}` | OrgAdmin, SiteAdmin | Update definition |
| `DELETE` | `.../field-definitions/{id}` | OrgAdmin, SiteAdmin | Soft-delete |
| `PUT` | `.../field-definitions/reorder` | OrgAdmin, SiteAdmin | Reorder all |

Idea endpoints extended:
- `POST /api/v1/boards/{boardId}/ideas` and `PUT /api/v1/ideas/{ideaId}` accept `fieldValues[]` in the request body
- `GET /api/v1/ideas/{ideaId}` returns `fieldValues[]` in `IdeaDetailModel`
- `GET /api/v1/boards/{boardId}/ideas` accepts `fieldFilters[<id>]=<value>` query parameters

### Endpoint to Service Mapping (UDF additions)

```
GET    .../field-definitions           → FieldDefinitionService
POST   .../field-definitions           → FieldDefinitionService, AuditEventWriter
GET    .../field-definitions/{id}      → FieldDefinitionService
PUT    .../field-definitions/{id}      → FieldDefinitionService, AuditEventWriter
DELETE .../field-definitions/{id}      → FieldDefinitionService, AuditEventWriter
PUT    .../field-definitions/reorder   → FieldDefinitionService, AuditEventWriter
POST   .../ideas (extended)            → IdeaService (calls UdfValidationService), AuditEventWriter
PUT    .../ideas/{id} (extended)       → IdeaService (calls UdfValidationService), AuditEventWriter
```

### Application Services

New service: `IFieldDefinitionService` (in `Collega.Application/FieldDefinitions/`)
- CRUD for field definitions including soft-delete and reorder
- Authorization enforced: OrgAdmin and SiteAdmin only for writes

New service: `IUdfValidationService` (called from `IdeaService` during create/update)
- Validates `FieldValueWriteModel[]` against the org's active field definitions
- Enforces required-field rule, type format rules, and option-ID validity
- Returns structured errors keyed by field name matching API validation message format

Existing `IdeaService` extended:
- Accept and persist `FieldValueWriteModel[]` on create and update
- Emit `IdeaFieldValueChanged` audit events for each changed, added, or cleared UDF value

### Data Model Outline Addition

Add to the existing Data Model Outline:
- `FieldDefinition`
- `FieldDefinitionOption`
- `IdeaFieldValue`

Add to the Persistence Design / Core Tables:
- `field_definitions`
- `field_definition_options`
- `idea_field_values`

### Client Components

| Component | Location | Purpose |
|---|---|---|
| `FieldDefinitionList.razor` | Admin → Org Settings → Custom Fields | List, reorder, edit, archive definitions |
| `FieldDefinitionEditor.razor` | Admin → Org Settings | Create/edit dialog with type selector and options sub-editor |
| `FieldOptionEditor.razor` | Embedded in editor | Manage Dropdown/MultiSelect option labels |
| `IdeaUdfFields.razor` | Create modal + Idea Detail drawer edit form | Dynamic rendering of UDF fields by type |
| `UdfFilterPanel.razor` | Ideas list filter panel | Per-type filter controls for UDF fields |

New client service: `IFieldDefinitionApiClient` + `FieldDefinitionCacheService` (scoped, avoids repeated fetches)

### CSV Export / Import Integration

- `IdeaCsvExportService` extended to append one column per active `FieldDefinition` (ordered by `DisplayOrder`); column header = field name
- `IdeaCsvImportService` extended to match incoming column headers by field name (case-insensitive) to active field definitions; values validated through `IUdfValidationService`; per-row errors reported in the import summary

### Migration Strategy

- Single EF Core migration `AddUserDefinedFields` creates the three new tables with no backfill
- Existing ideas receive null/empty UDF values; this is the correct post-migration state and requires no data migration

### Effort Sizing

| Layer | Estimated Effort |
|---|---|
| Domain + EF Core migration | 0.5–1 day |
| Application (`FieldDefinitionService`, `UdfValidationService`, idea service extensions, audit) | 2–3 days |
| API (`FieldDefinitionsController`, model extensions, filter query) | 1–1.5 days |
| Client admin UI (field definition editor + reorder) | 2 days |
| Client idea form (dynamic UDF rendering, 7 types) | 2–3 days |
| Client filter panel | 1–1.5 days |
| Client API client + cache service | 0.5 day |
| CSV export/import extensions | 1 day |
| Tests | 2 days |
| **Total** | **~12–16 dev-days** |
