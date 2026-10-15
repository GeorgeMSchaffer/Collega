# Decisions

A dated log of decisions that constrain later work. One entry per decision: what was
decided, when, and enough of the reason that a reader six months out does not reopen it
by accident. Newest first.

Supersession is recorded, not edited away — if a decision replaces an earlier one, both
stay, and the older one is marked.

---

## Reading and rotating this log

Read the index, then open only the entries you need. The newest entries are kept in full
below the index; older ones live verbatim in `SPEC/decisions/archive-<from>-to-<to>.md`.

- A new entry goes at the top of the full entries, in full, with a new line at the top of the
  index.
- Once this file passes about 40 KB, the oldest full entry moves verbatim to the newest archive
  file (start a new one, and rename the range, when that file would pass 40 KB). Its index
  line stays and points at the archive.
- When an entry is superseded, mark it where it lives and update its index status.

## Index

Every entry, newest first. "Full below" entries are in this file; the rest are in
`SPEC/decisions/`, verbatim. Status reflects supersession recorded in the log itself.

| Date | Decision | Status | Where |
|---|---|---|---|
| 2026-10-15 | The four open Backlog Add New Issue readings are decided | active | full below |
| 2026-10-15 | Issues can be added directly from the Backlog | active | full below |
| 2026-10-13 | Boards can pull in existing items, and ideas can have no board | active | full below |
| 2026-10-13 | Home gets an Unread notifications panel | amended | full below |
| 2026-10-09 | The S0.2 schema freeze is amended a seventh time, for Outcomes | active | full below |
| 2026-10-04 | `compare` judges the cases both runs share; none shared is exit 2 | active | full below |
| 2026-10-04 | The App Admin's sidebar offers Home and Settings only | active | full below |
| 2026-10-04 | The Site Admin role is shown as App Admin | active | full below |
| 2026-10-04 | An organization is created with its first Org Admin | active | full below |
| 2026-10-04 | Three vertical demo organizations join Acme and Blue Harbor | active | full below |
| 2026-10-04 | The sign-in pitch shows the product, not the primary colour | active | full below |
| 2026-10-04 | Users create boards; managing them stays Org Admin | active | full below |
| 2026-10-04 | One Enter adds a tag on the idea form | active | full below |
| 2026-10-04 | Graphite is the default theme | active | full below |
| 2026-10-04 | Fieldsets: reusable groups of fields, attached to idea types | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The Home comp is a visual guide; the spec wins | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The follow and inbox questions are answered | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The S0.2 schema freeze is amended a fifth time, for idea followers and read state | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The Home dashboard comp is approved as drawn | amended | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | Following an idea, and an in-app notification inbox | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The View As banner names only the target | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-10-01 | The View As candidate order, and F1 closes | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-30 | What the MVP release includes | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-30 | The prompt-eval thresholds stand, confirmed against the v1 baseline | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-29 | How the cutover is run | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-29 | Board lanes reorder by dragging the header, with buttons as the fallback | active | [2026-09-29 to 2026-10-04](decisions/archive-2026-09-29-to-2026-10-04.md) |
| 2026-09-29 | Contracts and wording written from the code | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | Removing a lane moves its ideas | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | The test harnesses reuse sessions; the auth rate limits stay | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-29 | Spec contradictions resolved | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The Idea Field Option contract follows the code | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The v2 corpus format, as built | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's provisional limits stand for the first baseline | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | `compare` refuses to judge an invalid run | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's fixture hash for `compare` is the catalog hash | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The Anthropic client reads no credential or endpoint from the environment | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner's open questions are answered | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The prompt-eval runner: what existing decisions already settle | superseded in part | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | Starting a sprint, a single-Issue read, the Roadmap's sprint rows, and tag audit events | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The comp R iteration's open questions are answered | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The S0.2 schema freeze is amended a fourth time, for tag colours | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | Graphite replaces Notte as the dark theme | superseded in part | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-28 | The next comp R iteration is adopted: denser forms, Sprint board, Roadmap, tag colours and Settings → Tags | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The API sends the custom field list | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The idea assistant is rescoped as a co-author, and ideas gain structured fields | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | The S0.2 schema freeze is amended a third time, for structured ideas and board archive | active | [2026-09-27 to 2026-09-29](decisions/archive-2026-09-27-to-2026-09-29.md) |
| 2026-09-27 | Terrazzo is the palette, with a theme picker | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | One list and detail pattern, and a drawer instead of the docked inspector | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | The Boards screen has a card view and a list view | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | Desk screens use the full width, and the Boards screens carry the board actions | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-27 | Boards gain a description, and the board list carries what a card needs | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The AI integration is rescoped and respecified after the current batch | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The .NET stack is deleted; stale pointers go, inherited rationale stays | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-13 | The usage report returns the contract's `totals`, not the frozen app's flat fields | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-12 | A lockout refuses a wrong password, not a right one | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-12 | The rate limiter's collision with the golden replay is deferred, knowingly | superseded in part | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The S0.2 schema freeze is amended once, for Issues-and-Delivery Slice 1 | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The golden replay is not a gate, and never was meant to be one | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | Registration answers `409` again; hiding the status did not close the enumeration oracle | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-11 | The account-lockout denial of service is a known open risk; not fixed now | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | The auth rate limiter sends `Retry-After` and nothing else | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | `POST /auth/register` refuses a taken email generically, and no longer answers `409` | superseded | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | The organization's title rides on `/auth/me`, not on a second call to an admin endpoint | active | [2026-09-10 to 2026-09-27](decisions/archive-2026-09-10-to-2026-09-27.md) |
| 2026-09-10 | How the two Vercel projects are configured, and how production gets its first administrator | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-09 | Shipping for feedback outranks fidelity to the .NET app | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-09 | The drifted database is rebuilt, not migrated | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | Wave G is cut from the conversion and revisited after cutover | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | Application-layer test coverage is paid down alongside Wave D, not after it | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-08 | An empty state's action is disabled with a reason, never omitted | superseded in part | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-07 | The live database cannot accept a Prisma write on seven columns | superseded in part | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-07 | Golden replay cannot authenticate against the Nest API, and F1 is the gate | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | The .NET stack is frozen; its code and instructions are no longer applicable | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Unresolved comment mentions are rejected, not ignored; the contract was wrong | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Wave B conventions: commits, validation errors, and house style | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Entity ids are generated in the application layer, not the domain | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | `.env` is the single home for configuration; a typed config module reads it | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-06 | Layer boundaries are enforced by Biome, not eslint-plugin-boundaries | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-04 | .NET development stops; the conversion starts now | active | [2026-09-04 to 2026-09-10](decisions/archive-2026-09-04-to-2026-09-10.md) |
| 2026-09-04 | Sprint 8 is cancelled: the .NET stack is never deployed | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-04 | The idea-type badge moves to the tag row on swimlane cards | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-04 | The session lives in a cookie Nest issues; the reshape takes only what introspection forces | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-03 | The conversion's remaining gates: net-new scope, the test suite, and where it deploys | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-03 | Comp P is the canonical comp; the client is built on Tailwind CSS + shadcn/ui | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | Outcome ↔ Issue cardinality: single-parent | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Golden capture (Wave A) starts now, not with Sprint 9 | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Comp P is the locked UI direction; colour stays open | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Colour may never be the only carrier of meaning | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | Home carries two voices, kept apart | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-08-31 | TypeScript conversion: three constraints settled | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | A denied admin route shows a refusal, not a disabled page | superseded in part | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | Conversion slices merge to `dev`, not to an integration branch | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |
| 2026-09-02 | The board is a scrolling rail of fixed-width columns | active | [2026-08-31 to 2026-09-04](decisions/archive-2026-08-31-to-2026-09-04.md) |

