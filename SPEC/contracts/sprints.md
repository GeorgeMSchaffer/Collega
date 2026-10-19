# Contracts: sprints

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Sprint Contracts

Added 2026-09-11, Issues and Delivery Slice 1.

Section-wide rules:
- A Sprint is an organization-scoped, soft-deletable, time-boxed container. **Flat** — it is never nested under a Slice 2 Outcome, and an Issue belongs to zero or one Sprint through a nullable `sprintId` on the idea, with no join entity.
- **Management is admin-only; reading is open to every member of the organization** including `Read Only`, because the sprint board and backlog are ticked for every role in the feature's Permissions table. A direct Site Admin is refused every mutation and allowed every read.
- Sprint names are **not** unique: "Sprint 12" may legitimately recur across years.

Sprint item shape (returned by list, create, update, and embedded in the detail read):
- `sprintId`
- `organizationId`
- `name` string, max 100 characters
- `goal` string or `null`, max 500 characters
- `startDate` date string (`YYYY-MM-DD`)
- `endDate` date string (`YYYY-MM-DD`)
- `ownerUserId` GUID string or `null`
- `ownerDisplayName` string or `null`
- `state` string: `Planned`, `Active`, or `Completed`
- `ideaCount` integer — added 2026-10-19, see "Work board sprint header" below
- `issueCount` integer, `doneCount` integer — **derived per read, never stored.** A stored counter is a second source of truth that drifts the first time an Issue moves without going through the sprint.

### `GET /api/v1/organizations/{organizationId}/sprints`
The organization's sprints. Soft-deleted sprints are excluded.

- **Roles:** every member of the organization (section rule).
- **Request:** query parameters
  - `state` optional — `Planned`, `Active`, or `Completed`. Omitted returns every state. An **unrecognised** value is a `400` keyed `state` rather than being read as absent: silently listing everything would answer `200` with rows the caller explicitly excluded.
- **Response:** `200`: an unpaged array of the sprint item shape.
- **Errors:**
  - `400` `state` is not one of the three values
  - `401` caller is not authenticated
  - `404` the organization does not exist or is outside caller scope
- **Rules:** —

### `GET /api/v1/organizations/{organizationId}/sprints/{sprintId}`
One sprint with the Issues assigned to it — the sprint board in a single read.

- **Roles:** every member of the organization (section rule).
- **Request:** —
- **Response:** `200`: the sprint item shape plus:
  - `issues` array of the delivery card shape from `GET /api/v1/organizations/{organizationId}/delivery`
- **Errors:**
  - `401` caller is not authenticated
  - `404` the sprint does not exist, is soft-deleted, or belongs to another organization
- **Rules:** `issues` is the same projection that endpoint answers, filtered to this sprint, so the sprint board and the backlog render from one card shape. It is composed at the API boundary rather than embedded in the sprint read, so there is one place that knows how to build a delivery card.

### `POST /api/v1/organizations/{organizationId}/sprints`
Create a sprint. It always starts `Planned`; `state` is not accepted on the body.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body
  - `name` required string, max 100 characters, trimmed
  - `goal` optional string or `null`, max 500 characters, trimmed; blank is stored as `null`
  - `startDate` required date string (`YYYY-MM-DD`)
  - `endDate` required date string (`YYYY-MM-DD`), must be **on or after** `startDate`
  - `ownerUserId` optional GUID string or `null` — must be an active user in this organization
- **Response:** `201`: the sprint item shape, with `state` `Planned` and both counts `0`.
- **Errors:**
  - `400` `name` is blank or too long; `goal` is too long; either date is not a calendar date; `endDate` is before `startDate` (`"End Date must be on or after Start Date."`); `ownerUserId` is not an active user in this organization
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the organization does not exist or is outside caller scope
- **Rules:** —

