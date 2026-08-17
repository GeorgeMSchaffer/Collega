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
  from every organization and display the owning organization where needed.

  Site Admin org-content mutation model (decided 2026-08-11, supersedes the earlier org-picker
  direction): Site Admin does **not** get direct create/edit/delete paths for organization-owned
  content — boards, statuses, idea types/business impacts, custom fields, and ideas. There is no
  org dropdown/picker on any create or edit surface. Instead, Site Admin uses the **View As**
  feature (act-as impersonation, `SPEC/sprints/archive/sprint-06-view-as.md`) to act as a user within the
  target organization; mutations are performed under that impersonated identity with dual-attribution
  audit, so they are naturally org-scoped and permission-checked. **Exception (bootstrap):**
  organization administration and user administration stay direct — Site Admin creates/edits
  organizations, manages users in any organization (including CSV import and invite-code
  regeneration) exactly as specified in `20-feature-organizations-and-users.md`, since a new
  organization has nobody to impersonate yet. Until View As ships, Site Admin has no create path
  for org content (the existing UI gates stay as-is); once it ships, the global aggregate views
  become read-only for org content, with View As as the mutation path.

  When an authenticated API request returns `401` because the persisted token is expired or its
  security stamp is no longer valid, the client clears the persisted session and returns to Login with
  the expired-session message instead of leaving the current page in an error state.

  - Compatibility redirects: `/board` → `/boards`; `/workflow` and `/workflows` → `/boards`; `/workflow/{boardId}` → `/board/{boardId}`

  ## `/board/{boardId}` — Kanban Board

  Route: `/board/{boardId}`

Replaces the previous flat-list design (All / Created by me / Assigned to me filter tabs and inline edit form). Ideas are displayed as cards arranged in swimlane columns, where each column represents one `Status` from the selected board.

### Board Header
The board header contains: board name (left), search input (placeholder: "Search title, tag, assignee"), and a primary **New Idea** button (right). The New Idea button opens the create drawer (right slide-in; see Idea Detail Surface below), pre-populating the target status as the left-most column. The New Idea button is hidden for ReadOnly users.

**Board header control row (changed 2026-08-17, user decision).** On `/board/{boardId}` one row carries, left to right: **Back**, the List / Swim Lanes view switch, then — pushed to the right edge — the **Board** picker and **+ New idea**. The picker and + New idea previously sat in the title row above it. **Back is leftmost**, matching every other list/detail page, where it is the first item in the command bar.

**Back is a link, not a button (2026-08-17, user decision, applies everywhere).** `BackButton` renders with no background, inheriting whatever surface it sits on, with an accent colour and hover underline. It previously used `.btn subtle`, which cleared the border but kept `.btn`'s `background: var(--surface)`, so it painted a card-coloured chip on every page. It stays a `<button>` element because it calls `history.back()` rather than navigating to an href — a fake href would break middle-click and open-in-new-tab. Vertical padding keeps the pointer target at ~28px.

### Swimlane Columns
- One column per `Status` on the selected board, ordered by `Status.SortOrder` ascending.
- Column header shows the status name, a colour dot (`Status.Color`), and idea count.
- Columns scroll horizontally if they overflow the viewport.

### Idea Cards
Cards are compact. Each card shows: title (clickable, 2-line truncation), priority badge, Business Impact color chip, assigned tags, assigned-user personas, submission age, upvote icon button/count, and Add Comment icon button/count. A dedicated drag handle starts card movement; interactive controls never start a drag. Clicking the card title opens the Idea Detail **drawer** (right slide-in overlay; see Idea Detail Surface below) — the same drawer reached from the Ideas list (see `SPEC/20-feature-client-ui-revisions.md`). The drawer supports full editing: title, priority, Idea Type, Business Impact, due date (optional), description when authorized, zero to five assignees, zero to 10 tags, mentions, and comments. Drawer actions include **Edit idea** / **Cancel** / **Save changes**, **Move in Board** (status picker without dragging), and an admin-only **Delete Idea** action with confirmation.

Tags are selected and created through a searchable multi-value Tag field in Idea Detail. Anyone authorized to edit the idea can create a reusable organization-scoped tag inline. Tag names are trimmed and matched case-insensitively. Cards display the first three tags alphabetically and a `+N` indicator for the remainder; the complete tag list is available in Idea Detail and accessible text or a keyboard-accessible tooltip.