---

## 2026-10-15 — The four open Backlog Add New Issue readings are decided

**Decided by the user**, on the four items slice 187 left open (see "Issues can be added directly
from the Backlog" below). Applied by slice 211.

1. **Site Admin add-denial wording is kept:** *Act as a member to add issues. Use View As.*
   (`apps/web/lib/roles.ts`, `issueAddDenial`), although the delivery screens' older wording says
   "administrator". No code change.
2. **The Issue drawer's footer Edit follows the spec:** enabled only for the author and an Org Admin
   (the Backlog row Edit's rule), disabled with the reason *Only the author or an Org Admin can edit
   this issue.* for other writers. Read Only and Site Admin behaviour is unchanged.
3. **The Delivery group (Effort, Sprint) stays directly under Title**, as the approved comp draws
   it; the spec text that placed it after the idea fields was wrong and is corrected.
4. **The header *Add New Issue* button lives in the page header's action slot** (`PageHeader`
   `action`), not the topbar; the spec wording is corrected.

---

## 2026-10-15 — Issues can be added directly from the Backlog

**Decided by the user.** The Backlog page gets a way to **add** an Issue directly, and to **edit**
Issues. Until now an Issue exists only by promoting an idea that was created first
(`20-feature-issues-and-delivery.md`, "Promotion"). The user decided the feature and **who may add**:
any member who can create ideas, with author-creates semantics, the same set that may promote their
own idea. That is a User or Org Admin of the organization (a Site Admin through View As, acting as the
target); Read Only and a direct Site Admin cannot. Specified in `SPEC/20-feature-issues-and-delivery.md`
("Backlog: add and edit") and `SPEC/contracts/delivery.md` (`POST /organizations/{organizationId}/issues`).

**Implementation readings, for the user to overrule.** The assistant chose these defaults while
specifying; none was put to the user:

1. **One atomic route**, `POST /api/v1/organizations/{organizationId}/issues`, creates a board-less idea
   with the pool create's fields, limits and validation, and promotes it in the same commit: phase
   `Delivery`, `deliveryStatus` `Pending`, a required `effort`, an optional `sprintId` (null or omitted
   is the backlog), `promotedAtUtc` and `promotedByUserId` set to the creator, `upvoteCountAtPromotion`
   0. Two calls (pool create, then promote) were rejected: a failure between them would leave a
   Discovery idea the user meant to be an Issue.
2. **The ideation status** is the organization's first active status, as for a pool idea.
3. **Audit and notification** follow the two existing actions: `IdeaCreated` as the pool create writes
   it and `IdeaPromotedToIssue` as promote writes it. The `IdeaPromoted` notification goes to followers
   other than the actor, as promote does; the author is the actor, so only assignees, who follow
   automatically, can receive it.
4. **No board.** The new Issue belongs to no board. It can be pulled onto a board only after Return to
   Discovery, by the existing rule (`20-feature-board-pull-in.md` rule 14).
5. **Editing** uses the idea form the Issue drawer already specifies. An Issue has no board and no lane,
   so the edit form carries no board or status field, and no Effort field either (`PUT /ideas/{ideaId}`
   refuses `effort` on a Delivery item).

**Amends the Delivery contracts preamble.** `contracts/delivery.md` says there is "no `/issues` root".
That sentence is about addressing an existing Issue and stays true for every route that takes an
`{ideaId}`; the new route is the one creation route and sits under the organization, like the pool
create. The preamble now says so.

**No schema change**: `ideas.board_id` has been nullable since the eighth amendment (2026-10-13), and
every column the route sets exists. **Golden corpus unaffected**: the route is new and no recorded case
calls it.

**Amendment, 2026-10-15 (decided by the user): the UI is comp A with comp B, and quick-add becomes a
pattern.** Three comps were drawn on `feature/185-backlog-add-comps`
(`SPEC/mockups/comp-r-backlog-add-a-drawer.html`, `-b-inline.html` and `-c-two-paths.html`). The user
chose **A, the drawer, together with B, the inline quick-add row**:

1. **Quick-add is a universal pattern** for every non-settings, non-admin grid: a spreadsheet-style new
   row at the top of the list with the minimum fields; Enter submits and the row stays focused for
   rapid entry. It lives in the list and detail pattern (`20-feature-client-ui.md`, "Quick-add row");
   the header *Add New {Item}* button stays beside the row (decided, item 4 below).
2. **Hand-off rule, contract unchanged.** The API keeps requiring what it requires. When the row cannot
   supply every required field, pressing Enter opens the full drawer form **pre-populated** with the
   row's values, and nothing is created until that form is saved. When the row can supply everything
   (the Boards list: a name, lanes defaulted to the first two statuses, and `allowUserStatusUpdate`
   sent as `false`), Enter creates directly (decided, item 7 below).
   **Consequence, stated plainly:** idea create requires Problem, Proposed solutions, Impact rationale,
   Priority, Idea type and Business impact, plus the organization's required custom fields (the idea
   form defaults Priority to Medium and Idea type and Business impact to the first active options), so on **Ideas and on the Backlog the
   row always hands off today**. It is a fast way into the pre-populated form, not a way around it. No
   contract is relaxed.
