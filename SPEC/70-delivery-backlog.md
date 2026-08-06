# Delivery Backlog

## Purpose
Break the technical implementation plan into execution-ready epics and task slices.

## Restart Baseline
- All epics and tasks in this backlog are currently planned and pending.
- No backlog item should be treated as implemented, partially implemented, or accepted based on prior tracker history.
- When execution restarts, record active and completed work in `implementation-agent-tracker.md`.

## Team Lanes
- API: HTTP contracts, endpoint mapping, OpenAPI, auth middleware, problem-details responses
- Application: use cases, authorization, orchestration, business rules, audit and notification event triggering
- Infrastructure: EF Core mappings, migrations, database constraints, password hashing, token issuance, environment-seeded credentials
- Client: Blazor pages, Fluent UI layouts, workflow composition, role-aware affordances
- QA: contract, integration, end-to-end, and regression validation

## Dependency Rules
- Epics 2 through 7 depend on Epic 1 foundation work.
- Epic 3 depends on authentication primitives from Epic 2 for user and role handling.
- Epic 4 depends on organization bootstrap from Epic 3.
- Epic 5 depends on Epic 4 because ideas require board and status configuration.
- Epic 6 depends on Epic 5 because notification and audit surfaces attach to collaboration workflows.
- Epic 7 can begin after Epics 2 through 5 expose stable API contracts for each feature area.
- Epic 8 depends on executable slices from all previous epics.
- Epic 9 (OAuth, post-MVP Phase 2) depends on MVP release completion and stable auth contracts.
- Epic 10 (SAML, post-OAuth) depends on Epic 9 completion.

## Epic 1: Foundation and Contract Baseline
Outcome: the solution boots, persists data, and exposes a consistent API shell.

Suggested sequencing by team:
- Infrastructure: base solution, DbContext, migrations, shared persistence primitives
- API: routing conventions, problem-details envelope, validation pipeline, OpenAPI skeleton
- Application: current user context, clock abstraction, shared cross-cutting interfaces
- QA: baseline smoke checks for boot and error envelope behavior

Tasks:
- create the solution structure and project references
- add the EF Core DbContext, migrations, and base audit storage strategy
- implement shared `/api/v1` routing conventions
- implement problem-details error handling
- implement API request validation and OpenAPI scaffolding

Exit criteria:
- the API starts successfully
- migrations can create the base schema
- non-2xx responses use the standard error envelope

Dependencies:
- none

## Epic 2: Authentication and Global Administration
Outcome: users can authenticate safely and the global Site Admin bootstrap path works.

Suggested sequencing by team:
- Infrastructure: password hashing, token generation, seed credential loading, lockout persistence
- Application: login, lockout rules, current-user service, password-change workflow
- API: auth endpoints and authorization integration
- Client: login and first-login password change screen
- QA: auth matrix and lockout verification

Tasks:
- implement login with globally unique email credentials
- implement password hashing and verification
- enforce password complexity rules
- enforce inactive-account denial
- implement 5-failures-in-15-minutes lockout for 15 minutes
- seed the global Site Admin with an environment-provided initial credential
- implement Development-only demo environment seed for 3 organizations with role-based users and forced first-login password change
- force first-login password change for the seeded Site Admin
- emit audit events for login outcomes and password actions

MVP/P1 extension:
- retain the implemented admin-issued temporary password reset

Post-MVP follow-up:
- post-MVP: add self-service reset by private 24-hour email link with generic responses, request throttling, replay prevention, and session revocation

Exit criteria:
- login success, invalid credentials, inactive account, and lockout flows work end-to-end
- the seeded Site Admin can sign in and is forced through password change

Dependencies:
- Epic 1

## Epic 3: Organizations and Users
Outcome: tenant administration works with the required role boundaries.

Suggested sequencing by team:
- Infrastructure: organization, user, bootstrap, and atomic bulk-create persistence
- Application: organization bootstrap, archive flow, user CRUD, CSV import validation, lifecycle guardrails, last-Org-Admin protection
- API: organization and user endpoints, CSV template/import endpoints, filters, and validation
- Client: Admin section pages for organizations and users, including template download and CSV import feedback
- QA: org scope, lifecycle, archive behavior, template contract, and atomic import verification

