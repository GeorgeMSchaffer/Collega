## NAVIGATION

Primary navigation is a horizontal menu under the main header: Home, Boards, Ideas. The admin area (renamed "Settings") is reached via a gear icon in the header, not the menu. See SPEC/20-feature-client-ui-revisions.md for layout and Settings details.

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

  - Compatibility redirects: `/board` → `/boards`; `/workflow` and `/workflows` → `/boards`; `/workflow/{boardId}` → `/board/{boardId}`

  ## `/board/{boardId}` — Kanban Board

  Route: `/board/{boardId}`

Replaces the previous flat-list design (All / Created by me / Assigned to me filter tabs and inline edit form). Ideas are displayed as cards arranged in swimlane columns, where each column represents one `Status` from the selected board.

### Board Header
The board header contains: board name (left), search input (placeholder: "Search title, tag, assignee"), and a primary **New Idea** button (right). The New Idea button opens the detail overlay in create mode, pre-populating the target status as the left-most column. The New Idea button is hidden for ReadOnly users.

### Swimlane Columns
- One column per `Status` on the selected board, ordered by `Status.SortOrder` ascending.
- Column header shows the status name, a colour dot (`Status.Color`), and idea count.
- Columns scroll horizontally if they overflow the viewport.

### Idea Cards
Cards are compact. Each card shows: title (clickable, 2-line truncation), priority badge, Business Impact color chip, assigned tags, assigned-user personas, submission age, upvote icon button/count, and Add Comment icon button/count. A dedicated drag handle starts card movement; interactive controls never start a drag. Clicking the card title opens an in-context detail overlay with no page navigation. The overlay supports full editing: title, priority, Idea Type, Business Impact, due date (optional), description when authorized, zero to five assignees, zero to 10 tags, mentions, and comments. Overlay actions include **Cancel**, **Save Idea**, **Move in Board** (status picker without dragging), and an admin-only **Delete Idea** action with confirmation.

Tags are selected and created through a searchable multi-value Tag field in Idea Detail. Anyone authorized to edit the idea can create a reusable organization-scoped tag inline. Tag names are trimmed and matched case-insensitively. Cards display the first three tags alphabetically and a `+N` indicator for the remainder; the complete tag list is available in Idea Detail and accessible text or a keyboard-accessible tooltip.

The Assignees field is an optional searchable multi-select populated with active users from the idea's organization. It accepts at most five distinct users. Inactive users already assigned remain visible but cannot be newly selected. Cards order assignees by first name then last name and show the first three personas followed by `+N`. Each visible persona contains a circular avatar with the first letter of the first name and first letter of the last name, followed by the first name. Full names are available in Idea Detail and accessible text or a keyboard-accessible tooltip. If one name part is unexpectedly absent, use the available initial and first available display label; if both are absent, render `?` with accessible label `Unknown user`.

Cards show submission age as viewer-local calendar-day difference between `createdAtUtc` and today: `0 days ago`, `1 day ago`, or `{N} days ago`. Future values are clamped to `0 days ago`.

The upvote icon is unfilled when inactive and filled when the current user has upvoted. Toggle the icon and count optimistically and restore both on failure. Clicking Add Comment opens the overlay, scrolls comments into view, and focuses the comment composer. If commenting is unavailable, focus the comments heading.

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

6. Changing status in Idea Detail uses the same move operation and immediately relocates the card while the overlay remains open.
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
- Clicking a card title opens the in-context detail overlay; no page navigation occurs
- Detail overlay provides Cancel, Save Idea, Move in Board, and authorized soft-delete actions
- Changing status in Idea Detail immediately moves the visible card to the matching swimlane
- Cards display Business Impact, current-user upvote state/count, and comment count
- Idea Detail provides a searchable Tag multi-select that selects existing organization tags and creates normalized reusable tags inline for authorized editors, with at most 10 tags per idea
- Idea Detail provides an optional searchable Assignees multi-select containing active users from the idea's organization, with at most five distinct assignees and historical inactive-assignee display
- Cards display the first three tags alphabetically and first three assignee personas by first/last name, with `+N` overflow and complete accessible values
- Each persona shows first-name/last-name initials followed by first name, with an accessible missing-name fallback
- Cards display viewer-local calendar-day submission age with zero, singular, plural, and future-timestamp behavior
- Clicking the card comment action focuses the overlay comment composer
- Upvote toggles optimistically and rolls back on failure
- New Idea button in board header opens overlay in create mode; hidden for ReadOnly users
- Mobile/touch: scrollable view, no drag support, status movement available in Idea Detail

## VISUAL DESIGN DIRECTION (Selected 2026-07-30)

Comp A "Command Center" (`SPEC/mockups/comp-a-command-center.html`) is the selected UI/UX layout direction for all client pages, restyled with the typography and color palette established in the SVG mockup set (`SPEC/mockups/01-login-and-org-selection.svg` through `12-idea-card-and-overlay.svg`).

### Board-Specific Reference (Selected 2026-08-04)
The workspace artifact `mockups/sprint-management/idea-board.html` is the layout and styling authority for `/board/{boardId}`. Match its board hierarchy, density, full-height lane composition, compact card structure, tag row, persona footer, and age placement while binding real organization-configured statuses and the behaviors in this specification. Do not import demo-only Board/List/Mine pivots, approval/rejection assumptions, conversion actions, duplicate New Idea commands, or sprint-management features unless separately specified.

### Layout (from Comp A)
- App shell: 48px top bar (logo, global search, primary "+ New idea" action, notifications, avatar) plus a 240px persistent left navigation rail with grouped sections (Workspace / Boards / Administration) and an accent inset marker on the active item.
- Content pages use breadcrumbs, a page title with short subtitle, and a command bar (primary action, filters) above dense data tables or cards.
- Home is a dashboard: KPI stat cards plus "Your boards" table and a recent-activity feed.
- Admin hub uses link cards per tool (Organizations, Users, Statuses) plus a recent admin activity table.
- Board view uses swimlane columns of compact idea cards (title, priority, tags, assignee, upvote) with a priority edge accent; clicking a card title opens the idea detail overlay.
- Idea detail is a centered overlay with a two-pane body: content/comments on the left, metadata sidebar (status, priority, assignee, due date, tags, audit info) on the right.
- Auth screens (login, first-login password change) are centered cards on a navy-to-blue gradient background.
- Implement with Fluent UI Blazor components per `SPEC/mockups/README.md` implementation notes (providers, dialog/toast services, no manual asset tags).

### Typography
- Font family: `"IBM Plex Sans", Inter, sans-serif` for all text; hierarchy is carried by weight and size, not by additional families.

### Color palette (from SVG mockups)
- Ink/neutrals: text `#0f172a`, secondary `#334155` / `#475569`, muted `#64748b` / `#94a3b8`.
- Surfaces: background `#f8fafc`, cards `#ffffff`, subtle fills `#f1f5f9`, borders `#d0d7de` / `#cbd5e1` / `#e2e8f0`.
- Brand/accent: primary blue `#1d4ed8`, deep navy `#1e3a8a` (hover, emphasis, auth gradient), soft accents `#dbeafe` / `#eff6ff` / `#93c5fd`.
- Semantic: success `#166534` on `#dcfce7`; warning `#9a3412` on `#fff7ed`; error `#7f1d1d` on `#fef2f2`.

## ERROR DISPLAY

- Frontend error surfaces must show the full underlying error message in Development.
- Frontend error surfaces must show a generic user-safe message in Production.
- The same UI should remain available in both modes, but the content should differ based on the runtime environment.