3. **Scope, from the scoping report.** First wave: the Backlog, the Ideas list, the Boards list (Org
   Admin or User; hidden for Read Only) and a board page's List view. Not applicable: the Roadmap (no Outcome create route yet), the
   Inbox, Home and detail pages. Issue tasks already have an inline add, the reference implementation.
   Sprints and the Sprint board: a weak fit, not in the first wave. A Lanes view's per-lane add: later,
   undecided.

**Decided by the user, 2026-10-15 (these closed the seven questions this amendment first left open):**
1. **Accidental adds: no Undo.** On Ideas and the Backlog nothing is created until the pre-populated form
   is saved, so there is nothing to undo. The toast has no Undo action and no delete route is built for
   this feature.
2. **Backlog row fields:** Title, Effort and Sprint. All three pre-fill the drawer; Sprint defaults to
   Backlog.
3. **Mobile (phone width): the row is hidden.** The header button opens the drawer, full-screen on
   phones. No `DataTable` mobile card mode is needed for quick-add, so planned slice 194 is dropped from
   this feature.
4. **The header *Add New {Item}* button stays** beside the row on every list that has a row. The button
   opens the empty drawer for a full-detail add; the row is the fast path.
5. **New-row ordering follows the active sort.** The new row is scrolled into view and highlighted for a
   few seconds (as the Backlog drawer already does); if paging hides it, the toast says where it went.
   Nothing is pinned.
