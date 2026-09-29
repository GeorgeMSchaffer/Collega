# Feature: Client UI Revisions (Bugs and Tweaks)

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** a 2026-07/08 batch of client bug fixes and layout revisions for the Blazor client; its rail,
>   drawers and Boards page are superseded (D6, 2026-09-27); `20-feature-client-ui.md` is authoritative.
> - **Key rules:** logout is route-based via `/logout` (D2); the unauthenticated shell shows only Login and
>   Register (D3); Admin is renamed Settings, `/admin` returns 404; Home is D4's richer dashboard (D1
>   superseded); list pages search and paginate server-side — paging is now 10/25/50/100, default 10 (comp R).
> - **Contracts:** contracts/auth.md
> - **Decisions:** 2026-09-03 "Comp P is the canonical comp; the client is built on Tailwind CSS + shadcn/ui";
>   2026-09-27 "Desk screens use the full width, and the Boards screens carry the board actions"

## Purpose

A batch of client UI bug fixes and structural revisions: layout, navigation, the Settings (formerly
Admin) area, list-page conventions, and removal of template placeholder code. Captured via QA
interviews on 2026-07-30 and 2026-07-31.

## Decision Log Addendum (2026-08-03)

- Decision D1 (superseded 2026-08-07, see Decision D4): Home dashboard scope was locked to **MVP summary dashboard** (welcome + quick links + counts) for this implementation slice.
- Decision D2: Logout is route-based (`/logout`), to keep sign-out behavior explicit and testable.
- Decision D3: Unauthenticated shell is restricted to `Login` and `Register` links only.

## Decision Log Addendum (2026-08-07)

## Decision Log Addendum (2026-09-03)

- Decision D6: **Comp P is the canonical shell and surface model** (`SPEC/decisions.md` 2026-09-03). Authoritative description: `SPEC/20-feature-client-ui.md`.
  - For the TypeScript conversion, the 64px icon rail (Rail, below) becomes comp P's fixed left sidebar with grouped nav and a bottom identity block.
  - The List + Drawer pattern (D5) becomes list + **inline create** beside the list + the **docked inspector** for edits — no drawers, no create modal.
  - D2 (route-based logout), D3 (unauthenticated shell) and D4's Home counts carry forward; D4's tile grid is replaced by comp P's Home.
  - The shipped Blazor client keeps the rail and drawers until cutover.

## Decision Log Addendum (2026-08-10)

