# Contracts: outcomes

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Outcome Contracts

*Written 2026-10-09, with the decision "The S0.2 schema freeze is amended a seventh time, for
Outcomes" (`SPEC/decisions.md`), before the code. Everything here is taken from the routes table
and the Outcome rules in `SPEC/20-feature-issues-and-delivery.md` ("New entity: Outcome", "New
service: OutcomeService", "Outcomes (Slice 2)", Permissions). Where that spec is silent this file
says so and points at the numbered question under "Not yet specified" at the end; it does not
guess. The backend slice answers those questions with the user and writes the answers here, in the
same change.*

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
    is refused with `403`. See question 10 for the read side.
- **Item fields** (stored, returned by every route that returns an Outcome):
  - `outcomeId`
  - `organizationId`
  - `name` string, required, non-empty, max 120 characters
  - `description` string or `null`, max 1000 characters
  - `targetStartDate`, `targetEndDate` — dates (format: question 14); `targetEndDate` must be on or
    after `targetStartDate`
  - `ownerUserId` GUID string or `null` — when present, an active user in the same organization
  - `sortOrder` integer — the row order on the roadmap grid
  - `color` string, `#RRGGBB`, required (colour rules below)
- **Derived rollups are never stored.** `issueCount`, `doneCount`, the derived sprint span and the
  quarter placement are computed in the query on every read. Because grouping is single-parent they
  are plain counts: no distinct-count, and the per-outcome counts sum to the delivery set. Their
  response shape is question 1.
- **Colour.** Any `#RRGGBB`, as for tags (`contracts/tags.md`, "Tag colour and management"). A new
  Outcome with no chosen colour takes a random colour from the tag palette. Presentation data, not
  a status. Case, `null` handling and the error text are question 5.
- **Window.** The target window is the Outcome's *intent*. The sprint span derived from its Issues
  may disagree with it; that is the signal the roadmap shows, never an error to reconcile.
- The error bodies follow the shared model in `packages/*/src/common`; no route builds its own.
  Messages and keys are question 3.

### `GET /api/v1/organizations/{orgId}/outcomes`
List the organization's Outcomes with their derived rollups.

- **Roles:** every member of the organization.
- **Request:** —
- **Response:** `200`: the Outcomes in `sortOrder`, each with the item fields and its derived
  rollup (shape: question 1). Soft-deleted Outcomes are not listed (question 15). Paging:
  question 6.
- **Errors:** `401` caller is not authenticated; `404` the organization does not exist or is
  outside caller scope.
- **Rules:** —

### `POST /api/v1/organizations/{orgId}/outcomes`
Create an Outcome.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body
  - `name` required; `description` optional; `targetStartDate` and `targetEndDate` required, end on
    or after start; `ownerUserId` optional; `color` (absent or `null`: question 5).
- **Response:** success status and body: question 8.
- **Errors:**
  - `400` `name` is blank or over 120 characters; `description` is over 1000 characters;
    `targetEndDate` is before `targetStartDate`; `color` is not a `#RRGGBB`; `ownerUserId` is not
    an active user in this organization
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the organization does not exist or is outside caller scope
- **Rules:** a new Outcome takes a random palette colour unless one is chosen. Name uniqueness is
  question 4; where a new Outcome sits in `sortOrder` is question 17.

### `GET /api/v1/organizations/{orgId}/outcomes/{id}`
One Outcome with its grouped Issues.

- **Roles:** every member of the organization.
- **Request:** —
- **Response:** `200`: the Outcome with its derived rollup and its grouped Issues (the Issue fields
  are question 1).
- **Errors:** `401`; `404` the Outcome does not exist, is soft-deleted, or belongs to another
  organization, or the organization is outside caller scope.
- **Rules:** —

### `PUT /api/v1/organizations/{orgId}/outcomes/{id}`
Update name, description, window and owner.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body — the same field rules as create. Whether `color` is accepted here, and
  whether the body is a full replacement: question 9.
- **Response:** success status and body: question 8.
- **Errors:**
  - `400` the same field rules as create
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the Outcome does not exist, is soft-deleted, or belongs to another organization
- **Rules:** updating an Outcome never touches an Issue.

### `PUT /api/v1/organizations/{orgId}/outcomes/order`
Set the roadmap's row order.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body — the Outcome ids in the intended order (the `OutcomeService` method takes
  `orderedIds`). The property name, and whether the set must match the organization's Outcomes
  exactly, are question 7.
- **Response:** success status: question 8.
- **Errors:** `401`; `403` as for create; `404` the organization is outside caller scope; `400`
  conditions: question 7.
- **Rules:** `order` is a literal path segment, not an Outcome id: declare this route before
  `PUT .../outcomes/{id}` (as `contracts/issue-tasks.md` does for its `order` route).

### `DELETE /api/v1/organizations/{orgId}/outcomes/{id}`
Soft-delete an Outcome.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** —
- **Response:** success status: question 8.
- **Errors:** `401`; `403` as for create; `404` the Outcome does not exist, is already
  soft-deleted, or belongs to another organization.