6. **Read Only: the quick-add row is hidden.** The header button still shows its disabled-with-reason
   state under the Denied rule. This replaces the earlier 'disabled bar' assumption.
7. **Boards row:** sends `allowUserStatusUpdate` = `false` (what the controller already does when the
   field is omitted; `contracts/boards.md` makes it a required boolean) and creates directly.

---

## 2026-10-13 — Boards can pull in existing items, and ideas can have no board

**Decided by the user.** Creating a board offers to pull in existing items. The request named "items
from the backlog or other ideas not assigned to other boards"; both needed a reading, because every
idea belongs to exactly one board today (`ideas.board_id` is `NOT NULL`) and "backlog" means the
delivery backlog (Issues with no sprint). The user chose all three readings. Specified in
`SPEC/20-feature-board-pull-in.md`:

1. **Three sources.** Discovery ideas on other boards; backlog Issues, returned to Discovery by the
   existing action; and a new pool of ideas that belong to no board.
2. **Ideas can have no board, and enter the pool both ways:** created without a board, or detached
   from one later by the author or an Org Admin.
3. **Placement.** An item keeps its status if the new board has that lane, else it lands in the
   leftmost lane.
4. **Who pulls.** An Org Admin pulls anything eligible; a User only Discovery ideas they authored.
   Backlog Issues stay Org Admin only, because Return to Discovery already is.

Pulling happens in the save that creates or edits a board, in one commit, with no notification. The
user answered the six open questions the same day (`SPEC/20-feature-board-pull-in.md`, "Answered
questions"):

- **Q1.** An Org Admin may detach an idea from an archived board; a User may not.
- **Q2.** A board-less idea can be promoted; the Issue has no board.
- **Q3.** The pull step is on **existing** boards' edit form as well as the create form.
- **Q4.** Home shows an Org Admin a *Needs a board* count of the pool, linking to the Ideas list
  filtered to *No board*.
- **Q5.** At most 100 items per save.
- **Q6.** CSV import and the idea assistant stay board-scoped and create no pool ideas.

The user approved the comp (`SPEC/mockups/comp-r-board-pull-in.html`) as drawn the same day, which
settles its five open questions: a pool idea takes the organization's first active status; pulled
items take their place under the board's ordinary card ordering (there is no stored lane position,
so "appended after existing cards" is not possible); the Home *Needs a board* tile is hidden at 0;
an item pulled from a lane removed in the same save lands by the placement rule; and a pull asks for
no confirmation.

