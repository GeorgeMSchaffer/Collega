# Contracts: delivery

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Delivery Contracts

Added 2026-09-11, Issues and Delivery Slice 1 (`SPEC/20-feature-issues-and-delivery.md`).

Section-wide rules:
- **An Issue is not a new resource** — it is the same `ideas` row in its `Delivery` phase, so every route below addresses an idea by its existing `{ideaId}` and there is no `/issues` root.
- The Slice 2 Outcome and Roadmap routes are deliberately absent; nothing here carries an `outcomeId`.
- Two refusals are distinct on purpose and must not be collapsed:
  - **`409`** — the item is in the wrong phase *for the phase transition itself*: promoting something already in `Delivery`, or returning something already in `Discovery`. Nothing to fix in the request; the item has already reached the state being asked for.
  - **`400`** — a *delivery operation* on a `Discovery` item (delivery status, sprint assignment, tasks). The request names a field that has no meaning until the item is promoted, and the response is field-keyed like any other invalid field.
- **A `sprintId` in a request body is a `400`, never a `404`.** The route addresses the idea, which exists; the sprint is a value in the body, so an unknown, deleted, cross-organization or malformed id is a field-keyed validation failure keyed `sprintId`, exactly as an unknown `ideaTypeId` is on `PUT /api/v1/ideas/{ideaId}`. Only the path id decides between `200` and `404`.
- Cross-organization access answers `404` throughout, never `403` — confirming that a sprint, Issue or task exists in somebody else's organization is the thing a prober is fishing for.
- **A Site Admin acting directly is refused every mutation here with `403`**, and reads it all with `200`. Promotion, delivery status, sprint management and tasks are organization content under `SPEC/20-feature-view-as.md` rules 25/25c; View As is the path, and while a View As session is live the effective role is the target's, so the guard does not fire.