### `PUT /api/v1/organizations/{organizationId}/sprints/{sprintId}`
Rename, re-goal, re-date, or reassign the owner.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body identical to create; the update is a full replacement of those five fields.
- **Response:** `200`: the sprint item shape.
- **Errors:**
  - `400` same field rules as create; plus `"A completed sprint cannot be re-dated."` (keyed `startDate`) when either date differs on a `Completed` sprint
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` the sprint does not exist, is soft-deleted, or belongs to another organization
- **Rules:**
  - allowed while `Planned` or `Active`
  - **the dates of a `Completed` sprint are locked.** Its window is now a historical record of when the work actually happened, and anything reading back "what shipped in Q3" would silently change answer. Name, goal and owner stay editable there — fixing a typo on a finished sprint rewrites no history.
  - `state` is not settable here; use `start` and `complete`

### `POST /api/v1/organizations/{organizationId}/sprints/{sprintId}/start`
`Planned` → `Active`.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body: none.
- **Response:** `204 No Content`
- **Errors:**
  - `400` the sprint is not `Planned` — keyed `state`, `"Only a planned sprint can be started."`
  - `401`/`403`/`404` as for update
- **Rules:**
  - An explicit action, never derived from `startDate` passing: a sprint the team has not actually picked up is not in progress, whatever the calendar says.
  - There is **no single-active-sprint constraint** in this slice — an organization may run several concurrently.

### `POST /api/v1/organizations/{organizationId}/sprints/{sprintId}/complete`
`Active` → `Completed`, with deterministic carry-over.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** body: none.
- **Response:** `204 No Content`
- **Errors:**
  - `400` the sprint is not `Active` — keyed `state`, `"Only an active sprint can be completed."`
  - `401`/`403`/`404` as for update
- **Rules:**
  - every assigned Issue whose `deliveryStatus` is not `Complete` is unassigned back to the **delivery backlog** (`sprintId` set to `null`). Carry-over-to-the-next-sprint is a P1 refinement, not this slice's default.
  - no Issue is deleted, and Issues already `Complete` stay on the sprint as its record of what shipped
  - the transition and every unassignment commit together, so a sprint can never end up `Completed` with unfinished Issues still pointing at it
  - writes a `SprintCompleted` audit event carrying the carried-over count and ids
  - a `Completed` sprint will not accept new Issues: a later `PUT /api/v1/ideas/{ideaId}/sprint` naming it is a `400`

### `DELETE /api/v1/organizations/{organizationId}/sprints/{sprintId}`
Soft-delete a sprint.

- **Roles:** in-scope admin. A direct Site Admin is refused.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** `401`/`403`/`404` as for update
- **Rules:**
  - **every assigned Issue is unassigned to the backlog first.** No Issue is ever deleted with a sprint; `ideas.sprint_id` is `ON DELETE RESTRICT` precisely so unassignment cannot be skipped.
  - soft-delete, so existing audit references keep resolving. There is no restore endpoint in this release.
  - **not idempotent**: a soft-deleted sprint is gone as far as every route here is concerned, so a second `DELETE` answers `404`, as do `GET`, `PUT`, `start` and `complete` on it. This matches the soft-delete behaviour of statuses and ideas.

## Sprints per board (planned 2026-10-15)

*Specified in `SPEC/20-feature-board-references.md`. Built in Plan 2 (slices 220-234). Until Plan 4, org-wide sprints (`boardId` null) behave exactly as described earlier in this file.*

- **Item field (added):** `boardId` GUID or `null`. `null` is a sprint from before this change; Plan 4 removes them.
- **Routes (added):** `GET/POST /api/v1/boards/{boardId}/sprints` list and create a sprint on a board whose `sprintsEnabled` is true; existing `.../organizations/{orgId}/sprints/{id}` routes keep working for reads, start, complete and delete.
- **Rules:**
  - Creating a sprint on a board with `sprintsEnabled` false is refused with `422` (`sprintsNotEnabled`).
  - A sprint holds items from its own board only; an item from another board is refused with `422` (`sprintItemOnOtherBoard`).
  - Completing a sprint that has a `boardId` returns every item not in a final lane to the backlog (sprint cleared). A sprint with `boardId` null keeps the delivery-status rule above until Plan 4 retires it.

### Work board sprint header (added 2026-10-19, decided by the orchestrator under the owner's spec-and-build approval 2026-10-19; owner to review)

The Board References work board draws a sprint header (name, dates, state, tasks, ideas, days left) and a Sprint | Backlog toggle (`SPEC/mockups/comp-u-board-references-core.html`, screen 3). Nothing new is needed beyond:

- **Item field (added):** `ideaCount` integer — the number of **distinct parent ideas** among the sprint's live items that are tasks (`parentIdeaId` set), derived per read like the other counts. `0` for a sprint with no boardId.
- **Header mapping:** TASKS is `issueCount` and `doneCount` (every live card in the sprint; on a board sprint done means a final lane), IDEAS is `ideaCount`, the window and `state` come from the item, and days left is derived in the viewer's calendar. The header reads `GET /api/v1/boards/{boardId}/sprints?state=Active`.
- **Cards in a sprint** are read with `GET /api/v1/boards/{boardId}/ideas?sprintId={sprintId}` (see `contracts/ideas.md`); the **backlog** is `sprintId=none` on the same route. No new route.
- **Putting a task in a sprint** is `PUT /api/v1/ideas/{ideaId}/sprint` (`contracts/delivery.md`), which accepts any item of the sprint's board.
