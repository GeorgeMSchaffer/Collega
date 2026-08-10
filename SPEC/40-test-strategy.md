# Test Strategy

## Unit
- AuthService credential validation
- Seed Site Admin first-login password change rule
- Development demo seed creates expected organizations, users by role without forced password change, boards, swimlanes, ideas, and comments
- Development demo seed is idempotent across repeated startup execution
- JWT issuance reports 28,800 seconds, validates immediately and immediately before the 480-minute boundary, and fails exactly at expiry
- Organization-scoped authorization checks
- User CSV parsing, trimming, default status, allowed role, row-count, and file-size validation
- User CSV import rejects duplicate emails within the file and performs no persistence when any row is invalid
- Lockout threshold of 5 failed attempts in 15 minutes and 15-minute expiration rules
- Post-MVP reset-token 24-hour expiry, single-use consumption, and newer-token invalidation
- Post-MVP reset request throttling at 3 per normalized email and 10 per source IP within 15 minutes
- Post-MVP reset confirmation enforces matching passwords, password complexity, and complete session revocation
- Board validation rules
- Idea Type and Business Impact provisioning, ordering, uniqueness, and last-active-option invariants
- Soft-deleted option references remain readable and cannot be newly assigned
- Idea description authorization for author, admins, non-author User, and Read Only
- Idea soft-delete authorization and exclusion from normal queries
- Tag normalization and create-on-save behavior
- Mention resolution within an organization
- Upvote toggle behavior
- Board-card list projection includes Business Impact chip data, comment count, and current-user upvote state

## Integration
- `/api/v1/auth/login`: success, invalid credential, and 15-minute lockout branches
- protected endpoints reject unauthenticated requests
- seeded Site Admin is forced through password change on first login
- a bearer token remains accepted by `/api/v1/auth/me` after a successful required password change in the same API process
- post-MVP reset requests return the same generic response for eligible, unknown, inactive, external-only, and throttled emails
- post-MVP reset confirmation treats invalid, expired, superseded, and used tokens identically
- post-MVP successful reset consumes the token, revokes all existing sessions, and does not issue a new session
- post-MVP reset responses, logs, audit events, and analytics do not expose tokens or plaintext passwords
- Development startup auto-seeds exactly 2 demo organizations
- each demo organization includes one Org Admin and two User accounts initialized to `Abc123!` without forced password change; the global Site Admin remains organization-independent
- each demo organization has exactly two seeded boards; every board has 11 ideas distributed `3/2/2/1/3` in canonical status order, with organization-consistent authors, assignees, tags, comments, and upvotes
- organization CRUD follows Site Admin and Org Admin role boundaries
- user CRUD is limited to the correct organization scope
- user CSV template downloads with the canonical content type, filename, header order, and example row
- valid user CSV import creates every row in the selected organization and returns the created count
- user CSV import enforces Site Admin and Org Admin organization scope and rejects Site Admin as an imported role
- invalid, duplicate, empty, oversized, and over-row-limit CSV imports return row-specific validation where applicable and create no users
- user CSV import responses, logs, and audit events do not expose plaintext initial passwords or uploaded file contents
- board creation rejects fewer than 2 swimlanes
- new organization provisioning creates the canonical Idea Type and Business Impact options in the specified order
- migration backfills existing ideas to `Continuous Improvement` and `Medium`
- Idea Type and Business Impact administration enforces organization scope and rejects deletion of the last active option
- archived field options remain visible on existing ideas but are rejected on new assignments
- soft-deleting an idea records deletion metadata and excludes it from board, list, and detail endpoints
- idea comment and upvote flows enforce role rules

## Contract
- Response and request semantics validated against `30-Contracts.md`
- Problem-details-style error envelope required for all non-2xx responses
- Authentication, organization, user, board, status, and idea contracts stay aligned with `30-Contracts.md`
- Post-MVP password-reset request and confirmation contracts stay aligned with `30-Contracts.md`
- Idea field option routes, idea delete behavior, and expanded board-card projections stay aligned with `30-Contracts.md`
- User CSV template and import content types, request limits, response shape, and problem-details errors stay aligned with `30-Contracts.md`

## Smoke Tests
- Critical-path smoke test: sign in successfully, create a new board, and create a new idea
- Smoke test success criteria:
  - the user can authenticate with a seeded account and reach the main workspace experience
  - a board can be created with the expected default status structure and saved successfully
  - an idea can be created on the new board and appears in the board view without validation errors
- Smoke test is intended as a release-readiness check for the MVP critical workflow, alongside the detailed unit, integration, and contract coverage
- Authentication navigation verifies protected anonymous routes redirect to `/login`, ordinary login lands on `/`, required password change is gated by `MustChangePassword`, and `/logout` clears the session before returning to `/login`.
- Authentication restoration verifies a valid stored token is confirmed through `/api/v1/auth/me`, an expired or API-unknown token clears all client auth state, and the browser returns to `/login`.
- Active-session authentication verifies a protected-request `401` signs the user out only when `/api/v1/auth/me` also rejects the token; an incorrect-current-password `401` preserves a token that `/api/v1/auth/me` accepts.
- Password-change authentication verifies a successful required password change remains authenticated after browser reload while the issuing API process remains available.
- Board navigation verifies `/boards` lists boards, `/board/{boardId}` opens detail, legacy routes redirect to canonical routes, and no user-facing Workflow terminology remains.

