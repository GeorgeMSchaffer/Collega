## NAVIGATION

Primary navigation is a 64px icon rail on the left edge of the viewport (locked 2026-08-07): Home, Boards, Ideas, and Settings icons near the top, identically on every screen (role-scoped, same routes as `/settings/*` below), and a user avatar pinned to the bottom of the rail — clicking the avatar opens a click-open popover with Sign Out and Profile. There is no separate horizontal top menu and no separate header bar (no `rgb(33,37,41)` bar, no header-level gear icon, no header-level Sign Out icon) — those are dropped in favor of the rail. See `SPEC/mockups/comp-c-review-06-lockin-v5-final.html` for the reference implementation (supersedes `-v4-combined.html`).

The rest of this section (menu items, active-state styling, routes) describes the pre-rail horizontal-menu design and is kept for its still-valid parts (routes, active-state styling detail, role-scoping) — read "menu" below as "rail," not literally.

The active item in the application's primary navigation has a flat rectangular background with stronger text and icon color. It has no border radius and no left-edge active border. The active link exposes `aria-current="page"` and retains a visible keyboard focus outline. Tabs, pivots, filter chips, and segmented controls keep their control-specific selected styles.

- /Home: Displays a list of various boards the user has access to as well a dashboard
- /boards: List of boards the user can access; clicking a board opens its swimlane view
- /board/{boardId}: Board detail with ideas arranged in swimlane columns mapped to the board's statuses
- /ideas: User-focused idea list/search surface; it does not duplicate the selected board detail route
- /settings: Settings landing page (formerly Admin) with My Profile and role-scoped admin links.
  /settings/profile : Edit the current user's first and last name and change their password; email and role are read-only.
    /settings/organizations :  Create and Manage organizations (list-first, form on create/edit)
    /settings/organizations/{orgId}/users: Create and Manage Users for an org
    /settings/organizations/{orgId}/statuses:  Create and manage statuses for the org
    /settings/organizations/{orgId}/idea-fields: Create and manage Idea Type and Business Impact options for the org

  Site Admin is a global account and never requires an organization membership or `organizationId`
  claim to browse platform data. Home, Boards, Ideas, Users, Statuses, and User-Defined Fields aggregate records
  from every organization and display the owning organization where needed. Create and edit operations
  remain explicitly scoped to the selected resource's organization; Site Admin chooses an organization
  before creating an organization-owned resource.

  When an authenticated API request returns `401` because the persisted token is expired or its
  security stamp is no longer valid, the client clears the persisted session and returns to Login with
  the expired-session message instead of leaving the current page in an error state.

  - Compatibility redirects: `/board` → `/boards`; `/workflow` and `/workflows` → `/boards`; `/workflow/{boardId}` → `/board/{boardId}`

  ## `/board/{boardId}` — Kanban Board

  Route: `/board/{boardId}`

Replaces the previous flat-list design (All / Created by me / Assigned to me filter tabs and inline edit form). Ideas are displayed as cards arranged in swimlane columns, where each column represents one `Status` from the selected board.

### Board Header
The board header contains: board name (left), search input (placeholder: "Search title, tag, assignee"), and a primary **New Idea** button (right). The New Idea button navigates to the Idea Detail page in create mode, pre-populating the target status as the left-most column. The New Idea button is hidden for ReadOnly users.

### Swimlane Columns
- One column per `Status` on the selected board, ordered by `Status.SortOrder` ascending.
- Column header shows the status name, a colour dot (`Status.Color`), and idea count.
- Columns scroll horizontally if they overflow the viewport.

