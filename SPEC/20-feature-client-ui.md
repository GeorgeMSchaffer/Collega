> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** the client's navigation, screens, list/detail pattern, controls, palette and themes (comp P
>   structure, comp R list/detail, forms, tags, themes); Blazor surfaces are kept only as superseded.
> - **Key rules:** denied shows disabled with a reason (row actions hidden); the drawer overlays, never
>   modal; Site Admin mutates org content only via View As; tag text computed to 4.5:1 in every theme;
>   no keyboard shortcuts; colour never alone; Graphite (dark) the default, Terrazzo the bare `:root`,
>   per-browser cookie.
> - **Contracts:** contracts/boards.md, contracts/ideas.md, contracts/tags.md, contracts/auth.md
> - **Decisions:** 2026-10-04 "Graphite is the default theme"; 2026-09-27 "One list and detail pattern, and a drawer instead of the docked inspector";
>   2026-09-28 "Graphite replaces Notte as the dark theme"; 2026-09-27 "Terrazzo is the palette, with a
>   theme picker"

## SCOPE OF THIS SPEC (reconciled 2026-09-03)

- Describes the client as **comp P** specifies it: the canonical UI direction (`SPEC/decisions.md`,
  2026-08-31 lock and 2026-09-03 canonical ruling) and the target of the TypeScript conversion
  (`SPEC/50-typescript-migration.md`, Wave E).
- Reference: the four generated files `SPEC/mockups/comp-p-{focus-roadmap,auth,admin,delivery}.html`,
  built from `SPEC/mockups/_build/`, at four roles and four states each.
- **The Blazor client never implemented this direction.** It implemented the superseded Comp C
  shell (icon rail + right slide-in drawers) and was deleted in slice F6 (2026-09-13); `apps/web` is
  the client.
- Surface-neutral rules (what a card shows, how a move is saved, who may do what) bind both clients.
  Rules that name a surface (sidebar, the drawer (the docked inspector until 2026-09-27), inline
  create) bind the comp P build; the Blazor equivalent is recorded once, as history, under
  **Superseded surfaces** at the end.

## NAVIGATION