- Decision D5: The admin management entities — Organizations, Users, Statuses, Idea Types, and Custom Fields — adopt the **List + Drawer** pattern canonically, matching the Ideas surface.
  - Replaces the earlier full-page-form (Organizations, Users) and inline-edit-card (Statuses, Idea Types, Custom Fields) patterns under "Admin-Style Pages: List/Form Pattern" below; that section's list-column definitions remain current, its full-page/inline **edit** surface is superseded by the drawer.
  - Each list row's **Details** action opens a right slide-in drawer (read view + Edit toggle → inline form + Save/Cancel footer); **Add New** opens a centered create modal.
  - The chrome was the Blazor client's shared `DrawerShell` / `CreateModalShell` components, used by Ideas too (deleted with that client in F6).
  - Current specification: `SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)"; the Blazor drawer is recorded under that file's "SUPERSEDED SURFACES — the shipped Blazor client (Comp C, until cutover)". *(This pointed at a section, "Admin entities use the same List + Drawer pattern", that no longer exists.)* Delivered in Sprint 2 (`SPEC/sprints/archive/sprint-02-drawer-pattern-rollout.md`).

- Decision D4: Home dashboard scope is locked to the **richer dashboard** — welcome message, `Boards` / `Your ideas` / `Assigned to you` counts, a "Your boards" tile grid (one tile per accessible board with an open/assigned/last-active summary, plus a "Request a new board" tile), and a "Catching you up" activity feed (recent mentions, upvotes, and status moves).
  - Supersedes Decision D1's simpler MVP version ("Home Page Dashboard" below still describes the superseded D1 scope).
  - Locked via `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` (`Home` screen, superseding the earlier `-v4-combined.html` sign-off) — see `SPEC/implementation-agent-tracker.md` for the full decision trail.

## Bug Fixes

### BUG-1: Errant `else {` on Change Password screen
- The Change Password page renders a literal `else {` and `else {}` as visible page content.
- Root cause: the `</AuthGate>` tag closed before the `else` branch; the fix made the Blazor page's conditional valid. (That client was deleted in F6.)
- Acceptance: no stray code fragments render on `ChangePassword` in any state (initial, validation error, success).

### BUG-2: Placeholder template code removal
- Remove all Weather/forecast and Counter placeholder functionality left over from the Blazor template: the Weather and Counter pages, related sample data/services, and any nav links to them. (That client was deleted in F6.)
- Acceptance: no routes, menu items, or code references to Weather or Counter remain; solution builds and tests pass.

## Layout and Header

### Header and Menu (superseded 2026-08-07 — see Rail below)
Predates the rail decision and no longer describes the built shell. Kept for the still-valid parts
(routing behavior, role-scoping, what's NOT in primary nav) — read "header gear icon" as "rail
Settings icon" and "menu" as "rail":
- ~~Header background color is `rgb(33, 37, 41)` across the entire header bar.~~ Dropped — no separate header bar.
- ~~The signed-in Username in the header renders in white.~~ ~~Sign Out is an icon button placed immediately to the LEFT of the Username display.~~ Superseded: the rail's bottom avatar opens a click-open popover with Sign Out and Profile instead.
- A Settings icon (formerly "Admin/gear") lower in the rail navigates to the Settings area (see below), role-scoped, same as the old header gear.
- Sign Out navigates to `/logout`, where logout is executed and the user is returned to `/login` (unchanged — see Decision D2).
- No `Password update required` text link anywhere in the shell; required-change routing is enforced by the authentication gate (unchanged).
- When unauthenticated (or otherwise not authorized for protected UI), the shell shows only `Login` and `Register` links — no protected rail icons (unchanged — see Decision D3).
- The primary rail is vertical (not horizontal, not under a header). Items, top to bottom: Home, Boards, Ideas, Settings, then the bottom avatar — identically on every screen (locked 2026-08-07; the earlier "Ideas rail entry not yet decided" gap is resolved).
- Settings is NOT a top-level rail icon indistinguishable from Home/Boards/Ideas; it's the fourth rail icon, role-scoped the same way the old header gear was.
- Change Password is NOT in the rail; it is accessible only from Settings → My Profile (unchanged).
- The protected rail icons are shown only for authenticated users with access to protected routes (unchanged).
- Rail links navigate to list-entry pages: Home (`/`), Boards (`/boards`), Ideas (`/ideas`), Settings (`/settings`).

### Rail (locked 2026-08-07; superseded for the conversion by Decision D6)
See `SPEC/20-feature-client-ui.md` "NAVIGATION" for the comp P sidebar that replaces it, and its "SUPERSEDED SURFACES — the shipped Blazor client (Comp C, until cutover)" section for the rail and `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` for the reference implementation (supersedes `-v4-combined.html`).

### Unauthenticated and Unauthorized Shell
- Unauthenticated users can access `/login` and `/register`; attempting protected routes redirects them to `/login`.
- Authenticated users visiting `/login` are redirected to the Home Dashboard at `/`, unless they must complete `/change-password` first.
- Unauthorized users (authenticated but lacking permission for a specific feature) receive an explicit Forbidden/Not Found experience per existing API/UI policy; admin links are never a substitute for authorization.

### Mockup Alignment
Client layout and interaction details should align to the mockup set in `SPEC/mockups`:
- `01-login-and-org-selection.svg` for login/register baseline structure (while using invite-code self-registration behavior from current auth contracts).
- `02-admin-organizations.svg`, `03-admin-users.svg`, and `06-status-management.svg` for settings administration list/form rhythm.
- `04-board-overview.svg`, `05-idea-detail-panel.svg`, and `12-idea-card-and-overlay.svg` for board and idea interaction patterns — **superseded**: the Comp C pivot first replaced these SVG overlays with a full-page Idea Detail, and the 2026-08-10 decision then replaced that with a right slide-in **drawer** (detail + inline edit) plus a centered **create modal**, addressable at `/ideas/{ideaId}` / `?idea={ideaId}` (see `SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)", which carries those URL rules; the "Idea Detail Surface" section this cited no longer exists). `SPEC/mockups/comp-c-review-09-detail-surfaces.html` (Right slide-in pattern) is the locked reference for idea detail/edit/create; `comp-c-review-04-idea-detail.html` is retained only for the field-level content it enumerates.
- `10-board-empty-state-guided-setup.svg` for guided empty-state behavior.

## Settings Area (formerly "Admin")

- The admin area is renamed to "Settings" everywhere: page titles, gear icon tooltip, and routes (`/settings/...`).
- The old `/admin` routes return 404; only `/settings/...` routes are active. No redirect is needed.
- Clicking the header gear icon navigates to the Settings landing page (`/settings`).
- The Settings landing page shows:
  - **My Profile** (all authenticated users): view/update personal info. The change-password form is embedded as an inline section — no standalone `/change-password` nav link or route is needed.
  - Role-scoped admin links — Site Admin: Organizations, Users, Boards & Statuses. Org Admin: Users and Boards & Statuses, own organization only. Member: My Profile only; no admin links rendered.
- Site Admin is not organization-owned. Its Boards, Ideas, Users, Statuses, and User-Defined Fields list views aggregate all organizations and identify each row's owning organization; no synthetic or selected organization membership is required for read access. Mutations remain target-organization scoped.
- Link visibility is a UI convenience only; the API remains the authority for authorization.

## Admin-Style Pages: List/Form Pattern

Applies to Settings pages for Organizations, Users, and Boards & Statuses.

- Each page defaults to a LIST view.
- A Create button (e.g., "Create Organization") appears above the list, visible only to roles permitted to create that entity (Create Organization: Site Admin only).
- Edit on a row, or Create, swaps the list view for the FORM view on the same page; saving or cancelling returns to the list, refreshed.

### Organization list columns (all searchable)

| Column | Notes |
|---|---|
| Company | `CompanyName` |
| Description | org description field |
| City | |
| State | |
| Phone | |
| Invite Code | plain display |

- No Status (Active/Archived) column; archived state is visible on the form only.
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
> - `Board.IsArchived` (bool)
> - `Status.Color` (string?, max 20), `Status.SortOrder` (int), `Status.IsDefault` (bool)
>
> The EF Core migrations this named belonged to the deleted .NET stack; the schema is now `packages/infrastructure/prisma/schema.prisma`.

## Boards Page

> **Superseded 2026-09-27** (`SPEC/decisions.md`): the Boards page also carries the board actions
> (Manage boards, New board, Edit per board). `SPEC/20-feature-client-ui.md` "`/boards` — Boards"
> is current.

- Displays ONLY a list of boards the user can access. Columns: Name, Board Type, Status (Active/Archived).
- Clicking a board row navigates to that board's swimlane/kanban view.

## Ideas Page (new)

- New "Ideas" page at `/ideas`, reachable from the rail's `Ideas` icon. *(This said no comp existed yet, citing a "Still unsettled" note that is gone; the page's pattern is now `SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)".)*
- Displays a combined list of ideas created by OR assigned to the current user, with a filter: All (default), Created by me, Assigned to me.
- List columns: Title, Created By, Assigned To, Status, Created Date (all searchable).
- **Details** on a row opens the idea in the drawer over the list, at `/ideas?idea={id}` (`SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)"). *Superseded 2026-09-29 — see `SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved": this said Details navigates to a dedicated `/ideas/{id}/edit` route with a Back button.*

