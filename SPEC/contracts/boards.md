# Contracts: boards

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Board Contracts

### `GET /api/v1/organizations/{organizationId}/boards`
List boards for an organization.

- **Roles:** —
- **Request:** `includeArchived` optional boolean (default `false`; added 2026-09-27 with archiving).
- **Response:** `200`, item shape:
  - `boardId`
  - `organizationId`
  - `name`
  - `allowUserStatusUpdate` boolean
  - `swimlaneCount`
  - `ideaCount` — live ideas on the board, excluding soft-deleted ones, so it matches the `totalCount` of `GET /api/v1/boards/{boardId}/ideas`. Counts only `Discovery`-phase ideas, like that list.
  - with archiving (added 2026-09-27), each item gains `isArchived` boolean and `archivedAtUtc` timestamp or `null`

  Added 2026-09-27 (`SPEC/decisions.md`), for the richer board cards:
  - `description` string or `null`
  - `createdAtUtc` ISO 8601 UTC timestamp
  - `createdBy` — `{ userId, displayName }`, or `null` when the board records no creator or the creator no longer resolves to a user. `displayName` is `"First Last"`, as elsewhere in the API.
  - `laneCounts` — one entry per swimlane, in swimlane order, **including lanes with no ideas**:
    - `statusId`
    - `statusName`
    - `statusColor`
    - `order` integer
    - `ideaCount` integer
  - `topTags` — at most three `{ name, ideaCount }`, the tags on the most of the board's ideas; ordered by `ideaCount` descending, then `name` ascending (case-insensitive). Empty when no idea is tagged. **Added 2026-09-28:** each item also carries `color` (`#RRGGBB`, the tag's colour — "Tag Contracts" in [`contracts/tags.md`](tags.md)).
  - `tagCount` integer — distinct tags across the board's ideas
- **Errors:** —
- **Rules:**
  - Why `ideaCount` (added 2026-09-10): the boards list renders the figure on every card, and without it a client issues one idea request per board — an unbounded fan-out, since this endpoint does not page.
  - It excludes promoted Issues (corrected 2026-09-27 — it had counted them, so a board with promoted items reported more ideas than it showed).
  - Every aggregate counts the same ideas `ideaCount` does, and all are computed with a fixed number of grouped queries for the whole list, never one query per board.

Example item:

```json
{
  "boardId": "6f0c…",
  "organizationId": "1b2e…",
  "name": "Ideas",
  "allowUserStatusUpdate": true,
  "swimlaneCount": 5,
  "ideaCount": 6,
  "description": "Assembly cell reliability: fewer stoppages, safer cells, shorter cycle times.",
  "createdAtUtc": "2026-09-27T10:00:00.000Z",
  "createdBy": { "userId": "9a41…", "displayName": "Olivia Administer" },
  "laneCounts": [
    { "statusId": "…", "statusName": "New", "statusColor": "#…", "order": 0, "ideaCount": 3 },
    { "statusId": "…", "statusName": "Complete", "statusColor": "#…", "order": 4, "ideaCount": 0 }
  ],
  "topTags": [{ "name": "automation", "ideaCount": 4 }],
  "tagCount": 4
}
```

### `POST /api/v1/organizations/{organizationId}/boards`
Create a board with at least two swimlanes.

- **Roles:** —
- **Request:** body
  - `name` required string
  - `allowUserStatusUpdate` required boolean
  - `description` optional string or `null` (added 2026-09-27) — trimmed; blank or `null` stores no description
  - `swimlanes` required array of
    - `statusId` GUID string
    - `order` integer
- **Response:** `201`
  - `boardId`
  - `name`
  - `swimlanes`
- **Errors:** `description` of more than 500 characters returns `400` keyed `description`.
- **Rules:** —

### `GET /api/v1/boards/{boardId}`
Return board detail including swimlanes.

- **Roles:** —
- **Request:** —
- **Response:** `200`: `boardId`, `organizationId`, `name`, `description` (string or `null`, added 2026-09-27), `allowUserStatusUpdate`, and `swimlanes` — each `statusId`, `statusName`, `statusColor`, `order`, `statusIsDeleted`.
- **Errors:** —
- **Rules:** —

### `PUT /api/v1/boards/{boardId}`
Update board name or selected statuses.