**The S0.2 schema freeze is amended an eighth time**, under the 2026-09-11 rule that each change to
`schema.prisma` needs its own entry. Additive, no backfill, no new foreign key: `ideas.board_id` and
`notification_events.board_id` drop `NOT NULL` (neither has a foreign key or check constraint
today). No enum value is added: `audit_events.event_type` is a free string, so `IdeaBoardChanged`
needs no migration. The migration lands in slice 179 with the contracts.

**Golden corpus.** The new fields are optional and `boardId` is never null in the recorded cases, so
the replay is not expected to differ; slice 179 confirms it and records anything else in
`tools/golden/src/accepted.ts`.

---

## 2026-10-13 — Home gets an Unread notifications panel

**Decided by the user**, amending "The Home dashboard comp is approved as drawn" (2026-10-01), which
said *no "Unread for you" panel for now*. Home carries an **Unread notifications** panel at the top
of the right column, above *Assigned to me*: the five newest unread notifications, each opening its
idea over the inbox (`/inbox?idea={ideaId}`), a count beside the heading, *Open inbox* as its footer,
and *You're all caught up.* when there are none. Its rows say what an inbox row says
(`inbox-wording.tsx`, `20-feature-idea-following.md` rule 42). It reads only the caller's own
inbox, so a Site Admin, who has none, does not get it. No new route: the list route has no unread
filter, so Home reads one page of 50 and keeps the unread ones; the count comes from the existing
count route. The count can exceed the rows shown, and a reader with more than 50 newer read items
sees fewer than five rows with a larger count. Slice 176.

**Addendum, 2026-10-13 (user):** that cap goes. `GET /notifications` takes an optional
`unread=true`, which filters in SQL (`contracts/notifications.md`); Home asks for `pageSize=5&unread=true`
and shows exactly the five newest unread. Additive: no existing request or response changes, so the
golden corpus is unaffected. Slice 177.

Comp: `comp-r-home-dashboard.html` gains the panel (note 14), and
`comp-r-home-dashboard-built.html`, generated by `SPEC/mockups/_build/build_r_home.mjs`, draws Home
from the real `@collega/design-system` components and `globals.css` instead of a copied stylesheet.

---

## 2026-10-09 — The S0.2 schema freeze is amended a seventh time, for Outcomes

**Decided by the user.** Outcomes (Issues-and-Delivery Slice 2, `SPEC/20-feature-issues-and-delivery.md`
"New entity: Outcome") are started: the roadmap backend is the next piece of delivery work after the
Sprint 11 screen. Under the 2026-09-11 rule — the freeze stands, and each change to `schema.prisma`
needs its own entry here — this is that entry, and not a general licence. Additive, no backfill; every
existing Issue starts ungrouped:

- **New table `outcomes`** (`id`, `organization_id`, `name` `VARCHAR(120)`, `description`
  `VARCHAR(1000)` nullable, `target_start_date` `DATE`, `target_end_date` `DATE`, `owner_user_id`
  nullable, `sort_order`, `color` `VARCHAR(7)`, `is_deleted`, `created_at_utc`, `updated_at_utc`,
  `created_by_user_id`, `updated_by_user_id`), indexed on (`organization_id`, `sort_order`).
  `organization_id` references `organizations` with `ON DELETE RESTRICT`. `owner_user_id` carries no
  foreign key, matching `sprints.owner_user_id` and `ideas.author_user_id`: the active-user check lives
  in the Application layer.
- **New nullable column `ideas.outcome_id`**, the single-parent link decided on 2026-09-02, indexed on
  `outcome_id`. Its foreign key to `outcomes` is **`ON DELETE SET NULL`**, never `CASCADE`: removing an
  Outcome ungroups its Issues and must never delete one.