## Home Page Dashboard (authenticated users) (superseded 2026-08-07 by Decision D4 — see above)

Decision D1's original MVP scope, kept for history. The locked scope is Decision D4's richer dashboard:

- Welcome message and `Boards` / `Your ideas` / `Assigned to you` at-a-glance counts.
- A "Your boards" tile grid — one tile per accessible board with an open/assigned/last-active summary, plus a "Request a new board" tile.
- A "Catching you up" activity feed — recent mentions, upvotes, and status moves.
- Dashboard data should use existing list/service endpoints where possible and degrade gracefully to zero/empty messaging when data is unavailable.
- Dashboard follows the same role-aware visibility conventions as the rest of the authenticated shell.

Superseded D1 sections, for reference only: welcome summary (user name + role); quick actions (Boards, Ideas, Settings); at-a-glance counts (accessible boards, ideas created by me, ideas assigned to me) — the counts carry forward into D4 above, the quick-actions row does not (the rail already exposes those routes).

## Uniform List Conventions (all list pages)

Applies to Organizations, Users, Ideas, Boards, and any future entity list page.

- Uniform search bar above the list, filtering across all columns displayed for that entity (see per-entity column tables above).
- Pagination controls with page size options 10 (default), 25, 50 and 100 (`SPEC/20-feature-client-ui.md` "List and detail pattern (comp R — 2026-09-27)"). *Superseded 2026-09-29 — see `SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved": this said 25 (default), 50, 100, 250.*
- Search and pagination are SERVER-SIDE: list API endpoints accept `search`, `page`, and `pageSize` query parameters per SPEC/30-Contracts.md collection conventions.
- Changing the search text resets to page 1.

## Acceptance Criteria

- [ ] Change Password page renders no stray `else {` or `else {}` text.
- [ ] Weather and Counter pages, links, and code are fully removed.
- [ ] No separate header bar is rendered (no `rgb(33, 37, 41)` bar); the rail's bottom avatar popover provides Sign Out and Profile.
- [ ] Sign Out routes through `/logout` and returns the user to `/login`.
- [ ] Shell does not render `Password update required` text anywhere.
- [ ] Unauthenticated shell shows only Login and Register links.
- [ ] Unauthenticated protected routes redirect to `/login`; authenticated Login navigation returns to `/` unless password change is required.
- [ ] The 64px icon rail shows Home, Boards, Ideas, and Settings identically on every screen, only for authenticated users.
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
- [ ] Ideas page (`/ideas`) lists combined created-by/assigned-to ideas with All/Created/Assigned filter and Title/Created By/Assigned To/Status/Created Date columns; Details opens the idea's drawer at `/ideas?idea={id}` (superseded 2026-09-29; this said `/ideas/{id}/edit`).
- [ ] All list pages have a uniform search bar and server-side pagination with 10/25/50/100 page sizes (default 10) — superseded 2026-09-29; this said 25/50/100/250 (default 25).
- [ ] Home page is an authenticated dashboard per Decision D4: welcome message, `Boards`/`Your ideas`/`Assigned to you` counts, a "Your boards" tile grid with a "Request a new board" tile, and a "Catching you up" activity feed.
- [ ] My Profile edits first and last name with immediate shell refresh, keeps email/role read-only, and provides voluntary password change.
- [ ] Successful required and voluntary password changes clear authentication, return to Login with confirmation, and re-login lands on Dashboard.
- [ ] The 28-minute idle warning, 30-minute expiry, Stay signed in action, absolute expiry, and cross-tab activity/logout behavior match the canonical authentication spec.
- [ ] *Superseded 2026-09-28 for the height by `20-feature-client-ui.md` "Forms and controls" (34px fields, 32px buttons):* Native and Fluent text-like controls render at a stable 36px height with vertically centered content; textareas retain independent content-sized geometry.
- [ ] Rail and reorder/drag actions use Fluent System Icons with stable dimensions, accessible labels/tooltips, visible focus, and disabled states instead of emoji or Unicode glyphs.
- [ ] Session, password redirect, control geometry, and icon behavior receive user manual acceptance on desktop and narrow layouts before their Bug Triage items move to `SPEC/archive/bug-triage-completed.md`.