**Sidebar.** A **fixed left sidebar** (248px) on every signed-in screen, grouped:
- **Workspace** — Home, Boards, Ideas.
- **Delivery** — Sprint board, Backlog, Roadmap (specified in `20-feature-issues-and-delivery.md`;
  *reconciled 2026-09-28:* the Sprint board and Backlog are built on the Slice 1 API, and the Sprint
  board and Roadmap follow comp R from 2026-09-28 — see that spec's "Client UI"; *superseded
  2026-09-28, as written before:* "specified in `20-feature-issues-and-delivery.md`, unbuilt; the comp
  renders them under a *not built* strip").
- **Configure** — Settings.
- Above the groups: the brand mark, the organization line (the viewer's organization, or *All
  organizations* for a Site Admin) and the command-palette launcher (`Ctrl K`).
- Pinned to the bottom: the identity block (avatar, name and role) — during a View As session, the
  impersonated user's, not the administrator's (view-as rule 23).
- The active item exposes `aria-current="page"`, a soft ground and a 3px primary rule on its left
  edge, and keeps a visible keyboard focus outline. Tabs, segmented controls, filter chips and the
  like keep their own selected styles.

**Top bar and work column.** Every screen has a **top bar** — breadcrumb on the left, page actions on
the right (*View as…* for Site and Org Admins, the page's primary action) — and one scrolling **work
column** below it. No separate header bar, no horizontal menu.

Routes (unchanged):

- `/` Home — answers *what needs me now*, not *what exists*: KPI row, attention queue, activity feed, all filtered queries the viewer can open. A Site Admin, who has no "me" inside any organization, gets the one roll-up: organizations, boards, ideas and users across the platform.
- `/boards` — list of boards the user can access; opening a board goes to its swimlane view
- `/board/{boardId}` — board detail, ideas in swimlane columns mapped to the board's statuses
- `/ideas` — the organization-wide idea list and search surface; it does not duplicate a board route
- `/settings` — Settings hub with My Profile and role-scoped admin links
  - `/settings/profile` — edit first and last name and change the password; email and role read-only
  - `/settings/organizations`, `/settings/organizations/{orgId}/users`, `…/statuses`, `…/idea-types`, `…/fields`, `…/boards` — organization administration (the full 23-route set is rendered in `comp-p-admin.html`)
  - `/settings/tags` — **Settings → Tags** (added 2026-09-28): the organization's tags on the list and detail pattern, with each tag's colour (`20-feature-ideas-and-engagement.md` "Tags", rules 9–15). An Org Admin's link card on the Settings hub, and **Org Admins only** (answered 2026-09-28): a Site Admin gets the read-only roll-up the other admin entities have; members and Read Only accounts neither see the card nor may open the route (the refusal panel, per the Denied rule). Comp R's *Tags* item in the sidebar under Configure is a prototype convenience (its Settings item is disabled), not a navigation change.
- Compatibility redirects: `/board` → `/boards`; `/workflow` and `/workflows` → `/boards`; `/workflow/{boardId}` → `/board/{boardId}`

**Site Admin is global.** It never requires an organization membership or `organizationId` claim to
browse platform data. Home, Boards, Ideas, Users, Statuses and User-Defined Fields aggregate records
from every organization and display the owning organization where needed.

**Site Admin org-content mutation model (decided 2026-08-11).**
- Site Admin does **not** get direct create/edit/delete paths for organization-owned content —
  boards, statuses, idea types/business impacts, custom fields, ideas, comments, upvotes, delivery.
  No org picker on any create or edit surface.
- It uses **View As** (`20-feature-view-as.md`) to act as a user in the target organization;
  mutations happen under that identity with dual-attribution audit.
- **Bootstrap exception:** organization and user administration stay direct — creating
  organizations, managing users in any organization, user CSV import and invite-code regeneration —
  because a new organization has nobody to impersonate yet.

**Denied is shown, not hidden (2026-09-02).**
- A control the viewer's role cannot use renders **disabled with a reason** — `aria-disabled="true"`
  and `aria-describedby` pointing at the reason, never the `disabled` attribute — so keyboard and
  screen-reader users meet both the control and the explanation.
- A route the viewer may not open at all renders a short refusal panel (title, who the route is for,
  a way back), not the live page with every control disabled.
- Exceptions that stay hidden: the View As entry control (view-as rule 9: hidden *and* refused);
  admin links a member has no business seeing on the Settings hub; and, **since 2026-09-27, per-row
  actions in a list** (Edit, Delete, Archive in the Actions column or on a card) when the role may not
  take them — a column of disabled icons is noise, and the page-level action still announces the
  capability, disabled with its reason (for example *Add New Board* for a member).

**Expired session.** When an authenticated API request returns `401` because the persisted token is
expired or its security stamp is no longer valid, the client clears the persisted session and returns
to Login with the expired-session message instead of leaving the page in an error state.

## `/boards` — Boards

Every board the viewer can access; choosing one opens its lanes. No **New idea** here, because an idea
is always raised against a board.

**Header and actions (2026-09-27).**
- Follows the list and detail pattern (below). The header carries the single **Add New Board**, an
  Org Admin's; every other role sees it disabled with the reason (*Administrators only*; a Site
  Admin, *Act as an organization administrator*).
- That replaced, the same day, the topbar's **Manage boards** (to Settings → Boards) and **New board**
  pair and each board's **Edit** link to Settings → Boards → Edit; editing now opens the board form in
  the drawer.
- Filters, sorting and paging follow the pattern; boards are few enough to page in the client.
- Boards are **archived, not deleted** (`30-Contracts.md` archive endpoints): an archived board
  leaves the list unless the Status filter includes *Archived*, and its ideas stay in Ideas.
- **Removing a lane that holds ideas asks first** (2026-09-29, `20-feature-boards-and-statuses.md`
  rule 14). Saving the board form — the drawer here, or Settings → Boards → Edit — with a lane removed
  that still holds live ideas opens the confirm dialog: a line per such lane with its count (*3 ideas
  are in In Review. Move them to:*) and a lane picker defaulting to the board's first remaining lane,
  then *Move ideas and save*. Cancel returns to the form unsaved. Removing only empty lanes saves
  without asking.

**Views.** A **List / Cards** control switches two views of the same facts: **List** (default since
2026-09-27; it was Cards), one table row per board, for comparing many; **Cards**, a responsive grid.
The view is a URL, not stored state, so a link opens the view it names. Counts are the board's live
Discovery ideas, the same set the board itself shows.

**List columns** (reconciled 2026-09-27; this is the one column list):

- **Board** — the name, with a one-line description beneath (or *No description yet*).
- **Ideas by lane** — the **lane mix** strip, kept from slice 096: one bar split by lane in the
  board's lane order and status colours, empty lanes dimmed rather than dropped, with first-lane /
  in-between / last-lane figures.
- **Top tags** — the most-used tags, two then *+N*.
- **Created** — who created the board and when.
- **Status** — *Active* or *Archived*.
- **Actions** — **View**, **Edit** and **Archive** (*Unarchive* on an archived row); Edit and
  Archive are an Org Admin's and hidden for other roles (the Denied rule's row-action exception).

**Cards** carry the same facts: the description (two lines at most), the lane mix with a count per
lane, the most-used tags (three, then *+N*), who created it and when, its idea and lane totals, its
status, and the same action icons.

## `/board/{boardId}` — Kanban Board

Route: `/board/{boardId}`. Ideas are cards in swimlane columns; each column is one `Status` from the
selected board.

### Board Header
- The top bar carries: the breadcrumb (*Boards / {board name}*); the **List / Lanes** view switch; the
  **Board** picker (only when the user can reach more than one board); **Export CSV** (any member,
  Read Only included — the CSV is a read); **Import CSV** (members and Org Admins; a Site Admin sees it
  disabled with *Idea import goes through View As*); **Edit board** (Org Admin; disabled with the
  reason for every other role, 2026-09-27); and the primary **New idea**.
- **New idea** opens the brainstorm chat when AI assist is available and the create form otherwise —
  in the drawer since 2026-09-27, the docked create column before (`20-feature-ai-idea-assist.md`
  rules 32a–32c) — pre-populating the target status as the left-most column. Disabled with a reason
  for Read Only and Site Admin.
- The page title line states the keyboard equivalent for drag — *Move a card with drag, or focus it
  and press ← →* — and, for roles that cannot move cards, says so instead.
- A labelled search input (*Search title, tag, assignee…*) with a Clear button sits above the rail.