Tasks:
- implement organization create, edit, detail, list, and archive flows
- auto-generate an invite code on organization creation; display in list and detail views
- implement invite code regeneration for admins; invalidate codes for archived organizations
- implement user self-registration flow: validate invite code, determine organization, create account
- auto-provision default statuses and one default board for each new organization
- implement user create, edit, detail, and list flows within organization scope
- provide the canonical downloadable user import CSV template
- implement atomic user CSV import for up to 1,000 rows and 5 MB with row-specific validation errors
- enforce one organization and one role per non-Site Admin user
- enforce globally unique email addresses
- support `Active` and `Inactive` user states
- prevent the last Org Admin from removing their own admin access or deactivating themselves
- emit audit events for organization and user administration actions

Exit criteria:
- Site Admin and Org Admin boundaries match the feature specs
- archived organizations remain retained and inaccessible according to policy
- authorized administrators can download the canonical template and import valid users without partial creation on validation failure

Dependencies:
- Epics 1 and 2

## Epic 4: Boards and Statuses
Outcome: organizations can manage workflow lanes safely.

Suggested sequencing by team:
- Infrastructure: statuses, boards, and swimlane mapping schema
- Application: status soft-delete rules, board validation, reorder behavior
- API: board and status endpoints
- Client: board admin and status admin surfaces
- QA: board constraints and historical status labeling checks

Tasks:
- implement organization-scoped status create, edit, list, and soft-delete flows
- block soft-delete of a status that is currently referenced as a swimlane on any active board
- seed the default status set on organization creation
- implement board create, edit, list, and detail flows
- enforce minimum two swimlanes per board
- support board subsets of organization statuses
- implement immediate swimlane reorder persistence
- implement organization-scoped Idea Type and Business Impact option CRUD, ordering, and soft deletion
- seed canonical option sets and use the first active option by sort order as the default
- reject deletion of the last active option and preserve archived references on existing ideas

Exit criteria:
- new organizations have a usable default board and status set
- swimlane reorder is persisted immediately

Dependencies:
- Epics 1 and 3

## Epic 5: Ideas and Engagement
Outcome: users can create and collaborate on ideas inside their organization.

Suggested sequencing by team:
- Infrastructure: ideas, comments, tags, mentions, and upvotes schema plus uniqueness constraints
- Application: idea workflows, tag normalization, mention resolution, comment permissions, upvote toggling
- API: idea, comment, upvote, and status-move endpoints
- Client: board cards, idea detail, comments, tags, mention picker, upvote actions
- QA: collaboration and role matrix verification

Tasks:
- implement idea create, edit, detail, list, and status update flows
- implement idea soft-delete for Site Admin and Org Admin; soft-deleted ideas excluded from board views and list queries
- persist deletion actor/time metadata; keep restore deferred
- add required Idea Type and Business Impact relationships and backfill existing ideas
- restrict description edits to the idea author and in-scope admins
- implement bulk CSV import: whole-file validation, 500-row limit, in-file duplicate detection, board-duplicate skipping, transactional creation, dual audit events
- enforce title and description constraints
- default new idea status to the left-most board swimlane when not supplied
- implement tag autocomplete after 2 characters
- implement tag normalization and merge-on-concurrency behavior
- implement email-based mention resolution for ideas and comments
- implement comment create, edit, delete, and chronological retrieval
- implement upvote toggle with one active upvote per user per idea
- include Business Impact chip data, comment count, and current-user upvote state in board projections
- allow board-configured user status changes for any idea on the board
- keep completed ideas editable and collaborative
- emit audit events for idea lifecycle actions

Exit criteria:
- Read Only, User, Org Admin, and Site Admin permissions match the feature specs
- collaboration behavior matches the acceptance criteria

Dependencies:
- Epics 1, 3, and 4

## Epic 6: Notification Events and Audit Surfaces
Outcome: the application records collaboration events needed for later notification delivery.

Suggested sequencing by team:
- Infrastructure: audit and notification event persistence
- Application: event composition and message generation
- API: no new read endpoints required in MVP unless scope changes
- Client: optional internal diagnostics only if explicitly needed
- QA: event persistence verification through tests or internal inspection tools

Tasks:
- emit notification events for idea mentions, comment mentions, comments on ideas, and status changes
- persist canonical idea links with notification event context
- expose or store audit and notification events in an observable way for verification
- keep email delivery explicitly deferred outside MVP