- **Rules:**
  - **Every Issue grouped under it is ungrouped (`outcomeId` set to `null`); no Issue is ever
    deleted.** The foreign key is `ON DELETE SET NULL`, never `CASCADE`, so a removal cannot delete
    an Issue even by mistake.
  - Soft-delete only (`is_deleted`); there is no restore route in the spec.
  - Repeat-delete behaviour: question 16.

### `PUT /api/v1/ideas/{ideaId}/outcomes`
Set or clear an Issue's single Outcome.

- **Roles:** in-scope admin ("Group an Issue under an Outcome" is ticked for Site Admin, through
  View As, and Org Admin only). A direct Site Admin is refused.
- **Request:** body `{ "outcomeId": <guid|null> }`
  - `outcomeId` a GUID string names the Issue's Outcome; `null` ungroups the Issue.
- **Response:** success status: question 8.
- **Errors:** `401`; `403` as for create; `404` the idea does not exist or is outside caller scope.
  Whether a non-existent, soft-deleted or other-organization `outcomeId` is a `400` or a `404`, and
  whether a `Discovery`-phase idea is refused: question 12.
- **Rules:**
  - Grouping is a **move**, not an add: a new Outcome replaces any existing grouping, and `null`
    leaves the Issue ungrouped.
  - An Issue's sprint and its Outcome are independent: changing one never changes the other.
  - Audit events and notifications: question 11.

### `GET /api/v1/organizations/{orgId}/roadmap`
The roadmap read.

- **Roles:** every member of the organization.
- **Request:** the spec's routes table still shows `?granularity=quarter|sprint`, **superseded
  2026-09-28 (comp R)**: the client draws the time axis at the zoom the viewer picks, so the read
  takes no `granularity`.
- **Response:** `200`: every Outcome, with its window, colour and grouped Issues (key when one
  exists, title, delivery status, effort, assignees, sprint dates) and its derived sprint span, in
  one request (`SPEC/20-feature-issues-and-delivery.md`, `GetRoadmapAsync`; `contracts/delivery.md`,
  "Gap, for a later sprint"). The shape and the Issue key are question 2.
- **Errors:** `401`; `404` the organization does not exist or is outside caller scope.
- **Rules:** nothing on the page is stored except the Outcome itself; every count and span is
  derived.

## Not yet specified

Each item below is a gap in `SPEC/20-feature-issues-and-delivery.md`, not a decision. None is
resolved by this file.

1. **Rollup shape.** Field names and nesting for `issueCount`, `doneCount`, the derived sprint span
   (earliest sprint start to latest sprint end, and its value when no grouped Issue has a sprint)
   and the quarter placement; whether "done" means delivery status `Complete`; which Issue fields
   `GET .../outcomes/{id}` returns; whether the drawer's derived *State* (*Planned*, *In its
   window*, *Past its window*) is returned or computed by the client from its local date.
2. **Roadmap read.** The response shape, whether it sits beside or replaces the list and detail
   reads, and how an Issue's key is carried (the spec calls Issue keys a gap).
3. **Error messages and keys.** No message text is specified for any Outcome rule.
4. **Name uniqueness.** Whether Outcome names are unique per organization, and if so how
   (case-insensitively, as fieldsets and tags are?). The schema adds no constraint.
5. **Colour.** Upper-case normalisation on store and return (as tags do), whether `color` may be
   absent or `null` on create, what absent means on update, the error text, and the random source.
6. **Pagination.** None is specified; the list is assumed unpaged.
7. **Reorder body.** The property name, whether the id set must match the organization's
   Outcomes exactly (as the task reorder does), and the resulting `sortOrder` values.
8. **Success statuses and bodies** for create, update, reorder, delete and the grouping `PUT`.
9. **Update body.** Whether `PUT .../outcomes/{id}` accepts `color` (the routes table lists only
   name, description, window and owner, while the edit form changes colour), and whether the
   Outcome form's "Issues under this outcome" checklist saves as `issueIds` on the Outcome write
   or as one grouping `PUT` per Issue (`contracts/delivery.md` leaves this to the Outcomes slice).
10. **Site Admin reads.** Whether a Site Admin acting directly may read every route here, as for
    sprints; the Permissions table ticks the roadmap for every role.
11. **Audit and notifications.** The spec lists no Outcome audit event and no notification.
12. **Grouping validation.** Behaviour for an `outcomeId` that does not exist, is soft-deleted or
    belongs to another organization, for a `Discovery`-phase idea, and for grouping an Issue under
    the Outcome it already has (a no-op?).
13. **Owner display.** Whether the item carries an `ownerDisplayName`, as the sprint item does.
14. **Date format.** The spec says "dates"; sprints use `YYYY-MM-DD`.
15. **Soft-deleted Outcomes** are assumed excluded from every read.
16. **Repeat delete.** Whether a second `DELETE` is `404`, as for sprints.
17. **Placement.** Where a new Outcome takes its `sortOrder`.
