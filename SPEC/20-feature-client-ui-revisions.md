# Feature: Client UI Revisions (Bugs and Tweaks)

## Purpose

Defines a batch of client UI bug fixes and structural revisions covering layout, navigation, the Settings (formerly Admin) area, list-page conventions, and removal of template placeholder code. Decisions were captured via QA interviews on 2026-07-30 and 2026-07-31.

## Decision Log Addendum (2026-08-03)

- Decision D1: Home dashboard scope is locked to **MVP summary dashboard** (welcome + quick links + counts) for this implementation slice.
- Decision D2: Logout interaction is route-based (`/logout`) to keep sign-out behavior explicit and testable.
- Decision D3: Unauthenticated shell is restricted to `Login` and `Register` links only.

## Bug Fixes

### BUG-1: Errant `else {` on Change Password screen
- The Change Password page renders a literal `else {` and `else {}` as visible page content.
- Root cause: the `</AuthGate>` tag closes prematurely before the `else` branch; fix the Razor structure so the conditional is valid.
- Acceptance: no stray code fragments render on `ChangePassword` in any state (initial, validation error, success).

### BUG-2: Placeholder template code removal
- Remove all Weather/forecast and Counter placeholder functionality left over from the Blazor template:
  - `Pages/Weather.razor`, `Pages/Counter.razor`, related sample data/services, and any nav links to them.
- Acceptance: no routes, menu items, or code references to Weather or Counter remain; solution builds and tests pass.

## Layout and Header

### Header
- Header background color is `rgb(33, 37, 41)` across the entire header bar.
- The signed-in Username in the header renders in white.
- Sign Out is an icon button placed immediately to the LEFT of the Username display.
- A gear icon in the header navigates to the Settings area (see below). The gear is visible to all authenticated users.
- The Sign Out icon navigates to `/logout`, where logout is executed and the user is returned to `/login`.
- The header does not display a `Password update required` text link; required-change routing is enforced by the authentication gate.
- When unauthenticated (or otherwise not authorized for protected UI), the header shows only `Login` and `Register` links. No protected navigation links are shown.

### Menu
- The primary menu is horizontal and sits directly under the main header (no vertical sidebar nav).
- Menu items: Home, Boards, Ideas.
- Admin functionality is NOT in the horizontal menu; it is reached only via the header gear icon.
- Change Password is NOT in the menu; it is accessible only from Settings → My Profile.
- The protected menu is shown only for authenticated users with access to protected routes.
- Menu links navigate to list-entry pages: Home (`/`), Boards (`/boards`), Ideas (`/ideas`).

### Unauthenticated and Unauthorized Shell
- Unauthenticated users can access `/login` and `/register`.
- Unauthenticated users attempting protected routes are redirected to `/login`.
- Authenticated users visiting `/login` are redirected to the Home Dashboard at `/`, unless they must complete `/change-password` first.
- Unauthorized users (authenticated but lacking permission for a specific feature) receive an explicit Forbidden/Not Found experience per existing API/UI policy; they do not receive admin links as a substitute for authorization.

### Mockup Alignment
- Client layout and interaction details should align to the mockup set in `SPEC/mockups`:
  - `01-login-and-org-selection.svg` for login/register baseline structure (while using invite-code self-registration behavior from current auth contracts).
  - `02-admin-organizations.svg`, `03-admin-users.svg`, and `06-status-management.svg` for settings administration list/form rhythm.
  - `04-board-overview.svg`, `05-idea-detail-panel.svg`, and `12-idea-card-and-overlay.svg` for board and idea interaction patterns — **superseded**: these SVGs depict an idea-detail overlay, which the Comp C pivot replaced with the full-page Idea Detail view at `/ideas/{ideaId}/edit` (see `SPEC/20-feature-client-ui.md` Visual Design Direction). Use `SPEC/mockups/comp-c-review-04-idea-detail.html` for idea-detail interaction patterns instead once locked.
  - `10-board-empty-state-guided-setup.svg` for guided empty-state behavior.

## Settings Area (formerly "Admin")

- The admin area is renamed to "Settings" everywhere: page titles, gear icon tooltip, and routes (`/settings/...`).
- The old `/admin` routes return 404; only `/settings/...` routes are active. No redirect is needed.
- Clicking the header gear icon navigates to the Settings landing page (`/settings`).
- The Settings landing page shows:
  - **My Profile** (all authenticated users): view/update personal info. The change-password form is embedded in My Profile as an inline section — no standalone `/change-password` nav link or route is needed.
  - Role-scoped admin links:
    - Site Admin: Organizations, Users, Boards & Statuses.
    - Org Admin: Users and Boards & Statuses, scoped to their own organization only.
    - Member: My Profile only; no admin links are rendered.
- Link visibility is a UI convenience only; the API remains the authority for authorization.

## Admin-Style Pages: List/Form Pattern

Applies to Settings pages for Organizations, Users, and Boards & Statuses.

- Each admin-style page defaults to a LIST view.
- A Create button (e.g., "Create Organization") appears above the list, visible only to roles permitted to create that entity (Create Organization: Site Admin only).
- Clicking Edit on a row, or Create, swaps the list view for the FORM view on the same page.
- Saving or cancelling the form returns to the list view with the list refreshed.

### Organization list columns (all searchable)

| Column | Notes |
|---|---|
| Company | `CompanyName` |
| Description | org description field |
| City | |
| State | |
| Phone | |
| Invite Code | plain display |