Exit criteria:
- notification events are generated correctly without requiring outbound email delivery
- audit coverage exists for auth, admin, and idea lifecycle actions

Dependencies:
- Epics 1 through 5

## Epic 7: Blazor Client Experience
Outcome: the client supports the agreed workflows and role boundaries with the revised layout and navigation.

Suggested sequencing by team:
- Client: page shells, shared components, layout revisions, Settings flows, board and idea flows, detail views
- API/Application: close support loop for UI-driven gaps discovered during composition
- QA: navigation, validation, role-affordance, and regression checks

Tasks:

**Bug fixes:**
- fix the errant `else {` rendered as visible content on the Change Password screen
- remove all Weather and Counter placeholder pages, routes, nav links, and sample code

**Header and navigation:**
- set header background to `rgb(33, 37, 41)`; render username in white
- move sign-out to an icon button immediately left of the username display
- add gear icon to header that navigates to `/settings`
- replace visible Workflow terminology with Board/Boards; use canonical `/boards` and `/board/{boardId}` routes with compatibility redirects

**Settings area (formerly Admin):**
- rename all Admin routes to `/settings/...`, page titles to "Settings", and gear icon tooltip to "Settings"
- build Settings landing page with My Profile link for all authenticated users and role-scoped admin links:
  - Site Admin: Organizations, Users, Boards & Statuses
  - Org Admin: Users and Boards & Statuses (own org only)
  - Member: no admin links rendered
- implement list-first / form-swap pattern for Organizations, Users, and Boards & Statuses pages:
  - default to list view; Create button visible only to permitted roles (Create Organization: Site Admin only)
  - clicking Edit or Create swaps to form view; saving or cancelling returns to list with list refreshed
- display invite code in organization list and detail; provide regenerate action for admins

**Boards page:**
- restrict the Boards page to a board list only (remove all non-list content)
- clicking a board navigates to that board's swimlane/kanban view

**Board detail (Kanban board):**
- build `/board/{boardId}` as the canonical Kanban swimlane board
- render one column per status on the selected board, ordered by `Status.SortOrder`; horizontal scroll on overflow
- restyle the Board detail hierarchy, full-height lanes, density, cards, tag rows, persona footers, and age placement from `mockups/sprint-management/idea-board.html`; preserve configured statuses and approved controls, excluding demo-only pivots, conversion actions, duplicate commands, and sprint features
- render compact idea cards showing title, priority, Business Impact chip, first three alphabetical tags plus `+N`, first three ordered assignee personas plus `+N`, viewer-local submission age, current-user upvote control/count, and comment control/count
- clicking a card title opens an in-context detail overlay (no page navigation); overlay fields: title, priority, due date, description, zero-to-five assignees, zero-to-10 tags, mentions, comments; overlay actions: Cancel, Save Idea, Move in Board
- add primary **New Idea** button in board header that opens overlay in create mode (hidden for ReadOnly users)
- add filter chips (All / Created by me / Assigned to me) and search input (filters by title, tag, or assignee, client-side); filtering is combinable; empty columns remain visible with "No ideas" placeholder
- implement card drag-and-drop from a dedicated handle: optimistic column move, one status call, revert on failure with error toast
- immediately relocate a card when status changes in Idea Detail without waiting for overlay close
- open and focus comments from the card comment action; implement optimistic upvote state/count with rollback
- add role-aware description editing and confirmed admin-only soft delete
- implement column reorder drag for SiteAdmin and OrgAdmin: optimistic reorder, saves immediately on drop, call `PUT /api/v1/boards/{boardId}/statuses/{statusId}` per changed status, revert all on failure with error toast
- implement components in `src/SargentNexus.Client/Shared/Kanban/`: `IdeaKanbanBoard.razor`, `KanbanColumn.razor`, `IdeaCard.razor`
- add `IdeaAssignee` persistence and migrate every valid singular assignment before dropping the old `AssigneeUserId` relationship
- replace singular assignee contracts with bounded collections; validate distinct active same-organization users, enforce author/admin assignment permission, update notifications/audit/CSV, and make Assigned to me use collection membership
- implement searchable tag selection/creation with organization-scoped normalization and a 10-tag limit
- render persona initials from first and last name followed by first name, with full accessible names and missing-name fallback
- calculate age from viewer-local calendar dates with zero/singular/plural formatting and future clamping through a testable clock boundary