### Idea Cards
Cards are compact. Each card shows: title (clickable, 2-line truncation), priority badge, Business Impact color chip, assigned tags, assigned-user personas, submission age, upvote icon button/count, and Add Comment icon button/count. A dedicated drag handle starts card movement; interactive controls never start a drag. Clicking the card title navigates to the full-page Idea Detail view at `/ideas/{ideaId}/edit` — the same view reached from the Ideas list (see `SPEC/20-feature-client-ui-revisions.md`). The page supports full editing: title, priority, Idea Type, Business Impact, due date (optional), description when authorized, zero to five assignees, zero to 10 tags, mentions, and comments. Page actions include **Cancel** (returns to the board), **Save Idea**, **Move in Board** (status picker without dragging), and an admin-only **Delete Idea** action with confirmation.

Tags are selected and created through a searchable multi-value Tag field in Idea Detail. Anyone authorized to edit the idea can create a reusable organization-scoped tag inline. Tag names are trimmed and matched case-insensitively. Cards display the first three tags alphabetically and a `+N` indicator for the remainder; the complete tag list is available in Idea Detail and accessible text or a keyboard-accessible tooltip.

The Assignees field is an optional searchable multi-select populated with active users from the idea's organization. It accepts at most five distinct users. Inactive users already assigned remain visible but cannot be newly selected. Cards order assignees by first name then last name and show the first three personas followed by `+N`. Each visible persona contains a circular avatar with the first letter of the first name and first letter of the last name, followed by the first name. Full names are available in Idea Detail and accessible text or a keyboard-accessible tooltip. If one name part is unexpectedly absent, use the available initial and first available display label; if both are absent, render `?` with accessible label `Unknown user`.

Cards show submission age as viewer-local calendar-day difference between `createdAtUtc` and today: `0 days ago`, `1 day ago`, or `{N} days ago`. Future values are clamped to `0 days ago`.

The upvote icon is unfilled when inactive and filled when the current user has upvoted. Toggle the icon and count optimistically and restore both on failure. Clicking Add Comment navigates to the Idea Detail page, scrolls comments into view, and focuses the comment composer. If commenting is unavailable, focus the comments heading.