- No Status (Active/Archived) column in the list; archived state is visible on the form only.
- Search filters across all six columns above.

### Users list columns (all searchable)

| Column | Notes |
|---|---|
| Name | First + Last |
| Email | |
| Role | |
| Organization | Visible to Site Admin only; hidden for Org Admin |
| Status | Active / Inactive / Locked |

### Boards & Statuses list columns

**Boards list:**

| Column | Notes |
|---|---|
| Name | |
| Board Type | Derived from `AllowUserStatusUpdate` — display "User-managed" or "Admin-managed" |
| Status | Active / Archived — requires `Board.IsArchived` domain addition |

**Statuses list:**

| Column | Notes |
|---|---|
| Name | |
| Color | Hex/CSS color — requires `Status.Color` domain addition |
| Sort Order | Integer — requires `Status.SortOrder` domain addition |
| Is Default | Boolean — requires `Status.IsDefault` domain addition |

> **Domain additions required** before the Boards & Statuses Settings page can be fully built:
> - `Board.IsArchived` (bool) — EF migration: `AddBoardIsArchived`
> - `Status.Color` (string?, max 20), `Status.SortOrder` (int), `Status.IsDefault` (bool) — EF migration: `AddStatusListFields`

## Boards Page

- The Boards page displays ONLY a list of boards the user can access.
- Columns: Name, Board Type, Status (Active/Archived).
- Clicking a board row navigates to that board's swimlane/kanban view.

## Ideas Page (new)

- New "Ideas" page at `/ideas`, reachable from the horizontal menu.
- Displays a combined list of ideas created by OR assigned to the current user.
- A filter control offers: All (default), Created by me, Assigned to me.
- List columns: Title, Created By, Assigned To, Status, Created Date (all searchable).
- Clicking **Details** on a row navigates to `/ideas/{id}/edit` (dedicated route, not inline swap).
- The Edit Idea form at `/ideas/{id}/edit` has a Back button returning to `/ideas`.

## Home Page Dashboard (authenticated users)

- The Home page becomes a lightweight authenticated dashboard rather than placeholder template content.
- Initial MVP dashboard sections:
  - Welcome summary (user name + role).
  - Quick actions: Boards, Ideas, Settings.
  - At-a-glance counts: accessible boards, ideas created by me, ideas assigned to me.
- Dashboard data should use existing list/service endpoints where possible and degrade gracefully to zero/empty messaging when data is unavailable.
- Dashboard follows the same role-aware visibility conventions as the rest of the authenticated shell.

## Uniform List Conventions (all list pages)

Applies to Organizations, Users, Ideas, Boards, and any future entity list page.

- Uniform search bar rendered above the list.
- Search filters across all columns displayed for that entity (see per-entity column tables above).
- Pagination controls with page size options 25 (default), 50, 100, 250.
- Search and pagination are SERVER-SIDE: list API endpoints accept `search`, `page`, and `pageSize` query parameters per SPEC/30-Contracts.md collection conventions.
- Changing the search text resets to page 1.

## Acceptance Criteria

- [ ] Change Password page renders no stray `else {` or `else {}` text.
- [ ] Weather and Counter pages, links, and code are fully removed.
- [ ] Header uses `rgb(33, 37, 41)`; Username is white; Sign Out icon sits left of the Username.
- [ ] Sign Out icon routes through `/logout` and returns the user to `/login`.
- [ ] Header does not render `Password update required` text.
- [ ] Unauthenticated shell shows only Login and Register links.
- [ ] Unauthenticated protected routes redirect to `/login`; authenticated Login navigation returns to `/` unless password change is required.
- [ ] Horizontal menu under the header shows Home, Boards, Ideas only for authenticated users.
- [ ] Change Password is accessible only from Settings → My Profile (embedded section); no standalone nav link exists.
- [ ] Gear icon navigates to `/settings`; area is titled "Settings" everywhere; old `/admin` routes return 404.
- [ ] Settings landing shows My Profile for all users and role-correct admin links (Site Admin: Orgs/Users/Boards & Statuses; Org Admin: Users/Boards & Statuses own-org; Member: none).
- [ ] Admin-style pages default to list view; Edit/Create swaps to form view and returns to list on save/cancel.
- [ ] Org list shows Company, Description, City, State, Phone, Invite Code; search covers those 6 columns; no Status column.
- [ ] Users list shows Name, Email, Role, Organization (Site Admin only), Status; all searchable.
- [ ] Boards list page shows Name, Board Type, Status; clicking a board opens `/board/{id}` for its swimlane view.
- [ ] Primary navigation and Dashboard quick actions use `Boards` and `/boards`; no user-facing Workflow terminology remains.
- [ ] `/board`, `/workflow`, and `/workflows` redirect to `/boards`, and `/workflow/{id}` redirects to `/board/{id}`.
- [ ] Boards & Statuses Settings page shows boards list (Name/Board Type/Status) and statuses list (Name/Color/Sort Order/Is Default) — pending domain additions for `Board.IsArchived`, `Status.Color`, `Status.SortOrder`, `Status.IsDefault`.
- [ ] Ideas page (`/ideas`) lists combined created-by/assigned-to ideas with All/Created/Assigned filter and Title/Created By/Assigned To/Status/Created Date columns; Details navigates to `/ideas/{id}/edit`.
- [ ] All list pages have a uniform search bar and server-side pagination with 25/50/100/250 page sizes (default 25).
- [ ] Home page is an authenticated dashboard with welcome summary, quick actions, and boards/my-ideas/assigned-ideas counts.