- **Not covered:** an `idea_outcomes` join table (the multi-parent shape was rejected on 2026-09-02), a
  stored rollup, status or percent-complete columns, a `sprint_id` on an Outcome, and a uniqueness
  constraint on `name`. The spec states no name rule, so none is added to the schema.

**Golden corpus.** The Outcome routes are new, and no Outcome is seeded by this change. The replay is
not expected to differ; the backend slice confirms it and records anything else in
`tools/golden/src/accepted.ts`. The corpus is not re-recorded.

Contract: `SPEC/contracts/outcomes.md` (new). Migration: `20261004010000_add_outcomes`.

---

## 2026-10-04 — `compare` judges the cases both runs share; none shared is exit 2

**An implementation reading, approved by the user 2026-10-09** (slice 174), settling what
`20-feature-prompt-eval-runner.md` rule 33 ("for the cases both share") leaves open for `compare`:

- **Every figure is computed over the shared case ids**, both runs restricted to them before the
  metrics, the rule 32 regressions, the cache guard and the locked-field check. The cases left out
  of each side are listed. Identical case sets compare exactly as before.
- **Validity stays a property of each whole run.** An aborted run, more than 10% errored trials or
  an errored `refuse-*` trial anywhere still makes `compare` exit 2 (2026-09-28, "`compare` refuses
  to judge an invalid run"): excluding a case cannot repair a run that was not valid.
- **No shared case is exit 2**, not 0: there is nothing to judge, and a pass would be a verdict about
  nothing — the same reasoning as the 2026-09-28 entry.
- **The case-selection warning stays** (rule 34): a different selection is still not like with like.

---

## 2026-10-04 — The App Admin's sidebar offers Home and Settings only

> Supersedes in part `20-feature-client-ui-revisions.md`'s "Site Admin … Boards, Ideas … list views
> aggregate all organizations".

**Decided by the user.** An App Admin (Site Admin) acting as themselves changes boards, ideas and
delivery only through View As, and their own lists of them were empty, so the sidebar and the
command palette no longer offer them Boards, Ideas, Sprint board, Backlog or Roadmap — those showed
a 0 count and an empty screen. Home's platform roll-up still links to each board for reading. A group left
empty (Delivery) loses its heading. Under View As the role is the target's, so the links return.
The routes themselves are unchanged.

---

## 2026-10-04 — The Site Admin role is shown as App Admin

**Decided by the user**, who names the four roles App Admin, Org Admin, User and Read Only. Every
user-visible label and message in `apps/web` says **App Admin**. The role's value (`SiteAdmin`),
the API, its contracts and error messages, the golden corpus, the specs and code comments keep
"Site Admin": renaming those is a large, risky change for no user-facing gain, and the specs read
"Site Admin" as the role's name. API error text a screen shows verbatim (the View As refusal) still
says "Site Admin" until a later slice changes it.

---

## 2026-10-04 — An organization is created with its first Org Admin

**Decided by the user.** The App Admin (the role the code calls Site Admin) reaches an
organization's users, tags, custom fields, boards and ideas only by acting as a member (rule 25
stands), so an organization with no active Org Admin is unreachable. The user chose to close that by
construction rather than give the App Admin direct access:

- **Creating an organization requires its first Org Admin** — name, email, initial password. The
  form and the server action refuse before the organization is created when any is missing.