The Assignees field is an optional searchable multi-select populated with active users from the idea's organization. It accepts at most five distinct users. Inactive users already assigned remain visible but cannot be newly selected. Cards order assignees by first name then last name and show the first three personas followed by `+N`. Each visible persona contains a circular avatar with the first letter of the first name and first letter of the last name, followed by the first name. Full names are available in Idea Detail and accessible text or a keyboard-accessible tooltip. If one name part is unexpectedly absent, use the available initial and first available display label; if both are absent, render `?` with accessible label `Unknown user`.

Cards show submission age as viewer-local calendar-day difference between `createdAtUtc` and today: `0 days ago`, `1 day ago`, or `{N} days ago`. Future values are clamped to `0 days ago`.

The upvote icon is unfilled when inactive and filled when the current user has upvoted. Toggle the icon and count optimistically and restore both on failure. Clicking Add Comment opens the Idea Detail drawer, scrolls comments into view, and focuses the comment composer. If commenting is unavailable, focus the comments heading.

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

6. Changing status in the Idea Detail drawer uses the same move operation and immediately updates the idea's status; the card re-slots into the corresponding swimlane behind the open drawer (no navigation away).
7. Keyboard and touch users move ideas with the Idea Detail drawer's status selector; touch drag is deferred.

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
- Clicking a card title opens the Idea Detail drawer over the current board (URL gains `?idea={ideaId}`)
- Idea Detail drawer provides Edit/Cancel/Save changes, Move in Board, and authorized soft-delete actions
- Changing status in the drawer immediately updates the idea's status and re-slots the card in the matching swimlane behind the open drawer
- Cards display Business Impact, current-user upvote state/count, and comment count
- Idea Detail provides a searchable Tag multi-select that selects existing organization tags and creates normalized reusable tags inline for authorized editors, with at most 10 tags per idea
- Idea Detail provides an optional searchable Assignees multi-select containing active users from the idea's organization, with at most five distinct assignees and historical inactive-assignee display
- Cards display the first three tags alphabetically and first three assignee personas by first/last name, with `+N` overflow and complete accessible values
- Each persona shows first-name/last-name initials followed by first name, with an accessible missing-name fallback
- Cards display viewer-local calendar-day submission age with zero, singular, plural, and future-timestamp behavior
- Clicking the card comment action opens the Idea Detail drawer with comments in view and the composer focused
- Upvote toggles optimistically and rolls back on failure
- New Idea button in board header opens the create drawer; hidden for ReadOnly users
- Mobile/touch: scrollable view, no drag support, status movement available in the Idea Detail drawer (full-width sheet on narrow viewports)
- A `/ideas/{ideaId}` or `?idea={ideaId}` deep link opens the target list/board with the idea's drawer open; an inaccessible id shows a not-found/permission notice without a drawer

## VISUAL DESIGN DIRECTION (Selected 2026-08-06 — supersedes Comp A)

Comp C "Fluent Editorial" (`SPEC/mockups/comp-c-fluent-editorial.html`) is the selected UI/UX layout direction for all client pages, per `CLAUDE.md`. Comp A "Command Center" (`SPEC/mockups/comp-a-command-center.html`) and Comp B "Board First" are retained for history only and are not implementation targets.

Page-level layout for Comp C is being locked incrementally via throwaway review comps in `SPEC/mockups/comp-c-review-*.html` (see `SPEC/implementation-agent-tracker.md`). **Locked as of 2026-08-07:** `comp-c-review-06-lockin-v5-final.html` is the chosen direction for Sign in, Home, Settings (Orgs/Users lists), Board List, Swim Lanes, and Idea Detail. `comp-c-review-01`, `-02`, `-04`, and `-05` remain the reference for detailed CRUD states v5 doesn't repeat (new/edit/detail/CSV-import forms, status color picker, sign-in edge cases). **Locked 2026-08-10:** `comp-c-review-09-detail-surfaces.html` replaces the full-page Idea Detail with a right slide-in **drawer** (detail + inline edit) plus a centered **create modal**, across all idea entry points — see "Idea Detail Surface" above; this supersedes the idea-detail portions of `-04` and the full-page treatment in `-06`. The `/ideas` list layout is `comp-c-review-07-ideas-list.html`. Still open: the broader mobile pass for the icon rail and other pages. See `CLAUDE.md`'s "Target Architecture" section for the current summary.