### Swimlane Columns
- One column per `Status` on the selected board, ordered by `Status.SortOrder` ascending.
- Column header shows the status name, a colour dot (`Status.Color`) with the name beside it, and the idea count.
- Columns are **fixed-width (288px) in a horizontally scrolling rail**, each with its own ground (`decisions.md` 2026-09-02). The rail scrolls; the page never does. Empty columns stay visible with a *No ideas* placeholder.
- Each column ends with a *+ Add idea* affordance for roles that may create.

### Idea Cards
- **Compact card:** title (clickable, 2-line truncation), a priority **marker** (dot plus the word),
  the **idea type written as text** (never a colour-only dot), assigned-user personas, and the upvote
  control with its count. Business Impact, tags, submission age and comment count are shown in the
  drawer and may be shown on the card where space allows.
- **Drag:** a dedicated drag handle starts card movement; interactive controls never start a drag.
- **Open:** clicking the card title opens the **drawer** in view mode (drawer since 2026-09-27; it was
  the docked inspector — see "List and detail pattern" below) — the same surface reached from the
  Ideas list.
- **Tags:** selected and created through a searchable multi-value Tag field in Idea Detail. Anyone
  authorized to edit the idea can create a reusable organization-scoped tag inline. Names are trimmed
  and matched case-insensitively. Cards display the first three tags alphabetically and a `+N`
  indicator for the remainder; the complete list is in Idea Detail and in accessible text or a
  keyboard-accessible tooltip.
- **Assignees:** an optional searchable multi-select of active users from the idea's organization;
  at most five distinct users. Inactive users already assigned remain visible but cannot be newly
  selected. Cards order assignees by first name then last name and show the first three personas
  then `+N`. A persona is a circular avatar with the first-name and last-name initials, followed by
  the first name. Full names are in Idea Detail and in accessible text or a keyboard-accessible
  tooltip. If one name part is unexpectedly absent, use the available initial and first available
  display label; if both are absent, render `?` with accessible label `Unknown user`.
- **Submission age:** viewer-local calendar-day difference between `createdAtUtc` and today:
  `0 days ago`, `1 day ago`, or `{N} days ago`. Future values clamp to `0 days ago`.
- **Upvote:** unfilled when inactive, filled (primary outline) when the current user has upvoted; a
  live button for Org Admins, members and Read Only accounts, a static count for a Site Admin (whose
  vote is cast through View As). Icon and count toggle optimistically and restore on failure.
- **Add Comment:** opens the drawer's view, scrolls comments into view and focuses the comment
  composer; if commenting is unavailable, focuses the comments heading.