**Primary navigation:**
- remove border radius and the active left border from the selected primary-navigation item; use a flat selected background and stronger text/icon color while preserving `aria-current` and keyboard focus styling
- leave tabs, pivots, filter chips, and segmented controls unchanged

**Idea Fields settings:**
- add `/settings/organizations/{orgId}/idea-fields` for Site Admin and in-scope Org Admin
- manage separate sortable Idea Type and Business Impact lists; Business Impact includes editable chip color
- block deletion of the last active option and show archived options without allowing new assignment

**Uniform list conventions (all list pages):**
- add a uniform search bar above every entity list
- implement server-side pagination with page size options 25 (default), 50, 100, 250
- wire `search`, `page`, and `pageSize` query params to corresponding API endpoints
- changing search text resets to page 1
- organization list columns and search scope: Title, Description, Invite Code, Status

**Role-aware client flows:**
- build login flow for globally unique email credentials
- build first-login password change and inactive-account states
- enforce visible role-based UI affordances for Read Only, User, Org Admin, and Site Admin
- build board, idea detail, comment, tag, mention, and upvote interfaces

Exit criteria:
- all bug fixes from SPEC/20-feature-client-ui-revisions.md verified as resolved
- header, horizontal menu, gear icon, and Settings area match the approved layout spec
- Boards page shows only a board list; clicking opens `/board/{boardId}`
- Board detail is functional: expanded compact cards, title-click overlay, New Idea, search/filter, dedicated-handle drag with rollback, immediate overlay status movement, upvote/comment actions, and admin column reorder
- all list pages have uniform search bar and server-side pagination with correct page sizes
- no Admin-labeled routes, titles, or text remain

Dependencies:
- Epics 2 through 5 primarily, with Epic 6 optional for internal diagnostics only

## Epic 8: Hardening and Release Readiness
Outcome: contracts, tests, and release boundaries are aligned.

Suggested sequencing by team:
- QA: contract, integration, and end-to-end coverage
- API: OpenAPI and contract drift correction
- Application/Infrastructure: fix workflow, data, or event discrepancies surfaced by tests
- Client: final UX defect correction and polish within approved scope

Tasks:
- align OpenAPI with the contracts document endpoint by endpoint
- implement unit tests from the test strategy
- implement integration tests for auth, protected routes, organization scope, and collaboration flows
- implement contract tests for schemas and problem-details error responses
- add a critical-path smoke test for sign-in, board creation, and idea creation as a release-readiness gate
- verify seed behavior, default organization bootstrap, invite code generation, and audit generation end-to-end
- verify Development-only demo seed graph, idempotent startup behavior, and non-Development seed suppression
- regression-verify all items in SPEC/20-feature-client-ui-revisions.md acceptance criteria checklist
- confirm deferred work remains deferred

Deferred for MVP release:
- OAuth implementation (scheduled for post-MVP Phase 2)
- SAML implementation (scheduled after OAuth)

Exit criteria:
- the test strategy is covered by executable tests
- OpenAPI and written specs do not drift
- deferred items stay out of the MVP release

Dependencies:
- Epics 1 through 7

## Epic 9: OAuth/OIDC (Post-MVP Phase 2)
Outcome: organizations can authenticate through Microsoft Entra ID while preserving local login.

Suggested sequencing by team:
- Infrastructure: external identity persistence, provider configuration storage, and migration updates
- Application: external identity completion flow, linking/provisioning rules, and audit orchestration
- API: challenge/callback endpoints and OAuth configuration endpoints
- Client: organization-scoped OAuth entry-point UX and session completion handling
- QA: provider flow, coexistence, and provisioning matrix verification

Tasks:
- implement organization-scoped OAuth configuration management
- implement Microsoft Entra ID challenge and callback flow
- implement external identity linking and email fallback matching
- implement auto-provisioning for missing users with default role `User`
- preserve local login coexistence and break-glass Site Admin path
- emit audit events for OAuth outcomes and provisioning