### Board-Specific Reference (superseded 2026-08-07)
The workspace artifact `mockups/sprint-management/idea-board.html` was the layout and styling authority for `/board/{boardId}` under the earlier Comp A direction. It has been superseded by `comp-c-review-06-lockin-v5-final.html`'s locked Board List and Swim Lanes screens (see Layout below); treat this subsection as historical only.

### Layout (Comp C — Fluent Editorial)
- App shell: see NAVIGATION above for the locked shell structure — a 64px icon rail (Home, Boards, Ideas, Settings, bottom avatar popover for Sign Out/Profile), no horizontal top menu, no separate header bar.
- Content pages use breadcrumbs, a page title with short subtitle, and a command bar (primary action, filters) above dense data tables or cards.
- Home is a dashboard — content scope is locked to the richer dashboard (welcome + counts + board tiles + activity feed) per `SPEC/20-feature-client-ui-revisions.md` Decision D4 (supersedes D1), matching `comp-c-review-06-lockin-v5-final.html`'s `Home` screen.
- Settings hub (formerly "Admin hub") uses link cards per tool (Organizations, Users, Boards & Statuses) scoped per role, per `SPEC/20-feature-client-ui-revisions.md`.
- Board view offers both a List view (grouped rows by status, Swim Lane default per `comp-c-review-03-board-list.html`) and a Swim Lanes Kanban view, both locked in `comp-c-review-06-lockin-v5-final.html`. Swimlane cards use the **Flat** treatment (pale lane background, priority-colored chip, left-border status accent per card, small status dot in the lane header) — Banded and Tinted alternatives were considered and dropped. List rows and Swim Lane cards share one status-color visual system; priority is a separate red/amber/green dot/chip in both views, not borrowed from the lane's status color. Clicking a card title opens the Idea Detail **drawer** — a right slide-in overlay over the current board/list (see Idea Detail Surface below).
- Idea detail is a right slide-in **drawer** overlay, not a full page (revised 2026-08-10, superseding the earlier full-page / "not an overlay" decision). Full specification in **Idea Detail Surface** below. The drawer opens over whatever list or board the user is on and carries full idea-detail parity; the standalone full-page `/ideas/{ideaId}/edit` route is retired in favor of the addressable `/ideas/{ideaId}` (and `?idea={ideaId}` over lists/boards).
- Auth screens (login, first-login password change) are centered cards using Comp C's warm neutral palette, locked via `comp-c-review-06-lockin-v5-final.html`'s Sign in screen (general edge-case detail remains in `comp-c-review-01-login-and-auth.html`).
- Implement with Fluent UI Blazor components per `SPEC/mockups/README.md` implementation notes (providers, dialog/toast services, no manual asset tags).

### Idea Detail Surface — slide-in drawer + create modal (locked 2026-08-10)