### Filter Chips
Above the board: **All**, **Created by me** (`AuthorUserId ==
currentUserId`), **Assigned to me** (the current user is in the idea's assignee collection).
Client-side. Empty columns remain visible with a *No ideas* placeholder.

### Search
Text input above the board filters cards by title, tag, or assignee (client-side, case-insensitive).
Combinable with filter chips.

### Drag-and-Drop: Moving an Idea
1. User drags a card by its dedicated handle to another column on desktop.
2. Optimistic UI moves the card immediately.
3. Calls `POST /api/v1/ideas/{ideaId}/status` with the target status ID. The idea's status is set to the target swimlane's `Status`.
4. On failure: card reverts, error toast shown.
5. Board `allowUserStatusUpdate` and role restrictions are enforced server-side (403 → revert + permission message).

### Drag-and-Drop: Reordering Columns
1. An Org Admin — and a Site Admin only while acting through View As — can drag column headers to reorder columns. *Corrected 2026-09-29 (`SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved"): this said SiteAdmin and OrgAdmin users.*
2. Optimistic reorder applied immediately.
3. Calls `POST /api/v1/boards/{boardId}/swimlanes/reorder` once, naming every swimlane on the board with its new `order` (`contracts/boards.md`). Saves immediately on drop — no additional confirmation. *Corrected 2026-09-29 (`SPEC/decisions.md` 2026-09-29, "Spec contradictions resolved"): this said one `PUT /api/v1/boards/{boardId}/statuses/{statusId}` per moved column, a route that does not exist.*
4. On failure: revert all columns, show error toast.
5. User and ReadOnly roles see columns but cannot reorder them.
6. Changing status in the drawer (drawer since 2026-09-27) uses the same move operation and immediately updates the idea's status; the card re-slots into the matching swimlane behind the open drawer (no navigation away).
7. Keyboard and touch users move ideas with the drawer's status selector, or with ← → on a focused card; touch drag is deferred.

### DnD Technology
HTML5 drag-and-drop (desktop only) with a dedicated handle and visible drop targets. Touch/mobile drag
is deferred; the mobile view scrolls and status movement stays available through Idea Detail.

### Acceptance Criteria
- `/boards` shows the board list and `/board/{boardId}` shows the selected board's Kanban view
- `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}` redirect to canonical Board routes
- No user-facing UI displays Workflow or Workflows terminology
- Columns reflect the selected board's statuses in `SortOrder` order, at a fixed width in a scrolling rail
- Filter chips and title/tag/assignee search work across all columns (client-side)
- Card drag starts only from the dedicated handle, sets the idea status to the target swimlane's status, and reverts on failure with a toast
- Column drag (SiteAdmin/OrgAdmin only) saves immediately on drop; reverts on failure
- Clicking a card title opens the drawer in view mode over the board (URL gains `?idea={ideaId}`)
- The drawer provides Edit / Cancel / Save, Move in Board, and authorized soft-delete actions
- Changing status in the drawer immediately updates the idea's status and re-slots the card in the matching swimlane
- Cards display idea type as text, priority as a labelled marker, current-user upvote state/count
- Idea Detail provides a searchable Tag multi-select that selects existing organization tags and creates normalized reusable tags inline for authorized editors, with at most 10 tags per idea
- Idea Detail provides an optional searchable Assignees multi-select containing active users from the idea's organization, with at most five distinct assignees and historical inactive-assignee display
- Cards display the first three tags alphabetically and first three assignee personas by first/last name, with `+N` overflow and complete accessible values
- Each persona shows first-name/last-name initials followed by first name, with an accessible missing-name fallback
- Cards display viewer-local calendar-day submission age with zero, singular, plural, and future-timestamp behavior
- Clicking the card comment action opens the drawer's view with comments in view and the composer focused
- Upvote toggles optimistically and rolls back on failure
- New idea in the board header opens the brainstorm chat or the create form (in the drawer); disabled with a reason for Read Only and Site Admin
- The page header states the keyboard path for moving a card
- Mobile/touch: scrollable view, no drag support, status movement available in Idea Detail (the drawer goes full width below 900px)
- A `/ideas/{ideaId}` or `?idea={ideaId}` deep link opens the target list/board with the idea's drawer open in view mode; an inaccessible id shows a not-found/permission notice without a drawer

## VISUAL DESIGN DIRECTION — comp P (locked 2026-08-31, canonical 2026-09-03)

- `SPEC/mockups/comp-p-focus-roadmap.html` and its three siblings are the canonical comp.
- **Layout, information architecture and copy model are locked.** Its **palette is not locked** and
  its type family is open alongside it (see below).
- The reference is the generated set, at four roles and four states per screen; sources are
  `SPEC/mockups/_build/`, and `SPEC/mockups/README.md` describes what each parent contributed.

### Layout (comp P — Focus Desk)
- **App shell**: the fixed left sidebar with grouped nav, the top bar with breadcrumb and page actions, and one scrolling work column — see NAVIGATION.
- **Content pages**: breadcrumb in the top bar, a large page title (`h1`, 40px) with a one-line standfirst saying what the page shows and how it is ordered, then a command row of labelled filters where the page has any, then a card or table.
- **Home** answers *what needs me now*: a dismissible first-run strip, a KPI row where every tile carries a one-line definition of what it counts, a *Needs your attention* queue whose standfirst states its ordering (oldest first), and a *Recent activity* feed scoped to what the viewer can see. Every number is a filtered query the viewer can open. (Supersedes `20-feature-client-ui-revisions.md` Decision D4's tile grid; the counts carry forward, the *Request a new board* tile does not.)
- **Settings hub** is a role map, not a menu: link cards per tool, a different set per role, a member seeing only Profile.
- **Board** offers List and Lanes; Lanes is the rail described above. **Single visual encoding**: type, status and priority all use one **marker** — an 8px dot with its label always beside it. No column or chip family shouts louder than another.
- **Two copy voices, kept apart**: product copy lives inside the app frame and is written to ship; anything addressed to a reviewer lives in the chrome band outside it (`decisions.md` 2026-08-31).
- **Auth screens** are a two-column split: a pitch band on the left, the form on the right. The band sits on the
  theme's sidebar ground, never the primary colour, with the primary kept for the mark and the checks; Sign in
  also shows a schematic board of lanes in status hues (2026-10-04, `decisions.md` "The sign-in pitch shows the
  product, not the primary colour"; comp `SPEC/mockups/comp-login-alternatives.html`, option C). Login, Register and the forced first-login change carry no sidebar; the forced change deliberately has no navigation escape (auth rule 32a).

### List and detail pattern (comp R — 2026-09-27)

`SPEC/mockups/comp-r-portico-prototype.html` is the reference rendering. It **supersedes the next
section for detail, edit and create** on Boards, a board, and Ideas, and is the pattern every other
list screen (Settings entities, Delivery lists) moves to as it is touched.

- **Page header:** H1 and its one-line description on the left; the one creation action on the
  right, vertically centred on that block, worded **Add New {Item}** in title case (*Add New Idea*,
  *Add New Board*). A role that may not create sees it disabled with the reason.
- **Toolbar:** a text filter matching every displayed column (on Ideas: title, board, status,
  priority, tags, people; plus Problem), then a multi-select filter with type-to-find for each
  finite-valued column (Board, Status, Priority, Tags; Boards: Status Active/Archived, defaulting to
  Active), then the view switch on the right.
- **Views:** **List** is the default everywhere except a board's own page, where **Lanes** is the
  default and **List** the alternative. Ideas and Boards also offer **Cards**. Filters, sorting and
  paging apply identically to every view of a screen (paging to List and Cards; Lanes shows all
  filtered cards).
- **Sorting:** every displayed column sorts; a header click cycles ascending → descending → off,
  with `aria-sort` on the active header.
- **Paging:** 10 per page by default, with 25, 50 and 100; the pager states *{from}–{to} of {total}*.
  Server-side for ideas (`30-Contracts.md` list pattern); boards are few enough to page in the client.
- **Actions column** at the right of every list row, and the same icons on each card: **View** (eye)
  opens the detail; **Edit** (pencil) opens the form; **Delete** (trash) — or **Archive** for boards —
  asks for confirmation first. Edit and Delete/Archive are hidden when the role may not use them (the
  Denied rule's row-action exception).
- **The drawer** replaces the docked inspector:
  - slides in from the right and **overlays** the page (`clamp(380px, 28vw, 520px)`; full width
    below 900px), so the list or board underneath never resizes or gains a scrollbar;
  - not modal: no scrim, no focus trap; focus moves to its heading on open and returns to the
    trigger on close; Escape and × close it;
  - the inspector's URL rules carry over: `?idea={ideaId}` and `/ideas/{ideaId}` deep links open it
    in view mode, and the card's comment action opens it with comments in view and the composer
    focused;
  - modes: **view** (facts, structured sections, custom fields, and the discussion the inspector
    carried — the upvote control, the comment thread and the comment composer; comp R omits it and
    this spec wins — with Edit / Delete in the footer), **edit** (the form in place, Save / Cancel),
    and **create** — which for ideas opens **wide** with the idea assistant beside the form
    (`20-feature-ai-idea-assist-v2.md` "Surface").
- **Confirmation** for Delete and Archive is the one destructive modal: `role="alertdialog"`,
  focus trapped between Cancel (focused first) and the action, Escape cancels.
- **Lanes** are quiet full-height columns (a soft tint and hairline border per lane) with the
  status-tinted header, so a board reads as swimlanes rather than loose cards.
- **Also on the pattern since 2026-09-28:** Settings → Tags (List only, no Cards; rules in
  `20-feature-ideas-and-engagement.md` "Tags") and the Roadmap's outcome drawer
  (`20-feature-issues-and-delivery.md` "Client UI"). The confirmation dialog also serves **Delete
  tag**, **Delete outcome** and **Complete sprint** — the last is not destructive, so its action is
  the primary button rather than the danger one. Comp R deletes an outcome without asking; this spec
  wins and it confirms like every other Delete.

### Forms and controls (comp R — 2026-09-28)

Every form and control is denser, in **every** theme, not only Graphite. Supersedes the *Inputs follow
`DESIGN.md`* line under "Session, Profile, Controls, and Icons" below and the control heights slice 100
shipped (`--control-h` 36px). Values are comp R's "Controls and forms" block; they belong in the shared
geometry tokens in `packages/design-system` (slice 100 put control heights and label size there), so
density stays one edit.

- **Buttons** 32px high, 12px side padding, 13px text; the small size 28px and 12px text. Corner
  radius is the theme's small radius, never a pill.
- **Fields** (input, select, textarea) at least 34px high, 7px × 10px padding, 13px text at 1.45 line
  height, on the theme's **field ground** (`--field`: the card colour in the light themes, a darker
  well than the card in Graphite).
- **Labels** sit above their control, 12px, weight 500, in the secondary ink, 5px above it. A
  required field carries `*` in the destructive text colour, hidden from assistive technology
  (the control's own `required` carries the fact). **Hints** are 12px muted text below the control;
  a **field error** is 12px semibold destructive text below it, with the control's border in the
  destructive colour.
- **Short related fields share a row.** Three to a row for short selects (the idea form's Business
  impact · Idea type · Priority; their labels never wrap), two to a row for pairs (Status or Due
  date; an outcome's Target start · Target end). Every row collapses to one column below 900px.
  Long text, lists, people and tags keep a full row each.
- **Metadata in the mono face.** Issue keys, counts, date windows and the uppercase meta labels of
  the Delivery screens (*STATE*, *WINDOW*, *TODAY*, *OUTCOME*) are set in the theme's mono face
  (`--font-code`) at 10.5–11px with 0.04–0.06em tracking. The idea assistant's *✦ Suggested* marker
  and the required-fields counter in a form's footer use it too; in a three-to-a-row group the
  marker shortens to *✦*.
- **No keyboard shortcuts, anywhere** (answered 2026-09-28: "no keyboard shortcuts for now" covers
  every screen, not only the Roadmap). Comp R's *Ctrl ↵* save, any zoom keys and its `esc` /
  `Ctrl ↵` key-hint chips are not built. Escape still closes the drawer and the dialogs, and Enter
  still submits a form through its native submit control — platform behaviour and rules already in
  this spec, not shortcuts.

### Tag colours and the effort bar (comp R — 2026-09-28)

- **Every tag has a colour** (`20-feature-ideas-and-engagement.md` "Tags") — a palette colour or,
  since an administrator may pick a custom one (answered 2026-09-28), **any** `#RRGGBB`. A tag chip
  mixes that colour with the theme so one stored colour reads in every theme, and **its text must
  clear 4.5:1 against the chip's own ground in every theme, for every colour**.
  - Why computed: comp R's fixed mix (62% tag colour into the ink) does not clear it — measured
    2026-09-28 it gives 3.39–4.45:1 for **seven** of the ten palette colours in every light theme
    (`#F5A524`, `#3FB86B`, `#5CC8E0`, `#6B9BF2`, `#B08CF5`, `#E879A6`, `#94A3B8`; only `#E5484D`,
    `#2F9E8F` and `#A87B2F` pass). So the text colour is **computed**, not fixed:
  - every mix is **per channel in gamma-encoded sRGB**, exactly what CSS `color-mix(in srgb …)`
    computes — not in linear light or OKLCH — so the function and any CSS fallback agree;
  - **ground** — the tag colour mixed 16% into the theme's card colour; **border** — the tag colour
    at 30% over transparent (decorative, no ratio required);
  - **text** — the tag colour mixed into the theme's ink at the theme's starting share (40% in the
    light themes, 62% in Graphite); while the text is under 4.5:1 against the ground (WCAG
    relative luminance), the share steps down by 5 points; at 0% the text is the theme's ink.
  - Measured 2026-09-28 over a 16-step grid of every RGB channel (4,096 colours) in all five themes:
    the rule always stops at or above 4.5:1, within at most four steps, and plain ink is never
    below it. It runs in `packages/design-system` as a pure function (CSS `color-mix` cannot
    branch on contrast), so the server-rendered chip already has its final colours.
  - **The test** asserts, for every theme, the ratio of the computed text against the computed
    ground is ≥ 4.5 for the ten palette colours, for the eight RGB corners (`#000000`, `#FFFFFF`,
    `#FF0000`, `#00FF00`, `#0000FF`, `#FFFF00`, `#00FFFF`, `#FF00FF`) and for mid-greys (`#808080`,
    `#777777`), and that a palette colour in a light theme keeps its 40% share (so the chip still
    reads as its colour where it can).
  - Colour never carries meaning alone — the tag's name is always the chip's text.
- **The effort bar** shows an `effort` (Low, Medium, High) as three short segments (10 × 4px, 2px
  apart): one filled for Low, two for Medium, three for High, in the theme's **metric** colour
  (`--metric`: the primary in the light themes, cyan in Graphite), the unfilled ones in the strong
  hairline colour. The words always sit beside it — *Low effort*, *Medium effort*, *High effort* —
  and the bar itself is hidden from assistive technology. It replaces the coloured effort dot the
  delivery cards carry today. Where it appears: `20-feature-issues-and-delivery.md` "Client UI".

### Surfaces: docked inspector, inline create, one modal

> **Superseded 2026-09-27 for detail, edit and create by the list and detail pattern above**
> (`decisions.md`). Kept because the Settings entities and Delivery screens still follow it until
> they move to the pattern.

- **Detail and edit → the docked inspector.** Clicking an idea title from the Ideas list, a Board row or a lane card opens the inspector as a **third grid column** (404px) beside the list or board, which stays live and scrollable. It is **never a modal**: nothing is covered, no focus trap and no `inert`, and Escape closes the column. The originating row shows a selected state (a 3px primary rule plus a soft ground, both readable in greyscale). It opens in a read view (eyebrow *{board} · #IDEA-{n} · {status}*, title, meta, a facts grid, custom fields with archived values labelled, description, discussion with the upvote control and comment composer) with an **Edit idea** action; edit swaps the body in place and reveals a Cancel / Save footer.
- **Create → the docked column too.** *New idea* and a lane's *+ Add idea* open the create form in the same column, over the board it will add to. On success the card appears in New / Pending and the column closes; Cancel or Escape dismisses without saving. From the brainstorm chat, suggested values carry the teal *Suggested* chip, tinted field and 3px left rule (`20-feature-ai-idea-assist.md` D-SUGGEST); arriving because the assistant was unavailable, the column shows the rule 32c flash.
- **Short forms are inline beside the list they add to** — statuses, idea types, fields, users. Longer edits open the docked inspector. There is no create drawer.
- **The one modal is a conversation or a decision**: the brainstorm chat (720px, `20-feature-ai-idea-assist.md` D-SURFACE), the promote-to-issue gate, the command palette, and the session-expiry dialog. Each is `role="dialog"` with an accessible name; Escape closes it.
- **Admin entities** (Organizations, Users, Statuses, Idea Types, Custom Fields, Boards) follow the same rule: list, inline create beside it, docked inspector for edit. Per-entity rules are preserved (Statuses' two-active floor and swatch picker, Idea Types' one-active-type floor and badge/field pickers, Custom Fields' type-immutable-on-edit and managed option list, Users' reset-temporary-password, Organizations' invite-code/logo/archive). The Site Admin cross-organization *All …* views are read-only roll-ups leading to a per-organization editor that renders read-only with every mutating control disabled and explained (`decisions.md` 2026-09-02).

**URL / deep-linking.**
- Inspector state is a query param on the current route: `/ideas?idea={ideaId}` over the Ideas list,
  `/board/{boardId}?idea={ideaId}` over a board.
- Closing drops the param and leaves the underlying page unchanged (back/forward navigate
  open/closed). A bare `/ideas/{ideaId}` link resolves to the Ideas list with that idea open.
- An `idea` id the viewer can't access opens the underlying list/board with a not-found/permission
  notice and no inspector. Organizations keep their addressable `/settings/organizations/{id}`.

**Full parity in the inspector.** Title, priority, Idea Type (immutable after creation; admin-only
*Reassign…* break-glass), Business Impact, optional due date, description (when authorized), 0–5
assignees, 0–10 tags, custom fields, mentions, comments, upvote, status move, and the admin-only
**Delete idea** with confirmation.

**Responsive.** Below the narrow breakpoint the inspector becomes a full-width sheet and the sidebar
collapses. The broader narrow-viewport pass remains open.

### Settings → API (added 2026-08-16)

- A read-only page at `/settings/api` showing AI assist token consumption, reached from the Settings hub.
- Site Admin: one row per organization, ordered by consumption, with a totals row and the current UTC
  day's usage against the configured daily ceiling. Org Admin: their own organization only, with no
  ceiling shown.
- Standard list chrome, no create action, no inspector. Behaviour and endpoints:
  `20-feature-ai-idea-assist.md` rules 28c–28e.

### Session, Profile, Controls, and Icons
- My Profile contains an editable first/last-name section and a voluntary password-change section; email and role are read-only. A successful name update refreshes shell identity immediately.
- Successful required and voluntary password changes clear client authentication and return to Login with confirmation. Re-login lands on Home unless a separate normal return URL applies.
- After 28 minutes without activity, an accessible modal dialog (`role="alertdialog"`) shows a live two-minute countdown with **Stay signed in** and **Sign out**. Staying signed in resets browser inactivity only; idle or absolute expiry returns to Login with the specific session-expired message (`20-feature-auth.md` #38–#42).
- **Sign Out** is the wording, and it lives in the sidebar identity block's menu, not as a nav item.
- Inputs follow `DESIGN.md`: 4px radius, 6px padding, never pill; the primary button is the one pill. *Superseded 2026-09-28 for geometry by "Forms and controls" above (and for radius since 2026-09-27 by each theme's own radius); no control is a pill.* Every input, select and textarea has a real `<label for>`, `aria-label` or `aria-labelledby`. Every form has a native submit control so Enter submits.
- Icons are inline SVG glyphs (the sidebar's) or none; never emoji or Unicode characters. Icon-only buttons have stable dimensions, accessible names, visible keyboard focus and correct disabled behaviour; decorative icons beside visible text are hidden from assistive technology. Comp P's paths are placeholders; the icon set is an implementation choice within these rules.
- **Colour never carries meaning alone** (`decisions.md` 2026-08-31): every coloured dot, bar or fill has a text label in the same component.

### Implementation: Tailwind CSS + shadcn/ui (decided 2026-09-03)

- Built on **Tailwind CSS v4 and shadcn/ui** (Radix primitives), used as the framework intends:
  semantic colour roles as theme variables, its component set, its defaults for radius, type scale
  and control geometry.
- **Comp Q** (`comp-q-*.html`, built from the same fragments as comp P by `_build/build_q.py`) renders
  every screen as what shadcn/ui emits, and is the visual reference for Wave E; comp P remains the
  source of structure and copy.
- The component map — sidebar → `Sidebar`, breadcrumb → `Breadcrumb`, markers → `Badge`, panels →
  `Card`, filters and forms → `Input`/`Select`/`Label`/`Form`, the palette → `Command`, dialogs →
  `Dialog`, tables → `Table`, loading → `Skeleton`, denials → `Button` with `aria-disabled` plus a
  `Tooltip`/description — is the registry in `build_q.py`.
- The docked inspector is a layout column (a `ResizablePanel`), not a `Sheet`, because it is never a
  modal. *Since 2026-09-27 the drawer replaces it (list and detail pattern above): an overlay that is
  still not modal, so not a `Sheet` with a scrim or a focus trap either.*
- `packages/design-system` in the conversion is the shadcn install plus the theme; nothing is
  hand-rolled that the framework provides.

### Typography

> **Superseded in part 2026-09-27** (`decisions.md`, Terrazzo): **typography is per theme now.**
> Terrazzo uses Schibsted Grotesk for headings and Public Sans for text; the other themes' faces are
> in comp R. Each theme's fonts load from a Google Fonts stylesheet exactly as Geist does today — no
> npm dependency — and the font set is part of the theme. The type scale below is unchanged.

- **Geist**, shadcn/ui's default face and the family the shipped client already uses (user decision
  2026-08-12), declared once as the `--font-sans` theme token; Geist Mono for invite codes and
  identifiers.
- The **type scale is Tailwind's** as shadcn applies it: 14px UI text, page titles `text-2xl
  font-semibold tracking-tight`, card titles `text-base`, captions `text-xs`.
- Comp P's `DESIGN.md` scale (16px body, 40px `h1`) is not carried; comp Q shows the framework scale,
  which also recovers most of the 15% density cost measured on comp P.

### Color palette

> **Decided 2026-09-27: Terrazzo** (Themes below, `decisions.md`). The palette is no longer open;
> what follows records how it was chosen. Rule 2 below is superseded by each theme's own suggestion
> hue.

**Open, expressed as shadcn theme variables.**
- Comp Q carries the 2026-08-31 palette below as `--background`, `--foreground`, `--primary`,
  `--muted`, `--border` and the rest in one `:root` block (`_build/q.css`); changing the palette is
  changing that block.
- Comp P renders the `DESIGN.md` tokens (primary `#0075de`, secondary `#213183`, canvas `#f6f5f4`,
  hairline `#e6e6e6`, near-black ink, and the sticker set sky / purple / pink / orange / teal / green
  for category dots) and proves the structure survives whatever hue set replaces them, because no
  colour in it carries meaning alone.
- The candidate replacement is the business-professional palette the user chose on 2026-08-31 — ink
  `#243447`, background `#F7F9FB`, accent `#527292`, semantic pairs success `#6FAF7A`/`#457C4F`,
  warning `#C9A65C`/`#8A6D2E`, error `#C97A7A`/`#B64B4B`, teal `#5F9E93`/`#4A7972`, 2px radii — which
  the comps A–O were re-rendered to.

Whichever palette is chosen must keep two rules:

- Only a near-black ink is used as body text; chromatic values are fills, chips or dots only, each paired with an `-ink` derived to clear 4.5:1 **against its own soft tint**, not merely against white.
- The `D-SUGGEST` teal (`--sug: #116b5e`) must stay unmistakable against the accent — re-check the suggestion chip, tinted field and left rule whenever the accent changes. *Superseded 2026-09-27: the pinned teal gives way to each theme's `--suggest` / `--suggest-tint` hue, distinct from that theme's accent (Themes below).*

### Themes (2026-09-27)

> **Superseded in part 2026-10-04** (`decisions.md`, "Graphite is the default theme"): the default
> is **Graphite**, not Terrazzo. Terrazzo stays a theme in the picker and the bare `:root`.
>
> **Superseded in part 2026-09-28** (`decisions.md`, "Graphite replaces Notte as the dark theme"):
> the dark theme is **Graphite**, not Notte. The paragraph below is kept as decided on 2026-09-27;
> the Graphite paragraph after it is the current rule.

**Palette decided: Terrazzo** — slate blue `#3D5A80`, pistachio and blush accents, Schibsted
Grotesk for headings and Public Sans for text. It is the default. A **theme picker** at the right
of the top bar offers **Light:** Terrazzo, Portico, Piazza Sera, Lagoon, and **Dark:** Notte. The
choice is remembered **per browser**, in a cookie the server reads so the first render is already in
the chosen theme (answered 2026-09-27: not stored on the user profile). Every theme is the same token
set (`packages/design-system`), so components never name a colour; each theme's pairs are checked to
4.5:1 for text. Token values are in comp R. Rule 1 in "Color palette" above (near-black ink for text;
each `-ink` cleared against its own tint) applies to every theme, read for a dark theme as its
inverse: one near-white neutral ink on the dark ground. Rule 2 is now per theme: each theme defines a
**suggestion hue** (`--suggest`, `--suggest-tint`) distinct from its accent, for fields the idea
assistant filled (`20-feature-ai-idea-assist-v2.md` Q5). Each theme also carries its own fonts
(Typography above).

**Graphite (2026-09-28) — the dark theme, replacing Notte.**
- The picker offers **Light:** Terrazzo, Portico, Piazza Sera, Lagoon, and **Dark:** Graphite.
- **Graphite is the default (2026-10-04).** A browser with no `collega-theme` cookie, or one the
  app does not recognise, is served Graphite; a browser that picked a theme keeps it. Terrazzo
  remains the bare `:root`, so a document with no `data-theme` (a comp, a test page) is Terrazzo.
- A near-black neutral ground (`#0F1113`, cards `#16191C`, fields a darker `#0F1113` well) with
  near-white ink (`#E6E8EA`), an **amber** primary (`#F5A524`, with dark text `#16120A` on it) and
  **cyan** (`#5CC8E0`) as both its suggestion hue and its metric colour, with red, green and amber
  status pairs on dark tints.
- IBM Plex Sans for headings and text, JetBrains Mono for its mono face, an 8px radius (6px small).
  Token values are comp R's `graphite` block.
- Its text pairs were measured on 2026-09-28 and clear 4.5:1 (muted text on a card 6.9:1, amber on a
  card 8.7:1, dark text on amber 9.2:1, each status ink on its tint 7.4:1 or better); the rule above
  binds any later change to them.
- Comp R adds three tokens every theme now defines, defaulting where the theme has no reason to
  differ: **`--metric`** (the effort bar and other quantity marks; defaults to the primary),
  **`--field`** (the input ground; defaults to the card) and **`--suggest-line`** (the border of a
  suggested field; defaults to `--suggest`).
- **Notte is retired.** Its self-contained `[data-theme="notte"]` block (slice 100) is replaced by a
  `graphite` block. A browser whose `collega-theme` cookie still says `notte` is served
  **Graphite**, so a person who chose dark stays in dark. Fonts only Notte used leave the Google
  Fonts stylesheet unless another theme needs them.

## ERROR DISPLAY

- Frontend error surfaces must show the full underlying error message in Development, and a generic user-safe message in Production.
- The same UI remains available in both modes; only the content differs by runtime environment.
- Every list and detail surface has four states — normal, empty, loading (skeletons that hold row height, never a spinner), error (an alert with a safe retry) — and comp P renders all four for every screen.

## SUPERSEDED SURFACES — the shipped Blazor client (Comp C, until cutover)

Kept as history: the Blazor client this describes was deleted in slice F6 (2026-09-13). None of this
is a target for new work.

- **Shell**: a 64px icon rail (Home, Boards, Ideas, Settings) with a bottom avatar popover holding Profile and Sign Out; no header bar. Reference `comp-c-review-06-lockin-v5-final.html`. Sprint 7.5 records the rail's *Log out* wording and placement drift from that lock.
- **Detail, edit and create**: a right slide-in drawer (≈620px, `DrawerShell`) over a dim backdrop for ideas (locked 2026-08-10) and for the five admin entities (2026-08-14), with create moved from a centered modal into the same drawer on 2026-08-17. `CreateModalShell` survives only as the brainstorm chat chrome. Sprint 7.5 records that the drawer never takes focus and Escape is dead.
- **Board cards**: the *Flat* treatment — pale lane background, priority chip, left-border status accent; columns as equal fractions of the width.
- **Components**: Fluent UI Blazor, whose shadow-DOM submit buttons and text fields are two of Sprint 7.5's three systemic accessibility defects. Icons from Fluent System Icons. Native and Fluent text-like controls at a stable 36px.
- **Palette in the Blazor client's stylesheet**: still the indigo/warm-neutral Comp C tokens with 6px/4px radii; never migrated to the 2026-08-31 palette.
- **Home**: the D4 tile grid with an *Activity feed coming soon* placeholder.