Execution-ready lane slices:
- Infrastructure
	- O2-INF-01: add `ExternalIdentity` entity, mapping, and migration
	- O2-INF-02: add org-scoped OAuth provider configuration persistence
	- O2-INF-03: add secure provider option binding and validation plumbing
- Application
	- O2-APP-01: implement org-scoped OAuth start flow
	- O2-APP-02: implement OAuth callback completion and token-to-identity mapping
	- O2-APP-03: implement linking precedence and fallback matching
	- O2-APP-04: implement auto-provision with default role `User` and inactive-user denial
	- O2-APP-05: emit audit events for success/failure/provisioning outcomes
- API
	- O2-API-01: add OAuth start endpoint contract and routing
	- O2-API-02: add OAuth callback endpoint contract and routing
	- O2-API-03: add org-admin OAuth configuration CRUD endpoints
- Client
	- O2-CLI-01: add org-scoped OAuth sign-in action in login UX
	- O2-CLI-02: add callback completion and user-facing error states
	- O2-CLI-03: add org-admin OAuth configuration UX
- QA
	- O2-QA-01: add unit tests for linking precedence and provisioning decisions
	- O2-QA-02: add integration tests for callback success, inactive-user denial, and provisioning
	- O2-QA-03: add regression tests for local login coexistence and break-glass access

Exit criteria:
- Microsoft Entra ID sign-in works for configured organizations
- local login remains functional and unchanged for non-SSO flows
- linking and provisioning behavior matches feature contracts

Dependencies:
- MVP release complete
- Epic 2 authentication contracts stable

## Epic 10: SAML (Post-OAuth Phase)
Outcome: organizations can authenticate with SAML 2.0 using the same identity-linking model.

Suggested sequencing by team:
- Infrastructure: SAML provider configuration storage and certificate/metadata handling
- Application: assertion-to-identity mapping and provisioning flow reuse
- API: SAML initiation/callback surfaces and configuration endpoints
- Client: SAML entry-point UX and coexistence behavior
- QA: protocol validation, assertion behavior, and regression verification

Tasks:
- implement organization-scoped SAML configuration
- implement SP-initiated SAML flow
- reuse OAuth-established identity linking and auto-provisioning model
- implement protocol validation and audit coverage

Execution-ready lane slices:
- Infrastructure
	- S3-INF-01: add SAML metadata and certificate-reference persistence
	- S3-INF-02: add metadata refresh and certificate rotation support
- Application
	- S3-APP-01: implement org-scoped SAML initiation orchestration
	- S3-APP-02: implement assertion-consumer mapping into shared external identity model
	- S3-APP-03: reuse OAuth linking and provisioning policy logic
	- S3-APP-04: emit audit events for SAML success/failure/provisioning outcomes
- API
	- S3-API-01: add SAML start endpoint contract and routing
	- S3-API-02: add SAML assertion-consumer endpoint contract and routing
	- S3-API-03: add org-admin SAML configuration endpoints and metadata validation responses
- Client
	- S3-CLI-01: add SAML sign-in action in organization login UX
	- S3-CLI-02: add admin SAML configuration UX and validation messaging
	- S3-CLI-03: preserve local + OAuth coexistence affordances during SAML rollout
- QA
	- S3-QA-01: add protocol validation tests for malformed/expired/mismatched assertions
	- S3-QA-02: add integration tests for mapping, linking, and provisioning outcomes
	- S3-QA-03: add coexistence regression matrix for local, OAuth, and SAML paths

Exit criteria:
- SAML sign-in works for configured organizations
- local and OAuth login paths continue to function
- SAML behavior matches acceptance criteria

Dependencies:
- Epic 9

## Recommended Execution Order
1. Complete Epic 1 fully before parallelizing downstream work.
2. Run Epic 2 next because authentication gates all protected workflows.
3. Run Epic 3 and the schema portion of Epic 4 in close sequence because tenant bootstrap creates default boards and statuses.
4. Finish Epic 4 before starting broad Idea and Engagement implementation in Epic 5.
5. Add Epic 6 once core collaboration events exist so event shapes settle late but before hardening.
6. Run Epic 7 continuously after API slices stabilize, but reserve final UI completion until Epics 2 through 5 are functionally complete.
7. Close with Epic 8 as the release gate.
8. Start Epic 9 only after MVP release criteria are met.
9. Execute Epic 10 after Epic 9 stabilizes.
