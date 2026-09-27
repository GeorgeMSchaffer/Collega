## SCOPE OF THIS SPEC (reconciled 2026-09-03)

This spec describes the client as **comp P** specifies it — the canonical UI direction
(`SPEC/decisions.md`, 2026-08-31 lock and 2026-09-03 canonical ruling) and the target of
the TypeScript conversion (`SPEC/50-typescript-migration.md`, Wave E). The reference is
the four generated files `SPEC/mockups/comp-p-{focus-roadmap,auth,admin,delivery}.html`,
built from `SPEC/mockups/_build/`, at four roles and four states each.

**The shipped Blazor client does not implement this direction.** It implements the
superseded Comp C shell (icon rail + right slide-in drawers), and it keeps doing so until
cutover — Sprint 7.5 and Sprint 8 land on it as it is. Where a behavioural rule below is
surface-neutral (what a card shows, how a move is saved, who may do what), it binds both.
Where it names a surface (sidebar, the drawer (the docked inspector until 2026-09-27), inline
create), it binds the comp P build; the Blazor equivalent is recorded once under **Superseded surfaces** at the end.

## NAVIGATION

Primary navigation is a **fixed left sidebar** (248px) on every signed-in screen, grouped:
**Workspace** — Home, Boards, Ideas; **Delivery** — Sprint board, Backlog, Roadmap (specified
in `20-feature-issues-and-delivery.md`, unbuilt; the comp renders them under a *not built*
strip); **Configure** — Settings. Above the groups sit the brand mark, the organization line
(the viewer's organization, or *All organizations* for a Site Admin) and the command-palette
launcher (`Ctrl K`). Pinned to the bottom is the identity block: avatar, name and role — and
during a View As session, the impersonated user's, not the administrator's (view-as rule 23).

Every screen has a **top bar** carrying a breadcrumb on the left and the page actions on the
right (*View as…* for Site and Org Admins, the page's primary action), and a single scrolling
**work column** below it. There is no separate header bar and no horizontal menu.

The active sidebar item exposes `aria-current="page"`, a soft ground, and a 3px primary rule
on its left edge, and retains a visible keyboard focus outline. Tabs, segmented controls,
filter chips and the like keep their own selected styles.

Routes (unchanged):

- `/` Home — answers *what needs me now*, not *what exists*: KPI row, attention queue, activity feed, all filtered queries the viewer can open. A Site Admin, who has no "me" inside any organization, gets the one roll-up: organizations, boards, ideas and users across the platform.
- `/boards` — list of boards the user can access; opening a board goes to its swimlane view
- `/board/{boardId}` — board detail, ideas in swimlane columns mapped to the board's statuses
- `/ideas` — the organization-wide idea list and search surface; it does not duplicate a board route
- `/settings` — Settings hub with My Profile and role-scoped admin links
  - `/settings/profile` — edit first and last name and change the password; email and role read-only
  - `/settings/organizations`, `/settings/organizations/{orgId}/users`, `…/statuses`, `…/idea-types`, `…/fields`, `…/boards` — organization administration (the full 23-route set is rendered in `comp-p-admin.html`)

Site Admin is a global account and never requires an organization membership or
`organizationId` claim to browse platform data. Home, Boards, Ideas, Users, Statuses and
User-Defined Fields aggregate records from every organization and display the owning
organization where needed.

**Site Admin org-content mutation model (decided 2026-08-11).** Site Admin does **not** get
direct create/edit/delete paths for organization-owned content — boards, statuses, idea
types/business impacts, custom fields, ideas, comments, upvotes, delivery. There is no org
picker on any create or edit surface. Site Admin uses **View As** (`20-feature-view-as.md`)
to act as a user within the target organization; mutations happen under that identity with
dual-attribution audit. **Bootstrap exception:** organization and user administration stay
direct — creating organizations, managing users in any organization, user CSV import and
invite-code regeneration — since a new organization has nobody to impersonate yet.

**Denied is shown, not hidden (2026-09-02).** A control the viewer's role cannot use renders
**disabled with a reason** — `aria-disabled="true"` and `aria-describedby` pointing at the
reason, never the `disabled` attribute — so a keyboard or screen-reader user meets both the
control and the explanation. A route the viewer may not open at all renders a short refusal
panel (title, who the route is for, a way back), not the live page with every control
disabled. The two exceptions that stay hidden are the View As entry control (view-as rule 9:
hidden *and* refused) and admin links a member has no business seeing on the Settings hub. **A third
exception since 2026-09-27: per-row actions in a list** (Edit, Delete, Archive in the Actions column
or on a card) are hidden when the role may not take them — a column of disabled icons is noise, and
the capability is still announced by the page-level action, which stays disabled with its reason
(for example *Add New Board* for a member).

When an authenticated API request returns `401` because the persisted token is expired or
its security stamp is no longer valid, the client clears the persisted session and returns to
Login with the expired-session message instead of leaving the current page in an error state.

- Compatibility redirects: `/board` → `/boards`; `/workflow` and `/workflows` → `/boards`; `/workflow/{boardId}` → `/board/{boardId}`

## `/boards` — Boards

Every board the viewer can access. Choosing one opens its lanes; there is no **New idea** here,
because an idea is always raised against a board.

**Header and actions (2026-09-27).** The page follows the list and detail pattern (below). Its
header carries the single **Add New Board**, an Org Admin's; every other role sees it disabled with
the reason (*Administrators only*; a Site Admin, *Act as an organization administrator*). That
replaced, the same day, the topbar's **Manage boards** (to Settings → Boards) and **New board** pair
and each board's **Edit** link to Settings → Boards → Edit; editing now opens the board form in the
drawer. Filters, sorting and paging follow the pattern; boards are few enough to page in the client.
Boards are **archived, not deleted** (`30-Contracts.md` archive endpoints): an archived board leaves
the list unless the Status filter includes *Archived*, and its ideas stay in Ideas.

**Views.** Two views of the same facts, switched by a **List / Cards** control: **List** (default
since 2026-09-27; it was Cards) is one table row per board, for comparing many boards; **Cards** is a
responsive grid. The view is a URL, not stored state, so a link opens the view it names. The counts
are the board's live Discovery ideas, the same set the board itself shows.

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

Route: `/board/{boardId}`

Ideas are displayed as cards arranged in swimlane columns, where each column represents one
`Status` from the selected board.

### Board Header
The top bar carries the breadcrumb (*Boards / {board name}*), the **List / Lanes** view
switch, the **Board** picker (only when the user can reach more than one board), **Export
CSV** (any member, Read Only included — the CSV is a read), **Import CSV** (members and Org
Admins; a Site Admin sees it disabled with *Idea import goes through View As*), **Edit board**
(Org Admin; disabled with the reason for every other role, 2026-09-27), and the
primary **New idea**. New idea opens the brainstorm chat when AI assist is available and the
create form otherwise — in the drawer since 2026-09-27, the docked create column before
(`20-feature-ai-idea-assist.md` rules 32a–32c) — pre-populating
the target status as the left-most column. For Read Only and Site Admin it renders disabled
with a reason.

Below the header the page title line states the keyboard equivalent for drag — *Move a card
with drag, or focus it and press ← →* — and, for roles that cannot move cards, says so
instead. A labelled search input (*Search title, tag, assignee…*) with a Clear button sits
above the rail.

### Swimlane Columns
- One column per `Status` on the selected board, ordered by `Status.SortOrder` ascending.
- Column header shows the status name, a colour dot (`Status.Color`) with the name beside it, and the idea count.
- Columns are **fixed-width (288px) in a horizontally scrolling rail**, each with its own ground (`decisions.md` 2026-09-02). The rail scrolls; the page never does. Empty columns stay visible with a *No ideas* placeholder.
- Each column ends with a *+ Add idea* affordance for roles that may create.

### Idea Cards
Cards are compact. Each card shows: title (clickable, 2-line truncation), a priority
**marker** (dot plus the word), the **idea type written as text** (never a colour-only dot),
assigned-user personas, and the upvote control with its count. Business Impact, tags,
submission age and comment count are shown in the drawer and may be shown on the card
where space allows. A dedicated drag handle starts card movement; interactive controls never
start a drag. Clicking the card title opens the **drawer** in view mode (drawer since 2026-09-27; it was the
docked inspector — see "List and detail pattern" below) — the same surface reached from the Ideas
list.

Tags are selected and created through a searchable multi-value Tag field in Idea Detail.
Anyone authorized to edit the idea can create a reusable organization-scoped tag inline. Tag
names are trimmed and matched case-insensitively. Cards display the first three tags
alphabetically and a `+N` indicator for the remainder; the complete tag list is available in
Idea Detail and accessible text or a keyboard-accessible tooltip.

The Assignees field is an optional searchable multi-select populated with active users from
the idea's organization. It accepts at most five distinct users. Inactive users already
assigned remain visible but cannot be newly selected. Cards order assignees by first name then
last name and show the first three personas followed by `+N`. Each visible persona contains a
circular avatar with the first letter of the first name and first letter of the last name,
followed by the first name. Full names are available in Idea Detail and accessible text or a
keyboard-accessible tooltip. If one name part is unexpectedly absent, use the available
initial and first available display label; if both are absent, render `?` with accessible
label `Unknown user`.

Cards show submission age as viewer-local calendar-day difference between `createdAtUtc` and
today: `0 days ago`, `1 day ago`, or `{N} days ago`. Future values are clamped to `0 days ago`.

The upvote control is unfilled when inactive and filled (primary outline) when the current
user has upvoted; it is a live button for Org Admins, members and Read Only accounts, and a
static count for a Site Admin, whose vote is cast through View As. Toggle the icon and count
optimistically and restore both on failure. Clicking Add Comment opens the drawer's view (drawer
since 2026-09-27), scrolls comments into view, and focuses the comment composer. If commenting is unavailable, focus the
comments heading.

### Filter Chips
Filter chips appear above the board: **All**, **Created by me** (`AuthorUserId ==
currentUserId`), **Assigned to me** (the current user is in the idea's assignee collection).
Filtering is client-side. Empty columns remain visible with a *No ideas* placeholder.

### Search
Text input above the board filters cards by title, tag, or assignee (client-side,
case-insensitive). Combinable with filter chips.

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
6. Changing status in the drawer (drawer since 2026-09-27) uses the same move operation and immediately updates the idea's status; the card re-slots into the corresponding swimlane behind the open drawer (no navigation away).
7. Keyboard and touch users move ideas with the drawer's status selector, or with ← → on a focused card; touch drag is deferred.

### DnD Technology
HTML5 drag-and-drop (desktop only) with a dedicated handle and visible drop targets.
Touch/mobile drag is deferred; mobile view is scrollable and status movement remains
available through Idea Detail.

### Acceptance Criteria
- `/boards` shows the board list and `/board/{boardId}` shows the selected board's Kanban view
- `/board`, `/workflow`, `/workflows`, and `/workflow/{boardId}` redirect to canonical Board routes
- No user-facing UI displays Workflow or Workflows terminology
- Columns reflect the selected board's statuses in `SortOrder` order, at a fixed width in a scrolling rail
- Filter chips and title/tag/assignee search work across all columns (client-side)
- Card drag starts only from the dedicated handle, sets the idea status to the target swimlane's status, and reverts on failure with a toast
- Column drag (SiteAdmin/OrgAdmin only) saves immediately on drop; reverts on failure
- Clicking a card title opens the drawer in view mode over the board (URL gains `?idea={ideaId}`; drawer since 2026-09-27, it was the docked inspector)
- The drawer provides Edit / Cancel / Save, Move in Board, and authorized soft-delete actions
- Changing status in the drawer immediately updates the idea's status and re-slots the card in the matching swimlane
- Cards display idea type as text, priority as a labelled marker, current-user upvote state/count
- Idea Detail provides a searchable Tag multi-select that selects existing organization tags and creates normalized reusable tags inline for authorized editors, with at most 10 tags per idea
- Idea Detail provides an optional searchable Assignees multi-select containing active users from the idea's organization, with at most five distinct assignees and historical inactive-assignee display
- Cards display the first three tags alphabetically and first three assignee personas by first/last name, with `+N` overflow and complete accessible values
- Each persona shows first-name/last-name initials followed by first name, with an accessible missing-name fallback
- Cards display viewer-local calendar-day submission age with zero, singular, plural, and future-timestamp behavior
- Clicking the card comment action opens the drawer's view with comments in view and the composer focused (drawer since 2026-09-27)
- Upvote toggles optimistically and rolls back on failure
- New idea in the board header opens the brainstorm chat or the create form (in the drawer since 2026-09-27); disabled with a reason for Read Only and Site Admin
- The page header states the keyboard path for moving a card
- Mobile/touch: scrollable view, no drag support, status movement available in Idea Detail (the drawer goes full width below 900px; drawer since 2026-09-27)
- A `/ideas/{ideaId}` or `?idea={ideaId}` deep link opens the target list/board with the idea's drawer open in view mode (drawer since 2026-09-27); an inaccessible id shows a not-found/permission notice without a drawer

## VISUAL DESIGN DIRECTION — comp P (locked 2026-08-31, canonical 2026-09-03)

`SPEC/mockups/comp-p-focus-roadmap.html` and its three siblings are the canonical comp.
**Layout, information architecture and copy model are locked.** Its **palette is not
locked** and its type family is open alongside it (see below). The reference is the
generated set, at four roles and four states per screen; the sources are
`SPEC/mockups/_build/` and `SPEC/mockups/README.md` describes what each parent contributed.

### Layout (comp P — Focus Desk)
- **App shell**: the fixed left sidebar with grouped nav, the top bar with breadcrumb and page actions, and one scrolling work column — see NAVIGATION.
- **Content pages** use a breadcrumb in the top bar, a large page title (`h1`, 40px) with a one-line standfirst that says what the page shows and how it is ordered, then a command row of labelled filters where the page has any, then a card or table.
- **Home** answers *what needs me now*: a dismissible first-run strip, a KPI row where every tile carries a one-line definition of what it counts, a *Needs your attention* queue whose standfirst states its ordering (oldest first), and a *Recent activity* feed scoped to what the viewer can see. Every number is a filtered query the viewer can open. (Supersedes `20-feature-client-ui-revisions.md` Decision D4's tile grid; the counts carry forward, the *Request a new board* tile does not.)
- **Settings hub** is a role map, not a menu: link cards per tool, a different set per role, a member seeing only Profile.
- **Board** offers List and Lanes; Lanes is the rail described above. **Single visual encoding**: type, status and priority all use one **marker** — an 8px dot with its label always beside it. No column or chip family shouts louder than another.
- **Two copy voices, kept apart**: product copy lives inside the app frame and is written to ship; anything addressed to a reviewer lives in the chrome band outside it (`decisions.md` 2026-08-31).
- **Auth screens** are a two-column split: a pitch band in the secondary colour on the left, the form on the right. Login, Register and the forced first-login change carry no sidebar; the forced change deliberately has no navigation escape (auth rule 32a).

### List and detail pattern (comp R — 2026-09-27)

`SPEC/mockups/comp-r-portico-prototype.html` is the reference rendering. It **supersedes the next
section for detail, edit and create** on Boards, a board, and Ideas, and is the pattern every other
list screen (Settings entities, Delivery lists) moves to as it is touched.

- **Page header:** the H1 and its one-line description on the left; the one creation action on the
  right, vertically centred on that block, worded **Add New {Item}** in title case (*Add New Idea*,
  *Add New Board*). A role that may not create sees it disabled with the reason.
- **Toolbar:** a text filter that matches every displayed column (on Ideas: title, board, status,
  priority, tags, people; plus Problem), then a multi-select filter with type-to-find for each
  finite-valued column (Board, Status, Priority, Tags; Boards: Status Active/Archived, defaulting to
  Active), then the view switch on the right.
- **Views:** **List** is the default everywhere except a board's own page, where **Lanes** is the
  default and **List** is the alternative. Ideas and Boards also offer **Cards**. Filters, sorting
  and paging apply identically to every view of a screen (paging to List and Cards; Lanes shows all
  filtered cards).
- **Sorting:** every displayed column sorts; a header click cycles ascending → descending → off,
  with `aria-sort` on the active header.
- **Paging:** 10 per page by default, with 25, 50 and 100; the pager states *{from}–{to} of {total}*.
  Server-side for ideas (`30-Contracts.md` list pattern); boards are few enough to page in the client.
- **Actions column** at the right of every list row, and the same icons on each card: **View** (eye)
  opens the detail; **Edit** (pencil) opens the form; **Delete** (trash) — or **Archive** for boards —
  asks for confirmation first. Edit and Delete/Archive are hidden when the role may not use them (the
  Denied rule's row-action exception).
- **The drawer** replaces the docked inspector. It slides in from the right and **overlays** the page
  (`clamp(380px, 28vw, 520px)`; full width below 900px), so the list or board underneath never
  resizes or gains a scrollbar. It is not modal: no scrim, no focus trap; focus moves to its heading
  on open and returns to the trigger on close; Escape and × close it. The inspector's URL rules
  carry over: `?idea={ideaId}` and `/ideas/{ideaId}` deep links open the drawer in view mode, and
  the card's comment action opens it with comments in view and the composer focused. Modes:
  **view** (facts, structured sections, custom fields, and the discussion the inspector carried —
  the upvote control, the comment thread and the comment composer; comp R omits it and this spec
  wins — with Edit / Delete in the footer), **edit** (the form in place, Save / Cancel), and
  **create** — which for ideas opens **wide** with the idea assistant beside the form
  (`20-feature-ai-idea-assist-v2.md` "Surface").
- **Confirmation** for Delete and Archive is the one destructive modal: `role="alertdialog"`,
  focus trapped between Cancel (focused first) and the action, Escape cancels.
- **Lanes** are quiet full-height columns (a soft tint and hairline border per lane) with the
  status-tinted header, so a board reads as swimlanes rather than loose cards.

### Surfaces: docked inspector, inline create, one modal

> **Superseded 2026-09-27 for detail, edit and create by the list and detail pattern above**
> (`decisions.md`). Kept because the Settings entities and Delivery screens still follow it until
> they move to the pattern.

- **Detail and edit → the docked inspector.** Clicking an idea title from the Ideas list, a Board row or a lane card opens the inspector as a **third grid column** (404px) beside the list or board, which stays live and scrollable. It is **never a modal**: nothing is covered, there is no focus trap and no `inert`, and Escape closes the column. The originating row shows a selected state (a 3px primary rule plus a soft ground, both readable in greyscale). The inspector opens in a read view (eyebrow *{board} · #IDEA-{n} · {status}*, title, meta, a facts grid, custom fields with archived values labelled, description, discussion with the upvote control and comment composer) with an **Edit idea** action; edit swaps the body in place and reveals a Cancel / Save footer.
- **Create → the docked column too.** *New idea* and a lane's *+ Add idea* open the create form in the same column, over the board it will add to. On success the card appears in New / Pending and the column closes; Cancel or Escape dismisses without saving. Arriving from the brainstorm chat, suggested values carry the teal *Suggested* chip, tinted field and 3px left rule (`20-feature-ai-idea-assist.md` D-SUGGEST); arriving because the assistant was unavailable, the column shows the rule 32c flash.
- **Short forms are inline beside the list they add to** — statuses, idea types, fields, users. Longer edits open the docked inspector. There is no create drawer.
- **The one modal is a conversation or a decision**: the brainstorm chat (720px, `20-feature-ai-idea-assist.md` D-SURFACE), the promote-to-issue gate, the command palette, and the session-expiry dialog. Each is `role="dialog"` with an accessible name; Escape closes it.
- **Admin entities** (Organizations, Users, Statuses, Idea Types, Custom Fields, Boards) follow the same rule: list, inline create beside it, docked inspector for edit. Per-entity rules are preserved (Statuses' two-active floor and swatch picker, Idea Types' one-active-type floor and badge/field pickers, Custom Fields' type-immutable-on-edit and managed option list, Users' reset-temporary-password, Organizations' invite-code/logo/archive). The Site Admin cross-organization *All …* views are read-only roll-ups leading to a per-organization editor that renders read-only with every mutating control disabled and explained (`decisions.md` 2026-09-02).

**URL / deep-linking.** Inspector state lives in the URL as a query param on the current
route: `/ideas?idea={ideaId}` over the Ideas list, `/board/{boardId}?idea={ideaId}` over a
board. Closing drops the param and leaves the underlying page unchanged (back/forward
navigate open/closed). A bare `/ideas/{ideaId}` link resolves to the Ideas list with that
idea open. An `idea` id the viewer can't access opens the underlying list/board with a
not-found/permission notice and no inspector. Organizations keep their addressable
`/settings/organizations/{id}`.

**Full parity in the inspector.** Title, priority, Idea Type (immutable after creation;
admin-only *Reassign…* break-glass), Business Impact, optional due date, description (when
authorized), 0–5 assignees, 0–10 tags, custom fields, mentions, comments, upvote, status move,
and the admin-only **Delete idea** with confirmation.

**Responsive.** Below the narrow breakpoint the inspector becomes a full-width sheet and the
sidebar collapses. The broader narrow-viewport pass remains open.

### Settings → API (added 2026-08-16)

A read-only page at `/settings/api` showing AI assist token consumption, reached from the
Settings hub. Site Admin sees one row per organization, ordered by consumption, with a totals
row and the current UTC day's usage against the configured daily ceiling; Org Admin sees their
own organization only, with no ceiling shown. Standard list chrome, no create action, no
inspector. Behaviour and endpoints: `20-feature-ai-idea-assist.md` rules 28c–28e.

### Session, Profile, Controls, and Icons
- My Profile contains an editable first/last-name section and a voluntary password-change section; email and role are read-only. A successful name update refreshes shell identity immediately.
- Successful required and voluntary password changes clear client authentication and return to Login with confirmation. Re-login lands on Home unless a separate normal return URL applies.
- After 28 minutes without activity, an accessible modal dialog (`role="alertdialog"`) shows a live two-minute countdown with **Stay signed in** and **Sign out**. Staying signed in resets browser inactivity only; idle or absolute expiry returns to Login with the specific session-expired message (`20-feature-auth.md` #38–#42).
- **Sign Out** is the wording, and it lives in the sidebar identity block's menu, not as a nav item.
- Inputs follow `DESIGN.md`: 4px radius, 6px padding, never pill; the primary button is the one pill. Every input, select and textarea has a real `<label for>`, `aria-label` or `aria-labelledby`. Every form has a native submit control so Enter submits.
- Icons are inline SVG glyphs (the sidebar's) or none; never emoji or Unicode characters. Icon-only buttons have stable dimensions, accessible names, visible keyboard focus and correct disabled behaviour; decorative icons beside visible text are hidden from assistive technology. Comp P's paths are placeholders; the icon set is an implementation choice within these rules.
- **Colour never carries meaning alone** (`decisions.md` 2026-08-31): every coloured dot, bar or fill has a text label in the same component.

### Implementation: Tailwind CSS + shadcn/ui (decided 2026-09-03)

The client is built on **Tailwind CSS v4 and shadcn/ui** (Radix primitives), used as the
framework intends: semantic colour roles as theme variables, its component set, its
defaults for radius, type scale and control geometry. **Comp Q** (`comp-q-*.html`, built
from the same fragments as comp P by `_build/build_q.py`) renders every screen as what
shadcn/ui emits, and is the visual reference for Wave E; comp P remains the source of
structure and copy. The component map — sidebar → `Sidebar`, breadcrumb → `Breadcrumb`,
markers → `Badge`, panels → `Card`, filters and forms → `Input`/`Select`/`Label`/`Form`,
the palette → `Command`, dialogs → `Dialog`, tables → `Table`, loading → `Skeleton`,
denials → `Button` with `aria-disabled` plus a `Tooltip`/description — is the registry in
`build_q.py`. The docked inspector is a layout column (a `ResizablePanel`), not a `Sheet`,
because it is never a modal. *Since 2026-09-27 the drawer replaces it (list and detail pattern
above): an overlay that is still not modal, so not a `Sheet` with a scrim or a focus trap either.* `packages/design-system` in the conversion is the shadcn
install plus the theme; nothing is hand-rolled that the framework provides.

### Typography

> **Superseded in part 2026-09-27** (`decisions.md`, Terrazzo): **typography is per theme now.**
> Terrazzo uses Schibsted Grotesk for headings and Public Sans for text; the other themes' faces are
> in comp R. Each theme's fonts load from a Google Fonts stylesheet exactly as Geist does today — no
> npm dependency — and the font set is part of the theme. The type scale below is unchanged.

**Geist**, shadcn/ui's default face and the family the shipped client already uses (user
decision 2026-08-12), declared once as the `--font-sans` theme token; Geist Mono for invite
codes and identifiers. The **type scale is Tailwind's** as shadcn applies it: 14px UI text,
page titles `text-2xl font-semibold tracking-tight`, card titles `text-base`, captions
`text-xs`. Comp P's `DESIGN.md` scale (16px body, 40px `h1`) is not carried; comp Q shows
the framework scale, which also recovers most of the 15% density cost measured on comp P.

### Color palette

> **Decided 2026-09-27: Terrazzo** (Themes below, `decisions.md`). The palette is no longer open;
> what follows records how it was chosen. Rule 2 below is superseded by each theme's own suggestion
> hue.

**Open, expressed as shadcn theme variables.** Comp Q carries the 2026-08-31 palette below
as `--background`, `--foreground`, `--primary`, `--muted`, `--border` and the rest in one
`:root` block (`_build/q.css`); changing the palette is changing that block. Comp P renders the `DESIGN.md` tokens (primary `#0075de`, secondary `#213183`,
canvas `#f6f5f4`, hairline `#e6e6e6`, near-black ink, and the sticker set sky / purple /
pink / orange / teal / green for category dots) and proves the structure survives whatever
hue set replaces them, because no colour in it carries meaning alone. The candidate
replacement is the business-professional palette the user chose on 2026-08-31 — ink
`#243447`, background `#F7F9FB`, accent `#527292`, semantic pairs success `#6FAF7A`/`#457C4F`,
warning `#C9A65C`/`#8A6D2E`, error `#C97A7A`/`#B64B4B`, teal `#5F9E93`/`#4A7972`, 2px radii —
which the comps A–O were re-rendered to. Whichever palette is chosen must keep two rules:

- Only a near-black ink is used as body text; chromatic values are fills, chips or dots only, each paired with an `-ink` derived to clear 4.5:1 **against its own soft tint**, not merely against white.
- The `D-SUGGEST` teal (`--sug: #116b5e`) must stay unmistakable against the accent — re-check the suggestion chip, tinted field and left rule whenever the accent changes. *Superseded 2026-09-27: the pinned teal gives way to each theme's `--suggest` / `--suggest-tint` hue, distinct from that theme's accent (Themes below).*

### Themes (2026-09-27)

**Palette decided: Terrazzo** — slate blue `#3D5A80`, pistachio and blush accents, Schibsted
Grotesk for headings and Public Sans for text. It is the default. A **theme picker** at the right
of the top bar offers **Light:** Terrazzo, Portico, Piazza Sera, Lagoon, and **Dark:** Notte. The
choice is remembered **per browser**, in a cookie the server reads so the first render is already in
the chosen theme (answered 2026-09-27: not stored on the user profile). Every theme is the same token set (`packages/design-system`), so
components never name a colour; each theme's pairs are checked to 4.5:1 for text. Token values are
in comp R. Rule 1 in "Color palette" above (near-black ink for
text; each `-ink` cleared against its own tint) applies to every theme, read for a dark theme as
its inverse: one near-white neutral ink on the dark ground. Rule 2 is now per theme: each
theme defines a **suggestion hue** (`--suggest`, `--suggest-tint`) distinct from its accent, for
fields the idea assistant filled (`20-feature-ai-idea-assist-v2.md` Q5). Each theme also carries its
own fonts (Typography above).

## ERROR DISPLAY

- Frontend error surfaces must show the full underlying error message in Development.
- Frontend error surfaces must show a generic user-safe message in Production.
- The same UI should remain available in both modes, but the content should differ based on the runtime environment.
- Every list and detail surface has four states — normal, empty, loading (skeletons that hold row height, never a spinner), error (an alert with a safe retry) — and comp P renders all four for every screen.

## SUPERSEDED SURFACES — the shipped Blazor client (Comp C, until cutover)

Kept so the running product can be read against this spec without confusion. None of this is
a target for new work.

- **Shell**: a 64px icon rail (Home, Boards, Ideas, Settings) with a bottom avatar popover holding Profile and Sign Out; no header bar. Reference `comp-c-review-06-lockin-v5-final.html`. Sprint 7.5 records the rail's *Log out* wording and placement drift from that lock.
- **Detail, edit and create**: a right slide-in drawer (≈620px, `DrawerShell`) over a dim backdrop for ideas (locked 2026-08-10) and for the five admin entities (2026-08-14), with create moved from a centered modal into the same drawer on 2026-08-17. `CreateModalShell` survives only as the brainstorm chat chrome. Sprint 7.5 records that the drawer never takes focus and Escape is dead.
- **Board cards**: the *Flat* treatment — pale lane background, priority chip, left-border status accent; columns as equal fractions of the width.
- **Components**: Fluent UI Blazor, whose shadow-DOM submit buttons and text fields are two of Sprint 7.5's three systemic accessibility defects. Icons from Fluent System Icons. Native and Fluent text-like controls at a stable 36px.
- **Palette in `app.css`**: still the indigo/warm-neutral Comp C tokens with 6px/4px radii; never migrated to the 2026-08-31 palette.
- **Home**: the D4 tile grid with an *Activity feed coming soon* placeholder.