## Manual Client Acceptance
- Browser acceptance verifies the warning appears after 28 minutes of inactivity, its countdown reaches the 30-minute idle deadline, and Stay signed in resets only the idle deadline.
- Activity from pointer, keyboard, touch, scroll, and document visibility plus logout/expiry signals synchronize across tabs.
- Idle and absolute expiry clear authentication in every tab and show the specific session-expired Login message; explicit logout and password-change logout do not.
- My Profile updates the displayed first/last name immediately, keeps email and role read-only, and voluntary and required password changes both return to Login with confirmation before re-login lands on Dashboard.
- Text-like controls render at a stable 36px height with vertically centered content, and Fluent icon actions expose accessible names, tooltips, keyboard focus, and disabled states on desktop and narrow layouts.
- Client unit-test and Playwright infrastructure is intentionally excluded from this batch because a parallel branch owns browser automation; these items remain pending until user manual acceptance.

## Startup Safety
- Demo environment seed runs only in Development
- Non-Development startup does not apply demo data seed

## MVP Scope Gate
- MVP release verification does not require OAuth or SAML endpoint implementation.
- OAuth validation is executed in post-MVP Phase 2 test cycles.
- SAML validation is executed in a post-OAuth phase test cycle.

## Client UI — `/board/{boardId}` Kanban Board
- Route terminology: verify `/boards` lists boards, `/board/{boardId}` opens detail, compatibility routes redirect, and no user-facing Workflow terminology remains.
- Card rendering: verify each card shows title, priority badge, Business Impact chip/color, up to three alphabetical tags plus `+N`, up to three ordered assignee personas plus `+N`, viewer-local submission age, current-user upvote state/count, and comment count; verify Idea Type remains in detail rather than the compact card face.
- Persona rendering: verify initials use the first letters of first and last name followed by first name, full names are accessible, ordering is first name then last name, a single missing name part uses available data, and both missing parts render `?` with accessible label `Unknown user`.
- Submission age: inject or control the client clock and time zone; verify `0 days ago`, singular `1 day ago`, plural values, viewer-local midnight boundaries, and future timestamps clamped to zero.
- Title-click surface: verify clicking the card title opens the Idea Detail drawer (right slide-in; URL gains `?idea={ideaId}`, addressable as `/ideas/{ideaId}`); verify the drawer displays all fields (title, priority, Idea Type, Business Impact, due date, description, assignees, tags, mentions, comments) and provides role-appropriate actions; verify a `/ideas/{ideaId}` deep link opens the Ideas list with the drawer open and an inaccessible id shows a not-found/permission notice without a drawer.
- Assignee editing: verify optional zero-to-five selection, distinct-user enforcement, active same-organization lookup, historical inactive-user display, complete-collection replacement, author/admin authorization, and `Assigned to me` collection membership.
- Tag editing: verify searchable selection and inline creation by authorized editors, organization-scoped case-insensitive reuse, 10-tag limit, deterministic three-tag card overflow, and complete values in detail/accessibility text.
- New Idea button: verify the New Idea button appears in the board header for all roles except ReadOnly; verify it navigates to Idea Detail in create mode with the left-most status pre-selected.
- Card drag-and-drop: verify only the dedicated handle starts drag, optimistic column move is applied immediately, `MoveIdeaStatusAsync` is called with the correct target status ID, and the card reverts with an error toast on API failure.
- Detail status movement: verify status selection immediately updates the idea's status, reflected in the matching swimlane on return to the board; keyboard and touch users can use the selector without drag.
- Upvote action: verify inactive/active icon states, immediate count updates, and rollback on failure; verify the control does not open detail or start drag.
- Comment action: verify the count is correct and activation opens detail, scrolls to comments, and focuses the composer or comments heading fallback.
- Soft delete: verify only authorized admins see Delete, confirmation is required, success closes detail and removes the card, and failure leaves the idea visible with an error.
- Description editing: verify author and in-scope admins can edit while other roles see a read-only description.
- Idea Fields settings: verify admins can create, edit, reorder, and archive options; first active option is presented as default and last-option deletion is blocked.
- Column reorder: verify SiteAdmin and OrgAdmin users can reorder columns and `UpdateStatusAsync` is called per affected status; verify reorder saves immediately on drop without a confirmation step; verify User and ReadOnly users cannot trigger a reorder; verify all columns revert on API failure with error toast.
- Filter chips and search: verify All / Created by me / Assigned to me filter chips correctly hide non-matching cards client-side; verify search matches by title, tag, and assignee name (case-insensitive); verify search is combinable with filter chips; verify empty columns display the "No ideas" placeholder.
- Primary navigation: verify the active item has no border radius or left active border, uses the flat selected background and stronger text/icon style, exposes `aria-current="page"`, and retains a visible keyboard focus indicator; verify tabs and filter controls are unaffected.
- Board visual regression: compare desktop and mobile captures to `mockups/sprint-management/idea-board.html` for hierarchy, density, full-height lanes, card tag/persona/age placement, and responsive overflow without importing demo-only controls.