Reference comp: `SPEC/mockups/comp-c-review-09-detail-surfaces.html` (the **Right slide-in** pattern; the comp's "Form layover" toggle is the create modal). This supersedes the earlier full-page Idea Detail (`/ideas/{ideaId}/edit`, now retired) across every idea entry point.

**Surfaces.**
- **Detail + edit → right slide-in drawer.** Clicking an idea title/Details from the Ideas list, a Board List row, or a Swim Lane card opens a right drawer (≈620px on desktop) that overlays the current list/board behind a dim backdrop. The originating row/card shows a selected state. The drawer opens in a read view (eyebrow `IDEA-{n} · {status}`, title, meta, status chip, description, a facts grid, and the Discussion/comments thread) with an **Edit idea** action. Edit swaps the drawer body in place to the edit form and reveals a Cancel / Save changes footer; Cancel returns to the read view, Save persists and returns to the read view. Close (×, backdrop click, or Esc) drops the drawer and returns focus to the opener.
- **Create → right slide-in drawer.** **+ New idea** (Ideas list and board header) opens the create form in the same right slide-in drawer (≈620px) used for detail and edit, over a dimmed list. On success the drawer closes and the new row/card appears in place — no detail drawer auto-opens. Cancel/backdrop/Esc dismisses without saving.

    > **Changed 2026-08-17 (user decision): idea create is a drawer, not a centered modal.** This completes the 2026-08-14 admin-create reversal by taking the option that note itself named — *"change Ideas too rather than reverting these"* — so every list/detail surface in the product now creates, reads and edits through one right-edge drawer. Idea **edit** already used the drawer and is unaffected. `CreateModalShell` is no longer used by any create surface; it remains only as the chat chrome for `IdeaBrainstormModal`.

**Full parity in the drawer.** The drawer is the complete idea experience, not a preview: title, priority, Idea Type, Business Impact, optional due date, description (when authorized), 0–5 assignees, 0–10 tags, mentions, comments, upvote, status move (**Move in Board** / status selector), and the admin-only **Delete Idea** (confirmation; on success removes the card and closes the drawer). The card comment action opens the drawer with comments scrolled into view and the composer focused (comments heading if commenting is unavailable).

**URL / deep-linking.** Drawer open state lives in the URL as a query param on the current route: `/ideas?idea={ideaId}` over the Ideas list, `/board/{boardId}?idea={ideaId}` over a board. Closing the drawer drops the param and leaves the underlying page unchanged (back/forward navigate drawer open/closed). A bare `/ideas/{ideaId}` link resolves to the Ideas list with that idea's drawer open, so shared idea links, notification links, and mention links keep working; the retired `/ideas/{ideaId}/edit` route is not preserved. An `idea` id the viewer can't access (wrong org, soft-deleted, missing) opens the underlying list/board with a not-found/permission notice and no drawer.

**Live re-slot behind the drawer.** Changing status from the drawer immediately moves the card to the mapped swimlane/row behind the open drawer without closing it; a failed update restores the prior status and shows an error.

**Responsive.** Below the narrow breakpoint the drawer becomes a full-width sheet — for create as well as detail/edit, since 2026-08-17 they are the same surface; the icon rail collapses to the bottom bar. This is the first locked narrow-viewport treatment for these surfaces; the broader mobile pass for the rail and other pages remains open.

### Admin entities use the same List + Drawer pattern (canonical, 2026-08-10)

The Idea Detail Surface pattern above is **canonical for the admin management entities too** — Organizations, Users, Statuses, Idea Types, and Custom Fields (Field Definitions). Each admin list page opens **detail + inline edit in a right slide-in drawer** (a row's **Details** action; a read view with an **Edit** toggle → inline form + pinned Cancel/Save footer) and **create in a right slide-in drawer as well** (the **Add New** button), replacing the earlier full-page-form / inline-edit-card patterns.

> **Changed 2026-08-14 (user decision): admin create is a drawer, not a centered modal.** This reverses the create half of the 2026-08-10 lock for these five entities only. One surface now serves create, detail and edit on every admin list page, so "the form" is always the same object arriving from the same edge. Delete/archive lives inside the drawer.

> **Superseded 2026-08-17.** This note originally kept the Ideas create surface a centered modal, on the reasoning that a right-edge drawer would fight the board's own layout, and offered the escape hatch *"change Ideas too rather than reverting these."* That is what happened — see "Create → right slide-in drawer" above. The board-header reasoning did not survive contact with the built page. Dismissal (×, backdrop, Esc) is blocked while a save/create/delete is in flight.

Implementation: the drawer and modal chrome are the shared, presentation-only `Components/DrawerShell.razor` and `Components/CreateModalShell.razor` (extracted from the Ideas surface). Since 2026-08-14 the five admin entities render **both** create and detail/edit through `DrawerShell`, and since 2026-08-17 the Ideas create surface does too; `CreateModalShell` is no longer used by any create surface and survives only as the chat chrome for `IdeaBrainstormModal`. Per-entity content and validation stay in each page; entity-specific rules are preserved (e.g. Statuses' two-active floor and color picker, Idea Types' one-active-type floor and badge/field pickers, Custom Fields' type-immutable-on-edit and managed option list, Users' reset-temporary-password, Organizations' invite-code/logo/archive). Manual reorder (Statuses/Idea Types/Custom Fields) stays on the list rows, gated to the unfiltered single-page non-SiteAdmin view. The SiteAdmin cross-org "All …" views remain read-only with per-org Manage links (no drawer/create). The retired full-page routes are `/settings/organizations/new`, `/settings/users/new`, and the per-entity full-page edit routes; Organizations additionally makes its drawer URL-addressable at `/settings/organizations/{id}` (parallel to `/ideas/{id}`), while the other admin drawers use in-page open/close.

### Settings → API (added 2026-08-16)

A read-only page at `/settings/api` showing AI assist token consumption, reached from the Settings hub. It is the same page for two audiences, switching on role exactly as the admin list pages do for the Site-Admin cross-org views:

- **Site Admin** — one row per organization, ordered by consumption, with a totals row and the current UTC day's usage against the configured daily ceiling.
- **Org Admin** — their own organization only, with no ceiling shown; the cap is platform-wide and not an organization's business.

Follows the standard list-page chrome: one command row (Back, then filters), full-width card, no create action. There is no drawer — nothing here is editable. Behavior and the endpoints behind it: `20-feature-ai-idea-assist.md` rules 28c–28e and `30-Contracts.md` → "AI Idea Assist Contracts".

This is deliberately **not** a reporting subsystem. It exists because the AI assist feature spends real money against a shared key and that spend must be attributable. If a general reporting section is ever built, this page's data belongs in it.

### Session, Profile, Controls, and Icons (locked 2026-08-08)
- My Profile contains an editable first/last-name section and a voluntary password-change section; email and role are read-only. A successful name update refreshes shell identity immediately.
- Successful required and voluntary password changes clear client authentication and return to Login with confirmation. Re-login lands on Dashboard unless a separate normal return URL applies.
- After 28 minutes without activity, an accessible Fluent dialog shows a live two-minute countdown with Stay signed in and Sign out actions. Staying signed in resets browser inactivity only; idle or absolute expiry returns to Login with the specific session-expired message.
- Native and Fluent text-like inputs and selects use stable 36px geometry with vertically centered single-line content. Textareas retain content-sized height and independent padding.
- Navigation and action glyphs use Fluent System Icons rather than emoji or Unicode characters. Icon-only buttons have stable dimensions, accessible names, hover tooltips, visible keyboard focus, and correct disabled behavior; decorative icons adjacent to visible text are hidden from assistive technology.
- Session timing, cross-tab behavior, password redirects, control geometry, and icon accessibility require user manual acceptance on desktop and narrow layouts until the parallel browser-automation work is integrated.

### Typography

**Single family: Geist, falling back to `sans-serif`.** Declared once as the `--font-sans` token in `src/Collega.Client/wwwroot/css/app.css`; every rule in the global stylesheet and in the page/component stylesheets refers to that token rather than repeating a stack, so the family changes in one place.

Self-hosted from `wwwroot/fonts/geist-latin-variable.woff2` — a 29 KB latin-subset variable font whose weight axis spans 400–700, so one file serves every weight. Provenance and licence: `wwwroot/fonts/README.md`.

**One deliberate exception:** the `.code` rule keeps `ui-monospace, Consolas, monospace`. Invite codes and identifiers depend on fixed-width alignment, and a proportional face breaks the thing that rule exists for.

> **Changed 2026-08-12 by user decision, superseding the original Comp C pairing.** This previously specified `"Segoe UI", -apple-system, Roboto, sans-serif` for body with `Georgia, "Times New Roman", serif` for headings and display text. That serif/sans contrast was the visual argument behind the name "Fluent Editorial" — with a single family it no longer exists, so the direction now reads as editorial through its layout, spacing and restraint rather than its typeface pairing. The reference comps under `SPEC/mockups/comp-c-*.html` still show the old Georgia headings and have **not** been re-rendered; where a comp and this section disagree on type, this section wins.

### Color palette (from `SPEC/mockups/comp-c-fluent-editorial.html`)
- Ink/neutrals: text `#242424`, secondary `#484644`, muted `#797672`.
- Surfaces: background `#faf9f8`, cards/surface `#ffffff`, borders `#e4e2df`.
- Brand/accent (indigo, not Comp A's blue): accent `#5b5fc7`, deep accent `#444791`, soft accent fill `#eef0fb`.
- Semantic: success `#0e700e`, warning `#9a5b00`, error `#b10e1c`.

## ERROR DISPLAY

- Frontend error surfaces must show the full underlying error message in Development.
- Frontend error surfaces must show a generic user-safe message in Production.
- The same UI should remain available in both modes, but the content should differ based on the runtime environment.