- **The organization's page lists its Org Admins**, warns when none is active, and offers **Add Org
  Admin**: Add New User preset to that organization and the Org Admin role (direct user
  administration is rule 26's bootstrap exception). A deactivated admin is reactivated from their user
  page.

Rejected: letting the App Admin edit organization settings directly, which would reverse rule 25 and
attribute organization changes to someone outside it.

---

## 2026-10-04 — Three vertical demo organizations join Acme and Blue Harbor

**Decided by the user.** The generic demo data (the same eleven scenarios on every board, prefixed
with the board's focus) is too thin to demo to a market. The seed now also creates three
organizations written for a vertical: **Pinecone Labs** (an Agile software team), **Brightline
Creative** (a marketing agency) and **Meridian Holdings** (a corporate business-improvement
programme, "Project Lighthouse"). Each has two boards of 11 themed ideas (3/2/2/1/3 across the default
statuses), themed tags, comments, a sprint with promoted issues and checklists, and one account per
role - Org Admin, two Users, Read Only - on the same `orgadmin`/`user`/`user2`/`readonly` local parts.

**Acme Robotics and Blue Harbor Logistics are kept unchanged** and stay first in the scenario: about
60 golden fixtures, the E2E suite and `apps/web`'s test fixtures pin them by slug, and the corpus
cannot be re-recorded. This **supersedes the "exactly 2 demo organizations" wording** in
`10-requirements.md`, `20-feature-organizations-and-users.md` and `40-test-strategy.md`: the two
fixture organizations keep that shape; the three verticals are additional demo data. Read Only
accounts are seeded in every organization (they already were; the specs' "no Read Only account"
wording was stale).

---

## 2026-10-04 — The sign-in pitch shows the product, not the primary colour

**Decided by the user**, choosing option C of `SPEC/mockups/comp-login-alternatives.html`. The auth
screens' left band was filled with the theme's primary; in Graphite, the default, that put a
full-height block of bright amber beside a near-black form. The band now sits on the theme's
**sidebar ground** with a hairline border and the sidebar's own text pair (the rail is dark in Sera
and Graphite, light in the others, so the page's foreground would vanish on Sera's), the primary is
kept for the mark and the Sign in button, and
**Sign in** adds a decorative **schematic board** (five lanes in status hues, placeholder cards,
every colour a theme token). Register and the forced password change share the band without the
board. The copy is unchanged.

---

## 2026-10-04 — Users create boards; managing them stays Org Admin

**Decided by the user**: everyone above Read Only in an organization may add ideas and boards. Ideas
already worked that way. For boards, a **User** may now **create** one in their own organization;
**editing, archiving, unarchiving and reordering lanes stay Org Admin only**. Creating includes
the new board's first choices — its name, description, lanes and the user-moves setting — so a User
makes those once, at creation; changing them afterwards is the Org Admin's. Read Only is refused as
before. A Site Admin still creates boards and ideas only through View As (rule 25 stands; the user
confirmed it the same day).

The permission matrices in `05-product-definition.md` and `10-requirements.md` split *Create/manage
boards* into *Create boards* and *Edit, archive and configure boards*. `contracts/boards.md` names no
roles for the create route, so it is unchanged. The golden corpus recorded `boards.create.user` as
403; it is now 201. The replay will report it as a status difference, and that is
the intended record: `tools/golden/src/accepted.ts` refuses entries that excuse a status, because
an authorization outcome must never be waved through silently.

---

## 2026-10-04 — One Enter adds a tag on the idea form

**Decided by the user**, after typing a new tag, pressing Enter once and being refused on save.
Slice 148 made Enter on unmatched text only *highlight* the *Create tag ‘…’* option, with a second
Enter (or a click) to choose it; a highlighted option looks chosen, so the text stayed in the box
and the save refused it. Now **Enter adds the highlighted option, or the first one when nothing is
highlighted** — an existing tag when one matches by prefix, otherwise *Create tag* — as a chip at
once. The save still refuses text left in the box (the owner's slice 148 decision stands), and its
message now says to press Enter to add it or clear it.

---

## 2026-10-04 — Graphite is the default theme

> Supersedes in part 2026-09-27 "Terrazzo is the palette, with a theme picker" and 2026-09-28
> "Graphite replaces Notte as the dark theme", both of which kept Terrazzo as the default.

**Decided by the user.** The app's default theme is **Graphite**, the dark theme, instead of
Terrazzo. A browser with no `collega-theme` cookie (or one the app does not recognise) is served
Graphite on the first render; a browser that picked a theme in the picker keeps it, since the cookie
is written only by a choice. The five themes, the picker, the per-browser cookie and the 4.5:1 rule
are unchanged.

Terrazzo stays the bare `:root` in `packages/design-system/src/globals.css`: the app always sets
`data-theme`, so the bare block is only what a document with no attribute gets — the comps, and
`global-error.tsx`, which deliberately renders without the design system. Moving the bare block
would change every comp's reference rendering for no product gain. The comps' own pickers still open
on Terrazzo; they are review artefacts, not the app.
