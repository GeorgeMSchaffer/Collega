# Contracts: outcomes

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Outcome Contracts

*Written 2026-10-09, with the decision "The S0.2 schema freeze is amended a seventh time, for
Outcomes" (`SPEC/decisions.md`), before the code. Everything here is taken from the routes table
and the Outcome rules in `SPEC/20-feature-issues-and-delivery.md` ("New entity: Outcome", "New
service: OutcomeService", "Outcomes (Slice 2)", Permissions). Where that spec was silent this file
named a numbered question. **The user decided all 17 on 2026-10-15** ("The 17 open Outcome
contract questions are decided", `SPEC/decisions.md`); each answer is written into the route
sections below and listed, with its original number, under "Decided 2026-10-15" at the end. The
backend slice implements this file; it does not reopen the answers.*

An **Outcome** is an organization-scoped, soft-deletable, dated grouping lens over Issues. It is
not a container: it has no status, no percent-complete and no `sprintId`, it is never on a board,
and it cannot be promoted, assigned or commented on. An Issue sits under **at most one** Outcome
(`ideas.outcome_id`, nullable; decided 2026-09-02).

Shared by every route below:
- **Roles.** Reading is open to every member of the organization, `Read Only` included (the
  feature's Permissions table ticks "View Tasks and the Roadmap" for every role). Management
  (create, update, reorder, delete) and grouping an Issue are an in-scope Org Admin's. User and
  Read Only are refused with `403`.
  - **A Site Admin mutates only through View As**, as for sprints: acting directly, every mutation
    is refused with `403`. **Unlike sprints** (`contracts/sprints.md` lets a direct Site Admin
    read), reads are refused too here: a Site Admin acting directly gets `403` on every route,
    `GET`s included, and reads only through View As (decision 10; `SPEC/decisions.md`
    2026-10-04). There is no direct read route.
- **Item fields** (stored, returned by every route that returns an Outcome):
  - `outcomeId`
  - `organizationId`
  - `name` string, required, non-empty, max 120 characters; names may duplicate, there is no uniqueness rule (decision 4)
  - `description` string or `null`, max 1000 characters
  - `targetStartDate`, `targetEndDate` — date-only `YYYY-MM-DD` strings, as for sprints (decision
    14); `targetEndDate` must be on or after `targetStartDate`
  - `ownerUserId` GUID string or `null` — when present, an active user in the same organization.
    The item carries the id only, **no `ownerDisplayName`**: the client resolves names from the
    users list (decision 13)
  - `sortOrder` integer — the row order on the roadmap grid
  - `color` string, `#RRGGBB`, required (colour rules below)
- **Derived rollups are never stored.** They are computed in the query on every read. Because
  grouping is single-parent they are plain counts: no distinct-count. **Rollup shape (decision 1,
  the Board References rollup of `SPEC/20-feature-board-references.md`):** flat fields beside the
  item fields, on every route that returns an Outcome:
  - `ideaCount`, `doneIdeaCount` integers — items grouped under the Outcome, and of those the
    ones in a final lane (`board_swimlanes.is_final`), which are done
  - `taskCount`, `doneTaskCount` integers — the same over the grouped items' child cards
  - `metricTotals` — projected and realized totals per active metric type, shape and rules in
    `contracts/metric-types.md` ("Outcome totals", 2026-10-16)
  - `sprintStart`, `sprintEnd` — `YYYY-MM-DD`: the earliest sprint start and the latest sprint end
    among the sprints of the grouped items' tasks; **both `null` when none has a sprint**

  - **Per-idea values (confirmed by the owner, 2026-10-19):** each item of an Outcome's `ideas` (detail and roadmap) gains `metrics`: `[{ metricTypeId, projected, realized }]`, the item's stored values over **active** metric types, in the types' order; `[]` when it has none. Names and units come from `metricTotals` or the metric types list; the idea's `title` is already there. The ungrouped list carries the same field.

  Quarter placement and the drawer's derived *State* (*Planned*, *In its window*, *Past its
  window*) are **not returned**: the client computes them from its own local date.
- **Colour (decision 5).** Any `#RRGGBB`, as for tags (`contracts/tags.md`, "Tag colour and
  management"): stored and returned **upper-case**. On create, `color` absent or `null` takes a
  random colour from the tag palette (the random source is injected, so tests are deterministic).
  On update, absent leaves the colour unchanged and `null` is a `400`. A value that is not
  `#RRGGBB` is a `400` keyed `color`: `"Color must be a valid #RRGGBB color."` Presentation data,
  not a status.
- **Window.** The target window is the Outcome's *intent*. The sprint span derived from its Issues
  may disagree with it; that is the signal the roadmap shows, never an error to reconcile.
- **Errors (decision 3).** The bodies follow the shared model in `packages/*/src/common`; no route
  builds its own. Validation failures use the `errors` object, camelCase keys `name`,
  `description`, `targetStartDate`, `targetEndDate`, `color`, `ownerUserId`, and the shared
  templates of `SPEC/30-Contracts.md` "Validation Message Conventions", the field name in spaced
  Title Case, verbatim:
  - `name`: `"Name is required."`, `"Name must be 120 characters or fewer."`
  - `description`: `"Description must be 1000 characters or fewer."`
  - `targetStartDate`, `targetEndDate`: `"Target Start Date is required."`, `"Target End Date is
    required."`, `"Target Start Date must be a valid date."`, `"Target End Date must be a valid
    date."` (decision 14)
  - `targetEndDate` before the start: `"End date must be on or after start date."`
  - `color`: `"Color must be a valid #RRGGBB color."`
  - `ownerUserId`: not an active user in this organization; the text follows the shared template
    and is fixed by the backend slice

  `403` and `404` use the shared model's standard text (for example `"Organization not found."`,
  `"Outcome not found."`, as `contracts/fieldsets.md` words its own).
- **Soft-deleted Outcomes** are excluded from every read and cannot be grouped into; there is no
  restore route (decision 15).

### `GET /api/v1/organizations/{orgId}/outcomes`
List the organization's Outcomes with their rollups.

- **Roles:** every member of the organization. A direct Site Admin is refused (`403`).
- **Request:** query `page` and `pageSize` (decision 6): paged like other lists; `pageSize` absent
  is `20`, clamped to `1`-`100`.
- **Response:** `200`: the shared paged envelope of `SPEC/30-Contracts.md` "Shared Data Rules"
  (`items`, `page`, `pageSize`, `totalCount`, `sortBy`, `sortDirection`). `items` are the
  Outcomes in `sortOrder`, each with the item fields and its flat rollup (decision 1); the order is
  fixed, so `sortBy` answers `sortOrder` and `sortDirection` `asc`. Soft-deleted Outcomes are not
  listed. The roadmap read is **not** paged.
- **Errors:** `401` caller is not authenticated; `403` a Site Admin acting directly; `404` the
  organization does not exist or is outside caller scope.
- **Rules:** —

### `POST /api/v1/organizations/{orgId}/outcomes`
Create an Outcome.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body
  - `name` required; `description` optional; `targetStartDate` and `targetEndDate` required, end on
    or after start; `ownerUserId` optional; `color` optional (absent or `null`: random palette
    colour, decision 5).
- **Response:** `201` with the created Outcome item including its rollup (`ideaCount`,
  `doneIdeaCount`, `taskCount`, `doneTaskCount` 0, `metricTotals` `[]`, `sprintStart` and
  `sprintEnd` `null`) (decision 8).
- **Errors:**
  - `400` `name` is blank or over 120 characters; `description` is
    over 1000 characters; a date is missing or not a valid date; `targetEndDate` is before
    `targetStartDate`; `color` is not a `#RRGGBB`; `ownerUserId` is not an active user in this
    organization
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the organization does not exist or is outside caller scope
- **Rules:**
  - **Names may duplicate (decision 4):** no uniqueness check, no index, no schema change.
  - Audit: `OutcomeCreated` carrying the Outcome's fields (decision 11).
  - **Placement (decision 17).** A new Outcome is appended: `sortOrder` is the current maximum
    plus 1 among non-deleted Outcomes, `0` when there are none.

### `GET /api/v1/organizations/{orgId}/outcomes/{id}`
One Outcome with its grouped Issues.

- **Roles:** every member of the organization. A direct Site Admin is refused (`403`).
- **Request:** —
- **Response:** `200`: the Outcome item with its flat rollup (decision 1) and `ideas`, its grouped
  top-level items, each `ideaId`, `title`, `statusId`, `effort`, `assigneeUserIds`, `sprintId`,
  `sprintStart`, `sprintEnd` (the sprint fields `null` when the item has no sprint). No item key is returned
  (keys remain a gap).
- **Errors:** `401`; `403` a Site Admin acting directly; `404` the Outcome does not exist, is soft-deleted, or belongs to another
  organization, or the organization is outside caller scope.
- **Rules:** —

### `PUT /api/v1/organizations/{orgId}/outcomes/{id}`
Update name, description, window, owner and colour.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body — a **full replacement** of `name`, `description`, `targetStartDate`,
  `targetEndDate` and `ownerUserId`, with the same field rules as create (decision 9). `color` is
  accepted: absent leaves it unchanged, `null` is a `400` keyed `color` with the invalid-colour text
  `"Color must be a valid #RRGGBB color."`, a value is validated as on create.
  The form's "Issues under this outcome" checklist is **not** part of this write: the client sends
  one `PUT /ideas/{ideaId}/outcomes` per Issue whose grouping changed.
- **Response:** `200` with the updated Outcome item including its rollup (decision 8).
- **Errors:**
  - `400` the same field rules as create
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the Outcome does not exist, is soft-deleted, or belongs to another organization
- **Rules:** updating an Outcome never touches an Issue. The audit event is written only when
  something changed (decision 11).

### `PUT /api/v1/organizations/{orgId}/outcomes/order`
Set the roadmap's row order.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body `{ "orderedIds": [guid, ...] }` (decision 7). **Partial is allowed**: the
  listed Outcomes take the first positions in the listed order and the rest keep their relative
  order after them; `sortOrder` is then renumbered `0..n-1` over the organization's non-deleted
  Outcomes.
- **Response:** `204`, no body (decision 8).
- **Errors:** `401`; `403` as for create; `404` the organization is outside caller scope; `400`
  keyed `orderedIds` for an id that is unknown, duplicated in the list, soft-deleted or belongs to
  another organization, and for an empty list (`"Ordered Ids is required."` when the property is
  absent).
- **Rules:** `order` is a literal path segment, not an Outcome id: declare this route before
  `PUT .../outcomes/{id}` (as `contracts/issue-tasks.md` does for its `order` route).

### `DELETE /api/v1/organizations/{orgId}/outcomes/{id}`
Soft-delete an Outcome.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** —
- **Response:** `204`, no body (decision 8).
- **Errors:** `401`; `403` as for create; `404` the Outcome never existed or belongs to another
  organization, or the organization is outside caller scope.
- **Rules:**
  - **Every Issue grouped under it is ungrouped (`outcomeId` set to `null`); no Issue is ever
    deleted.** The foreign key is `ON DELETE SET NULL`, never `CASCADE`, so a removal cannot delete
    an Issue even by mistake.
  - Soft-delete only (`is_deleted`); there is no restore route.
  - **Repeat delete is idempotent (decision 16):** `DELETE` of an Outcome of this organization that
    is already soft-deleted answers `204` and writes no audit event. `GET` and `PUT` of a
    soft-deleted Outcome remain `404`.
  - Audit: `OutcomeDeleted` (decision 11).

### `PUT /api/v1/ideas/{ideaId}/outcomes`
Set or clear an Issue's single Outcome.

- **Roles:** in-scope admin ("Group an Issue under an Outcome" is ticked for Site Admin, through
  View As, and Org Admin only). A direct Site Admin is refused.
- **Request:** body `{ "outcomeId": <guid|null> }`
  - `outcomeId` a GUID string names the Issue's Outcome; `null` ungroups the Issue.
- **Response:** `200` with `{ "ideaId": <guid>, "outcomeId": <guid|null> }` (decision 8).
- **Errors:** `401`; `403` as for create; `404` the idea does not exist or is outside caller scope;
  `400` keyed `outcomeId`: the Outcome does not exist, is soft-deleted, or belongs to another
  organization — `"Outcome not found."`; `422` `taskCannotBeGrouped`: the item has a parent (decision 12). A `404` idea
  takes precedence over a `400` `outcomeId`.
- **Rules:**
  - **Eligibility (decision 12, `SPEC/20-feature-board-references.md`):** any item with no
    parent, in any status, on any board, including a standalone card on a child board, can be
    grouped. A card with a parent is refused with `422`; it rolls up through its parent. There is
    no Discovery-phase refusal.
  - Grouping is a **move**, not an add: a new Outcome replaces any existing grouping, and `null`
    leaves the Issue ungrouped.
  - Grouping an Issue under the Outcome it already has is a **no-op**: `200`, no audit event.
  - An Issue's sprint and its Outcome are independent: changing one never changes the other.
  - Audit: `IssueOutcomeGroupingChanged` (decision 11). **No notification.**

### `GET /api/v1/organizations/{orgId}/roadmap`
The roadmap read.

- **Roles:** every member of the organization. A direct Site Admin is refused (`403`).
- **Request:** the spec's routes table still shows `?granularity=quarter|sprint`, **superseded
  2026-09-28 (comp R)**: the client draws the time axis at the zoom the viewer picks, so the read
  takes no `granularity`. It takes no paging either (decision 6).
- **Response:** `200` (decision 2): an object `{ "outcomes": [...], "ungrouped": [...] }`, **unpaged**
  (the grid draws every row), in one request (`SPEC/20-feature-issues-and-delivery.md`,
  `GetRoadmapAsync`; `contracts/delivery.md`, "Gap, for a later sprint").
  - `outcomes` — every non-deleted Outcome in `sortOrder`: the item fields and the flat rollup
    (decision 1), plus `ideas`, an array of
    `{ ideaId, title, statusId, effort, assigneeUserIds, sprintId, sprintStart, sprintEnd }`.
  - `ungrouped` — the items under no Outcome, with the same fields. Cards that have a parent are
    excluded: they roll up through their parent.
  - **No Issue key is returned**; keys remain a gap.
- **Errors:** `401`; `403` a Site Admin acting directly; `404` the organization does not exist or
  is outside caller scope.
- **Rules:** nothing on the page is stored except the Outcome itself; every count and span is
  derived. This read sits beside the list and detail reads and replaces neither.

## Decided 2026-10-15

The user answered the 17 questions this section used to hold, in one pass, on 2026-10-15
(`SPEC/decisions.md`, "The 17 open Outcome contract questions are decided"). The numbering is kept
so existing references stay traceable; the rule itself lives in the route sections above.

1. **Rollup.** The Board References rollup, flat on each Outcome: `ideaCount`/`doneIdeaCount` (an
   item in a final lane is done), `taskCount`/`doneTaskCount` over child cards, projected and
   realized totals per metric type, `sprintStart`/`sprintEnd` derived from the tasks' sprints
   (`null` when none). Quarter placement and the drawer's State are the client's, from its local
   date. Detail also returns the grouped items as `ideas` (`ideaId`, `title`, `statusId`, `effort`, `assigneeUserIds`,
   `sprintId`, sprint start and end).
2. **Roadmap read.** Its own route beside the list: `{ outcomes, ungrouped }`, each Outcome with
   its flat rollup and `ideas` (`ideaId`, `title`, `statusId`, `effort`,
   `assigneeUserIds`, `sprintId`, `sprintStart`, `sprintEnd`). No Issue key. The list returns
   Outcomes with rollups only.
3. **Errors.** The shared validation templates and the camelCase keys `name`, `description`,
   `targetStartDate`, `targetEndDate`, `color`, `ownerUserId`; `403` and `404` take the shared
   model's standard text.
4. **Names.** May duplicate; no uniqueness rule, index or schema change.
5. **Colour.** As tags: upper-case `#RRGGBB`; create absent or `null` is a random palette colour
   (injected source); update absent is unchanged and `null` is a `400`; a bad value is a `400` on
   `color`.
6. **Paging.** The list is paged (`page`, `pageSize`, default 20, clamped 1-100, shared envelope).
   The roadmap read stays unpaged.
7. **Reorder body.** `{ "orderedIds": [guid, ...] }`, partial allowed; listed Outcomes first, the
   rest after in their relative order; `sortOrder` renumbered `0..n-1`. Unknown, duplicate,
   soft-deleted or other-organization ids are a `400` on `orderedIds`.
8. **Statuses and bodies.** Create `201` and the item; update `200` and the item; reorder `204`;
   delete `204`; grouping `200` and `{ ideaId, outcomeId }`.
9. **Update body.** Accepts `color` (absent is unchanged); a full replacement of name,
   description, dates and owner. The checklist is not part of the Outcome write: one
   `PUT /ideas/{ideaId}/outcomes` per changed Issue.
10. **Site Admin.** Refused (`403`) on every Outcome route, reads included; reads and mutations
    only through View As (2026-10-04).
11. **Audit and notifications.** `OutcomeCreated` and `OutcomeDeleted` carry the Outcome's fields;
    `OutcomeUpdated` carries before and after for each changed field and is written only when
    something changed; `IssueOutcomeGroupingChanged` carries `ideaId` and from and to `outcomeId`
    and names. A no-op grouping writes nothing. No Outcome notifications.
12. **Grouping.** Any item with no parent, in any status, on any board (standalone cards on a child
    board included) can be grouped; a card with a parent is a `422` and rolls up through its
    parent. An `outcomeId` that does not exist, is soft-deleted or belongs to another organization
    is a `400` on `outcomeId`; grouping to the current Outcome is a `200` no-op writing nothing;
    `null` ungroups. No Discovery refusal.
13. **Owner display.** `ownerUserId` only; no `ownerDisplayName`.
14. **Dates.** `YYYY-MM-DD`, date-only, as sprints; an invalid format is a `400` on the field.
15. **Soft-deleted Outcomes.** Excluded from every read, cannot be grouped into; no restore route.
16. **Repeat delete.** `DELETE` of an already soft-deleted Outcome of this organization is `204`;
    an id that never existed or belongs to another organization is `404`; `GET` and `PUT` of a
    soft-deleted Outcome stay `404`.
17. **Placement.** A new Outcome is appended: `sortOrder` is the maximum plus 1 among non-deleted
    Outcomes, `0` when none.
