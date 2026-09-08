# Requirements: Collega

## Overview
Collega is a collaboration and project management tool for submitting, tracking, and improving process ideas.

## Global Rules
- All data is scoped to an organization.
- The Site Admin account is a global platform account and is not owned by any organization.
- Only Site Admin can create organizations.
- Organization creation requires only a title and description; a logo address is optional.
- Each organization has a system-generated invite code, shown in the organization list and detail views; admins can regenerate it.
- Users can self-register with a valid organization invite code; the code determines their organization, and missing or invalid codes are rejected with a prompt to provide a correct one.
- Site Admin can add users to any organization; Org Admin can add users to their own organization, including via CSV import (no invite code needed — imported users join the target organization).
- Org Admin can edit only their own organization.
- All product screens use a unified application shell with a persistent top header, organization identity, role-aware navigation, and breadcrumb navigation.
- Organizations may be archived but are not hard-deleted.
- Organizations can upload one logo at a time from the organization edit form; uploading a new logo replaces the previous logo.
- Statuses are organization-scoped.
- Tags are organization-scoped.
- An idea can have up to 10 distinct organization-scoped tags. Users authorized to edit an idea can select existing tags or create reusable tags inline.
- Read Only users can comment and upvote, but cannot edit ideas or board configuration.
- In Development, startup seed creates exactly 2 demo organizations. Each owns one Org Admin and two User accounts initialized with demo password `Abc123!` and no forced password change, plus two example boards. Every board contains 11 deterministic ideas distributed `3/2/2/1/3` in canonical status order, with organization-consistent authors, assignees, tags, comments, and upvotes. The single global Site Admin remains outside all organizations.
- Ideas require Priority, an organization-configured Idea Type, and an organization-configured Business Impact; due date remains optional.
- Every organization retains at least one active Idea Type and one active Business Impact. Admins control option sort order, and option deletion is soft-delete only. The first active option by sort order is the default **for Idea Type**; **Business Impact defaults to `Medium`** (falling back to first-active when no option is named `Medium`) — see `20-feature-ideas-and-engagement.md` → Defaults, changed 2026-08-17 when the seeded impact order was reversed to most-severe-first.
- Idea assignment is optional and supports up to five distinct users. Newly selected assignees must be active users in the idea's organization; inactive historical assignees remain visible but cannot be newly selected. The idea author and in-scope admins can change assignments.
- Board cards are compact and display title, priority, Business Impact chip, up to three tags plus `+N`, up to three assigned-user personas plus `+N`, viewer-local submission age, current-user upvote state/count, and comment count. Clicking the title opens Idea Detail; clicking comments opens Idea Detail focused on the comment composer.
- `/boards` is the canonical board list and `/board/{boardId}` is the canonical swimlane view. User-facing copy uses Board terminology; singular-list and legacy Workflow routes redirect to canonical routes.
- Unauthenticated users may access `/login` and `/register`; attempts to access protected client routes redirect to `/login`.
- Authenticated users without a required password change land on the Dashboard at `/` after login. The standalone `/change-password` route is limited to accounts marked `MustChangePassword`; voluntary password changes remain available from `/settings/profile`.
- Access tokens expire absolutely after 480 minutes. Authenticated browser sessions also expire after 30 minutes without synchronized cross-tab activity, with a warning and two-minute countdown beginning at minute 28; staying signed in resets only the idle deadline.
- Successful required and voluntary password changes revoke the current token, clear client authentication state, and return to Login with confirmation. Re-authentication then lands on the Dashboard unless a separate normal return URL applies.
- Desktop card drag uses a dedicated handle, moves the idea optimistically, and reverts on failure. Changing status in Idea Detail moves the visible card immediately. Keyboard and touch users use the Idea Detail status selector.
- Idea authors and in-scope admins can edit descriptions. Only in-scope Org Admins and Site Admins can soft-delete ideas; deleted ideas are excluded from normal queries and restore is deferred.
- OAuth implementation is scheduled for post-MVP Phase 2, with SAML scheduled in a subsequent post-OAuth phase.

## UI Shell Rules
- Every screen includes a persistent header with primary blue background, logo at top-left, and global actions.
- The header reserves a `150px` brand zone on the left for logo and product identity.
- Every screen includes role-aware primary navigation in a consistent location.
- The selected primary-navigation item uses a flat rectangular active background and stronger text/icon color. It has no border radius, no active left border, and retains `aria-current="page"` plus a visible keyboard focus outline. This rule does not apply to tabs, pivots, filter chips, or segmented controls.
- The header includes a logout icon action.
- The logout icon navigates through `/logout`, which clears the client session and redirects to `/login`.
- Admin-authorized users see a gear icon action in the header that navigates to the Admin homepage.
- Breadcrumb navigation appears immediately below the header and reflects current location with upward navigation.
- Organization logos rendered in the header must be constrained to a maximum rendered height of `150px` and keep aspect ratio.

## Roles and Permissions

| Permission | Site Admin | Org Admin | User | Read Only |
|---|:---:|:---:|:---:|:---:|
| Create organizations | ✓ | | | |
| Edit own organization | ✓ | ✓ | | |
| Manage users (all orgs) | ✓ | | | |
| Manage users (own org) | ✓ | ✓ | | |
| Import users by CSV (authorized orgs) | ✓ | ✓ | | |
| Create/manage boards | ✓ | ✓ | | |
| Manage statuses | ✓ | ✓ | | |
| Manage Idea Type and Business Impact options | ✓ | ✓ | | |
| View boards and ideas | ✓ | ✓ | ✓ | ✓ |
| Create/edit ideas | ✓ | ✓ | ✓ | |
| Edit idea description | ✓ | ✓ | Author only | |
| Change idea assignees | ✓ | ✓ | Author only | |
| Delete ideas (soft) | ✓ | ✓ | | |
| Bulk CSV import ideas | ✓ | ✓ | | |
| Update idea status | ✓ | ✓ | ✓* | |
| Comment on ideas | ✓ | ✓ | ✓ | ✓ |
| Upvote ideas | ✓ | ✓ | ✓ | ✓ |
| Mention users | ✓ | ✓ | ✓ | |

*If permitted by board configuration, Users can update the status of any idea on that board.

## Priorities
- **P0**: Authentication, organization management, user/role management, boards, statuses, idea CRUD, comments, upvote
- **P1**: Password reset, email notifications
- **P2**: OAuth/OIDC (Microsoft Entra ID first)
- **P3**: SAML
- **P4**: Remember this device