**Comp R's Sprint board and Roadmap (2026-09-28) — what these contracts do and do not cover.**
`SPEC/20-feature-issues-and-delivery.md` "Comp R iteration" is the screen spec.
- **The Sprint board needs nothing new.** Its strip is derived from the sprint item and the delivery cards (`issueCount`/`doneCount`, the window, days past end in the viewer's calendar); moving uses `PUT /ideas/{ideaId}/delivery-status`; *Complete sprint* uses `POST /organizations/{organizationId}/sprints/{sprintId}/complete`; the effort bar reads the card's `effort`; tag chips read the card's `tags` (added 2026-09-28 to the board idea item, `GET /api/v1/boards/{boardId}/ideas` in [`contracts/ideas.md`](ideas.md)).
- **Gap: issue keys.** Comp R labels Issues `IDE-01`; there is no key or reference field anywhere in this document and none is added (see `GET /api/v1/ideas/{ideaId}`, "no `reference` field").
- **Plan next sprint** uses the existing `POST /organizations/{organizationId}/sprints`, and **Start sprint** the existing `POST /organizations/{organizationId}/sprints/{sprintId}/start` — nothing new.
- **The Issue drawer** reads the delivery card, `GET /ideas/{ideaId}` and `GET /ideas/{ideaId}/tasks`; for a deep link, and for `/delivery/issues/{ideaId}`, the card comes from the **one addition**, `GET /api/v1/ideas/{ideaId}/delivery` (added 2026-09-28, below).
- **The Roadmap in Sprint 11 needs nothing new either**: its sprint rows read `GET /organizations/{organizationId}/sprints`, and its empty state counts delivery cards.
- **Gap, for a later sprint: Outcomes and the roadmap read** (answered 2026-09-28: Sprint 11 builds the screen, not the backend). The Slice 2 routes remain absent. When they are written here, the Roadmap as comp R draws it needs, beyond the routes `20-feature-issues-and-delivery.md` already lists:
  - an Outcome `color` (any `#RRGGBB`, as for tags, with the bar label's contrast computed — see the Outcome entity);
  - a roadmap read that returns **every** Outcome with its window, colour, derived counts, derived sprint span and grouped Issues (title, delivery status, effort, assignees) in one request, with **no** `granularity` parameter (the client draws Weeks, Months or Quarters);
  - a way for the Outcome form to set the grouping of several Issues in one save (either `issueIds` on the Outcome write or one `PUT /ideas/{ideaId}/outcomes` per change — that slice decides and writes it here).
  - The `outcomes.color` column comes with that slice's own schema amendment.

### `POST /api/v1/ideas/{ideaId}/promote`
The promotion gate — the explicit, audited decision that flips an idea from `Discovery` to `Delivery`. The row, its ideation `statusId`, its upvotes, its tags and its whole comment thread are retained; nothing is copied and no second object is created.

- **Roles:** the idea's author, or an in-scope admin. A direct Site Admin is refused.
- **Request:** body
  - `effort` **required** string: `Low`, `Medium`, or `High`. There is no default — choosing the size is the point of the gate.
  - `sprintId` optional GUID string or `null` — the sprint to promote into. `null` or omitted promotes straight to the delivery backlog. Must name a non-`Completed` sprint in the idea's organization.
  - `note` optional string — free text recorded on the promotion audit event only. It is **not** stored on the idea and is not returned by any read.
- **Response:** `204 No Content`
- **Errors:**
  - `400` `effort` is missing or not one of the three values (keyed `effort`); `sprintId` names no assignable sprint in this organization, or names a `Completed` one (keyed `sprintId`)
  - `401` caller is not authenticated
  - `403` caller is neither the author nor an in-scope admin, or is a Site Admin acting directly
  - `404` idea does not exist, is deleted, or is outside caller scope
  - `409` the idea is already in `Delivery` — `"This idea is already in delivery."`
- **Rules:**
  - sets `phase` to `Delivery` and `deliveryStatus` to `Pending`, and records `effort`, `promotedAtUtc`, `promotedByUserId`, and an `upvoteCountAtPromotion` snapshot read at this moment
  - the ideation `statusId` is **never cleared** — it is frozen at its last Discovery value for provenance, and ideation `Complete` and delivery `Complete` remain distinct terminal states
  - writes an `IdeaPromotedToIssue` audit event and an `IdeaPromoted` notification to the author and assignees, self-suppressed
  - the item leaves the ideation board (which filters to `Discovery`) and appears on the sprint board or backlog
  - Authorization is evaluated **before** the phase check, so an unauthorized caller gets `403` even when the item is already promoted: a caller who may not promote must not learn the item's phase.

### `POST /api/v1/ideas/{ideaId}/return-to-discovery`
Recover a mis-promotion. Deliberately reversible rather than prevented by a stronger confirm.

- **Roles:** in-scope admin only — not the author. A direct Site Admin is refused.
- **Request:** body: none.
- **Response:** `204 No Content`
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` idea does not exist, is deleted, or is outside caller scope
  - `409` the idea is already in `Discovery` — `"This idea is not in delivery."`
- **Rules:**
  - sets `phase` back to `Discovery` and clears `sprintId` and `deliveryStatus`
  - **retains** `effort`, the promotion snapshot (`promotedAtUtc`, `promotedByUserId`, `upvoteCountAtPromotion`) and the Issue's **tasks**, so a re-promote is lossless and the audit trail stays coherent. Tasks are hidden with the checklist, never deleted.
  - writes an `IssueReturnedToDiscovery` audit event. No notification.
  - the item reappears on its ideation board at the `statusId` it was frozen at

### `PUT /api/v1/ideas/{ideaId}/delivery-status`
Move an Issue between the five fixed delivery statuses — the sprint board's swimlanes.

- **Roles:** the idea's author, any Issue assignee, or an in-scope admin. A direct Site Admin is refused. `Read Only` is refused.
- **Request:** body
  - `deliveryStatus` required string: `Pending`, `Scoping`, `Development`, `Review`, or `Complete`. The set is fixed in this slice and not org-configurable.
- **Response:** `204 No Content`
- **Errors:**
  - `400` `deliveryStatus` is missing or not one of the five (keyed `deliveryStatus`); **or the idea is still in `Discovery`** — keyed `deliveryStatus`, `"A delivery status applies only to a promoted idea."` This is a `400` and not the `409` a wrong-phase promotion gets: see the section preamble.
  - `401` caller is not authenticated
  - `403` caller is not the author, an assignee, or an in-scope admin, or is a Site Admin acting directly
  - `404` idea does not exist, is deleted, or is outside caller scope
- **Rules:**
  - **any status may follow any other.** The board is a kanban and dragging backwards is a normal correction, not an invariant violation.
  - **outstanding tasks never block `Complete`.** The UI warns; the API permits. Enforcing "all tasks done" would make the checklist a gate, which this feature explicitly refuses.
  - re-applying the status the Issue already has is a no-op: no audit event, no notification
  - otherwise writes an `IssueDeliveryStatusChanged` audit event and a notification of the same name to the author and assignees, self-suppressed

### `PUT /api/v1/ideas/{ideaId}/sprint`
Pull an Issue into a sprint, or return it to the delivery backlog.

- **Roles:** in-scope admin only in this slice. A direct Site Admin is refused.
- **Request:** body
  - `sprintId` required GUID string **or `null`** — `null` means the delivery backlog. The target must be a non-`Completed` sprint in the idea's organization.
- **Response:** `204 No Content`
- **Errors:**
  - `400` `sprintId` names no assignable sprint in this organization, or names a `Completed` one — `"A completed sprint cannot take new issues."` (keyed `sprintId`); **or the idea is still in `Discovery`** — keyed `sprintId`, `"Only a promoted idea can be assigned to a sprint."`
  - `401` caller is not authenticated
  - `403` caller is not an in-scope admin, or is a Site Admin acting directly
  - `404` idea does not exist, is deleted, or is outside caller scope
- **Rules:**
  - assigning the sprint the Issue is already in is a no-op: no audit event
  - otherwise writes an `IssueSprintAssignmentChanged` audit event. No notification — sprint membership is a planning decision, not something to page the room about.

### `GET /api/v1/organizations/{organizationId}/delivery`
The sprint board and the delivery backlog — `Delivery`-phase items as cards.

- **Roles:** readable by **every** member of the organization, `Read Only` included.
- **Request:** query parameters
  - `sprintId` optional GUID — the sprint whose Issues to return. **Omitting it reads the BACKLOG** (`Delivery` items with no sprint), not every delivery item: that is the list an admin pulls from, and "everything" is not a view this feature has. A value that is not a canonical GUID applies a filter that matches nothing and returns an empty list rather than a `400` (the same deliberate divergence `statusId` carries on the board list).
  - `deliveryStatus` optional — `Pending`, `Scoping`, `Development`, `Review`, or `Complete`. An unrecognised value is ignored rather than refused, matching the board list's other optional filters.
- **Response:** `200`: an **unpaged** array (a sprint is a bounded, human-sized set) of the `GET /api/v1/boards/{boardId}/ideas` item shape plus:
  - `phase` string — always `Delivery` for this endpoint
  - `effort` string or `null`: `Low`, `Medium`, `High`
  - `deliveryStatus` string or `null`
  - `sprint` object or `null`: `sprintId`, `name`, `startDate`, `endDate`
  - `taskSummary` object: `{ done, total }`. `done` counts only `Done` tasks — `InProgress` is explicitly not half a point, because a task count must not become a velocity proxy.
  - `provenance` object: `promotedAtUtc`, `promotedByUserId`, `promotedByDisplayName`, `upvoteCountAtPromotion`, each nullable. `upvoteCountAtPromotion` sits beside the card's live `upvoteCount` deliberately — "42 upvotes when we committed, 61 now" is a more useful fact than either number alone.
- **Errors:**
  - `401` caller is not authenticated
  - `404` the organization does not exist or is outside caller scope
- **Rules:** —

### `GET /api/v1/ideas/{ideaId}/delivery`
Added 2026-09-28 (the user's decision; `SPEC/decisions.md` 2026-09-28). One Issue's delivery card, for the Issue drawer's deep link and `/delivery/issues/{ideaId}`. Until now the only way to read one was to list every sprint and the backlog and search them.

- **Roles:** the same as `GET /api/v1/organizations/{organizationId}/delivery` — every member of the Issue's organization, `Read Only` included; a Site Admin reads it directly.
- **Request:** —
- **Response:** `200`: exactly one item of the delivery card shape from `GET /api/v1/organizations/{organizationId}/delivery` (the board idea item plus `phase`, `effort`, `deliveryStatus`, `sprint`, `taskSummary`, `provenance`, and since 2026-09-28 `tags`), composed by the same code, so the card cannot differ between the list and this read.
- **Errors:**
  - `401` caller is not authenticated
  - `404` no such idea; the idea is soft-deleted; it is in `Discovery` (not an Issue); or it is outside caller scope — never `403`, as throughout this section. A malformed id is `404` too.
- **Rules:** Like every route in this section it addresses the idea by its `{ideaId}`: an Issue is the `ideas` row in its `Delivery` phase, not a new resource.