### Filter Chips
Filter chips appear above the board: **All**, **Created by me** (`AuthorUserId == currentUserId`), **Assigned to me** (the current user is in the idea's assignee collection). Filtering is client-side. Empty columns remain visible with a "No ideas" placeholder.

### Search
Text input above the board filters cards by title, tag, or assignee (client-side, case-insensitive). Combinable with filter chips.

### Drag-and-Drop: Moving an Idea
1. User drags a card by its dedicated handle to another column on desktop.
2. Optimistic UI moves the card immediately.
3. Calls `POST /api/v1/ideas/{ideaId}/status` with the target status ID. The idea's status is set to the target swimlane's `Status`.
4. On failure: card reverts, error toast shown.
5. Board `allowUserStatusUpdate` and role restrictions are enforced server-side (403 → revert + permission message).

### Drag-and-Drop: Reordering Columns
1. SiteAdmin and OrgAdmin users can drag column headers to reorder columns.
2. Optimistic reorder applied immediately.
3. For each column whose `SortOrder` changed, calls `PUT /api/v1/boards/{boardId}/statuses/{statusId}` with the new `sortOrder`. Reorder saves immediately on drop — no additional confirmation required.
4. On failure: revert all columns, show error toast.
5. User and ReadOnly roles see columns but cannot reorder them.

6. Changing status in Idea Detail uses the same move operation and immediately updates the idea's status; returning to the board shows the card in the corresponding swimlane.
7. Keyboard and touch users move ideas with the Idea Detail status selector; touch drag is deferred.

### Component Structure
```
Ideas.razor                    ← page shell
  └─ IdeaKanbanBoard.razor     ← horizontal scroll + column drag
       └─ KanbanColumn.razor   ← column header, drop zone, card list
            └─ IdeaCard.razor  ← card, drag source
```
New components live in `src/Collega.Client/Shared/Kanban/`.

### DnD Technology
HTML5 drag-and-drop (desktop only) with a dedicated handle and visible drop targets. Touch/mobile drag is deferred; mobile view is scrollable and status movement remains available through Idea Detail.

### Acceptance Criteria
- `/boards` shows the board list and `/board/{boardId}` shows the selected board's Kanban view
- `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}` redirect to canonical Board routes
- No user-facing UI displays Workflow or Workflows terminology
- Columns reflect the selected board's statuses in `SortOrder` order
- Filter chips and title/tag/assignee search work across all columns (client-side)
- Card drag starts only from the dedicated handle, calls `MoveIdeaStatusAsync`, sets the idea status to the target swimlane's status, and reverts on failure with a toast
- Column drag (SiteAdmin/OrgAdmin only) saves immediately on drop; calls `UpdateStatusAsync` per affected status; reverts on failure
- Clicking a card title navigates to the full-page Idea Detail view at `/ideas/{ideaId}/edit`
- Idea Detail page provides Cancel, Save Idea, Move in Board, and authorized soft-delete actions
- Changing status in Idea Detail immediately updates the idea's status, reflected in the matching swimlane on return to the board
- Cards display Business Impact, current-user upvote state/count, and comment count
- Idea Detail provides a searchable Tag multi-select that selects existing organization tags and creates normalized reusable tags inline for authorized editors, with at most 10 tags per idea
- Idea Detail provides an optional searchable Assignees multi-select containing active users from the idea's organization, with at most five distinct assignees and historical inactive-assignee display
- Cards display the first three tags alphabetically and first three assignee personas by first/last name, with `+N` overflow and complete accessible values
- Each persona shows first-name/last-name initials followed by first name, with an accessible missing-name fallback
- Cards display viewer-local calendar-day submission age with zero, singular, plural, and future-timestamp behavior
- Clicking the card comment action navigates to Idea Detail and focuses the comment composer
- Upvote toggles optimistically and rolls back on failure
- New Idea button in board header navigates to Idea Detail in create mode; hidden for ReadOnly users
- Mobile/touch: scrollable view, no drag support, status movement available in Idea Detail

## VISUAL DESIGN DIRECTION (Selected 2026-08-06 — supersedes Comp A)

Comp C "Fluent Editorial" (`SPEC/mockups/comp-c-fluent-editorial.html`) is the selected UI/UX layout direction for all client pages, per `CLAUDE.md`. Comp A "Command Center" (`SPEC/mockups/comp-a-command-center.html`) and Comp B "Board First" are retained for history only and are not implementation targets.

Page-level layout for Comp C is being locked incrementally via throwaway review comps in `SPEC/mockups/comp-c-review-*.html` (see `SPEC/implementation-agent-tracker.md`). **Locked as of 2026-08-07:** `comp-c-review-06-lockin-v5-final.html` is the chosen direction for Sign in, Home, Settings (Orgs/Users lists), Board List, Swim Lanes, and Idea Detail. `comp-c-review-01`, `-02`, `-04`, and `-05` remain the reference for detailed CRUD states v5 doesn't repeat (new/edit/detail/CSV-import forms, status color picker, sign-in edge cases). Still unsettled: the standalone `/ideas` page has no comp yet, and a mobile/narrow-viewport pass is undesigned. See `CLAUDE.md`'s "Target Architecture" section for the current summary.

### Board-Specific Reference (superseded 2026-08-07)
The workspace artifact `mockups/sprint-management/idea-board.html` was the layout and styling authority for `/board/{boardId}` under the earlier Comp A direction. It has been superseded by `comp-c-review-06-lockin-v5-final.html`'s locked Board List and Swim Lanes screens (see Layout below); treat this subsection as historical only.

### Layout (Comp C — Fluent Editorial)
- App shell: see NAVIGATION above for the locked shell structure — a 64px icon rail (Home, Boards, Ideas, Settings, bottom avatar popover for Sign Out/Profile), no horizontal top menu, no separate header bar.
- Content pages use breadcrumbs, a page title with short subtitle, and a command bar (primary action, filters) above dense data tables or cards.
- Home is a dashboard — content scope is locked to the richer dashboard (welcome + counts + board tiles + activity feed) per `SPEC/20-feature-client-ui-revisions.md` Decision D4 (supersedes D1), matching `comp-c-review-06-lockin-v5-final.html`'s `Home` screen.
- Settings hub (formerly "Admin hub") uses link cards per tool (Organizations, Users, Boards & Statuses) scoped per role, per `SPEC/20-feature-client-ui-revisions.md`.
- Board view offers both a List view (grouped rows by status, Swim Lane default per `comp-c-review-03-board-list.html`) and a Swim Lanes Kanban view, both locked in `comp-c-review-06-lockin-v5-final.html`. Swimlane cards use the **Flat** treatment (pale lane background, priority-colored chip, left-border status accent per card, small status dot in the lane header) — Banded and Tinted alternatives were considered and dropped. List rows and Swim Lane cards share one status-color visual system; priority is a separate red/amber/green dot/chip in both views, not borrowed from the lane's status color. Clicking a card title navigates to the full-page Idea Detail view (below); it does not open an overlay.
- Idea detail is a full-page, editorial article layout (not an overlay): primary content/comments in the main column with a metadata sidebar (status, priority, assignee, due date, tags, audit info) alongside. Reached at `/ideas/{ideaId}/edit` from both a board card and the Ideas list — one Idea Detail experience, two entry points.
- Auth screens (login, first-login password change) are centered cards using Comp C's warm neutral palette, locked via `comp-c-review-06-lockin-v5-final.html`'s Sign in screen (general edge-case detail remains in `comp-c-review-01-login-and-auth.html`).
- Implement with Fluent UI Blazor components per `SPEC/mockups/README.md` implementation notes (providers, dialog/toast services, no manual asset tags).

### Session, Profile, Controls, and Icons (locked 2026-08-08)
- My Profile contains an editable first/last-name section and a voluntary password-change section; email and role are read-only. A successful name update refreshes shell identity immediately.
- Successful required and voluntary password changes clear client authentication and return to Login with confirmation. Re-login lands on Dashboard unless a separate normal return URL applies.
- After 28 minutes without activity, an accessible Fluent dialog shows a live two-minute countdown with Stay signed in and Sign out actions. Staying signed in resets browser inactivity only; idle or absolute expiry returns to Login with the specific session-expired message.
- Native and Fluent text-like inputs and selects use stable 36px geometry with vertically centered single-line content. Textareas retain content-sized height and independent padding.
- Navigation and action glyphs use Fluent System Icons rather than emoji or Unicode characters. Icon-only buttons have stable dimensions, accessible names, hover tooltips, visible keyboard focus, and correct disabled behavior; decorative icons adjacent to visible text are hidden from assistive technology.
- Session timing, cross-tab behavior, password redirects, control geometry, and icon accessibility require user manual acceptance on desktop and narrow layouts until the parallel browser-automation work is integrated.

### Typography
- Font family: `"Segoe UI", -apple-system, Roboto, sans-serif` for body text; `Georgia, "Times New Roman", serif` for headings and display text (`h1`, `h2`, stat figures) — per `SPEC/mockups/comp-c-fluent-editorial.html`. This replaces the prior single-family IBM Plex Sans / Inter direction from Comp A.

### Color palette (from `SPEC/mockups/comp-c-fluent-editorial.html`)
- Ink/neutrals: text `#242424`, secondary `#484644`, muted `#797672`.
- Surfaces: background `#faf9f8`, cards/surface `#ffffff`, borders `#e4e2df`.
- Brand/accent (indigo, not Comp A's blue): accent `#5b5fc7`, deep accent `#444791`, soft accent fill `#eef0fb`.
- Semantic: success `#0e700e`, warning `#9a5b00`, error `#b10e1c`.

## ERROR DISPLAY

- Frontend error surfaces must show the full underlying error message in Development.
- Frontend error surfaces must show a generic user-safe message in Production.
- The same UI should remain available in both modes, but the content should differ based on the runtime environment.