- **Roles:** —
- **Request:** body
  - `name` required string
  - `allowUserStatusUpdate` required boolean
  - `description` optional string or `null` (added 2026-09-27) — same rules as on create. **Absent leaves the stored description unchanged**; `null` or a blank string clears it.
  - `swimlanes` required array of `statusId` and `order`
  - `ideaMoves` optional array (added 2026-09-29, `decisions.md` "Removing a lane moves its ideas") — where the ideas of each lane this save removes go. Absent or `null` is none. Each entry:
    - `fromStatusId` — a lane on the board now that this save's `swimlanes` leaves out
    - `toStatusId` — a lane in this save's `swimlanes`, so one the board keeps (a lane added by the same save counts)
- **Response:** the same shape as `GET /api/v1/boards/{boardId}`. Unchanged by `ideaMoves`.
- **Errors:**
  - as for create (the `description` rules are the same)
  - `409 Conflict` for an archived board — see archive below. Checked before `ideaMoves`.
  - `400` keyed `ideaMoves`, title `One or more fields are invalid.`, with one message per problem:
    - a removed lane that still holds ideas and has no entry: `'{status name}' still holds {n} ideas. Choose a lane that stays on the board to move them to.` (singular: `1 idea` … `move it to.`) — one message per such lane
    - `toStatusId` not among `swimlanes`: `Ideas can only move to a lane that stays on the board.`
    - `fromStatusId` not a lane this save removes: `A move must come from a lane this save removes.`
    - the same `fromStatusId` twice: `A removed lane can move its ideas to one lane only.`
- **Rules:**
  - The ideas a removal concerns are the lane's **live `Discovery` ideas** — the population `ideaCount` and `laneCounts` count. Soft-deleted ideas and promoted Issues keep their status: an Issue's ideation status is frozen at promotion for provenance (`20-feature-issues-and-delivery.md`), and a soft-deleted idea's is part of its retained record.
  - One target per removed lane, not one for the whole save, so a save that drops two lanes can send their ideas to different places; a client that wants one destination sends the same `toStatusId` for each.
  - An entry for a removed lane that holds no ideas is accepted and does nothing, so a client whose counts were stale by one removal is not refused for it.
  - The lane change and every move commit in one transaction; a refused save moves nothing. A move only takes an idea still in its `fromStatusId` at commit, so an idea someone moved out of the lane meanwhile keeps their choice.
  - Each moved idea gets an `IdeaStatusChanged` audit event in the shape a move on the board writes (`entityType` `Idea`, message `Idea '{title}' moved to a new status.`, metadata `{ fromStatusId, toStatusId }`), attributed to the administrator saving the board. The `BoardUpdated` event's metadata gains `ideaMoves: [{ fromStatusId, toStatusId, ideaCount }]` when anything moved.
  - A move sends no notification (decided by the user 2026-09-29): it is a board reconfiguration, not a decision about any one idea. `20-feature-notifications.md` trigger 4 carries the exception.

### `POST /api/v1/boards/{boardId}/archive` and `POST /api/v1/boards/{boardId}/unarchive`
Archive a board, or bring it back (added 2026-09-27; `decisions.md`). Until then boards had no delete endpoint or action; archiving replaces that absence.

- **Roles:** Org Admin of the board's organization only; a direct Site Admin is refused like every other org-content write.
- **Request:** —
- **Response:** `204 No Content`. Archiving an archived board, or unarchiving an active one, is also `204`.
- **Errors:** —
- **Rules:**
  - Archiving keeps the board, its swimlanes and every idea on it.
  - An archived board leaves the default board list and the board pickers, accepts no new ideas, and its ideas stay reachable from `GET /api/v1/organizations/{organizationId}/ideas`.
  - Its own page opens **read-only** with an *Archived* banner (Q4, answered 2026-09-27): no new ideas, no moves, no edits; an Org Admin sees *Unarchive* there.
  - **The board's own settings are frozen too** (added 2026-09-27): `PUT /api/v1/boards/{boardId}` (name, description, lanes) and the swimlane reorder are refused for an archived board with `409 Conflict` — unarchive it first. Creating an idea on it, and moving or editing one of its ideas, are refused the same way.
  - The board list gains `includeArchived`, `isArchived` and `archivedAtUtc` (see the list above).

### `POST /api/v1/boards/{boardId}/swimlanes/reorder`
Persist swimlane reorder immediately after drag-and-drop.

- **Roles:** —
- **Request:** body
  - `swimlanes` required array of
    - `statusId`
    - `order`
- **Response:** `204 No Content`
- **Errors:** `409 Conflict` for an archived board (see archive above).
- **Rules:** —
