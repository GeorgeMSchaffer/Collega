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
  - `pullItemIds` optional array of at most 100 idea ids (added 2026-10-13, slice 180, `20-feature-board-pull-in.md`) — existing items to pull onto the new board. Absent, `null` or `[]` pulls nothing.
- **Response:** `201`
  - `boardId`
  - `name`
  - `swimlanes`
  - `pulledItems` — **only when `pullItemIds` was non-empty**: an array of `{ ideaId, fromBoardId (a GUID or `null` for the pool), statusId (the status the item has now) }`, oldest item first. Absent otherwise, so a create without a pull is byte-for-byte what it was.
- **Errors:**
  - `description` of more than 500 characters returns `400` keyed `description`.
  - `400` keyed `pullItemIds`: see "Pulling items" below. Nothing is created.
- **Rules:** see "Pulling items" below.

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
  - `pullItemIds` optional array of at most 100 idea ids (added 2026-10-13, slice 180): items to pull onto this board, applied **after** `ideaMoves`. Same value rules as on create; see "Pulling items".
  - `ideaMoves` optional array (added 2026-09-29, `decisions.md` "Removing a lane moves its ideas") — where the ideas of each lane this save removes go. Absent or `null` is none. Each entry:
    - `fromStatusId` — a lane on the board now that this save's `swimlanes` leaves out
    - `toStatusId` — a lane in this save's `swimlanes`, so one the board keeps (a lane added by the same save counts)
- **Response:** the same shape as `GET /api/v1/boards/{boardId}`, plus `pulledItems` (as on create) when `pullItemIds` was non-empty. Unchanged by `ideaMoves`.
- **Errors:**
  - as for create (the `description` rules are the same)
  - `409 Conflict` for an archived board — see archive below. Checked before `ideaMoves` and `pullItemIds`, so an archived board takes no pull.
  - `400` keyed `pullItemIds`: see "Pulling items" below. Nothing is changed, including the lane change.
  - `400` keyed `ideaMoves`, title `One or more fields are invalid.`, with one message per problem:
    - a removed lane that still holds ideas and has no entry: `'{status name}' still holds {n} ideas. Choose a lane that stays on the board to move them to.` (singular: `1 idea` … `move it to.`) — one message per such lane
    - `toStatusId` not among `swimlanes`: `Ideas can only move to a lane that stays on the board.`
    - `fromStatusId` not a lane this save removes: `A move must come from a lane this save removes.`
    - the same `fromStatusId` twice: `A removed lane can move its ideas to one lane only.`
    - a planned card no longer in its `fromStatusId` at commit, when `toStatusId` is an `autoCreateTask` lane (decided 2026-10-16): `'{title}' is no longer in that lane.` Only the first such card is named.
- **Rules:**
  - The ideas a removal concerns are the lane's **live `Discovery` ideas** — the population `ideaCount` and `laneCounts` count. Soft-deleted ideas and promoted Issues keep their status: an Issue's ideation status is frozen at promotion for provenance (`20-feature-issues-and-delivery.md`), and a soft-deleted idea's is part of its retained record.
  - One target per removed lane, not one for the whole save, so a save that drops two lanes can send their ideas to different places; a client that wants one destination sends the same `toStatusId` for each.
  - An entry for a removed lane that holds no ideas is accepted and does nothing, so a client whose counts were stale by one removal is not refused for it.
  - The lane change and every move commit in one transaction; a refused save moves nothing. A move only takes an idea still in its `fromStatusId` at commit, so an idea someone moved out of the lane meanwhile keeps their choice. **Exception (decided 2026-10-16):** when the move's `toStatusId` is an `autoCreateTask` lane, the save is refused as a whole with `400` keyed `ideaMoves` and `'{title}' is no longer in that lane.` if any planned card is no longer in its `fromStatusId` at commit, so a card cannot reach a hand-off lane without its task; nothing is changed. Moves into ordinary lanes keep the silent skip.
  - Each moved idea gets an `IdeaStatusChanged` audit event in the shape a move on the board writes (`entityType` `Idea`, message `Idea '{title}' moved to a new status.`, metadata `{ fromStatusId, toStatusId }`), attributed to the administrator saving the board. The `BoardUpdated` event's metadata gains `ideaMoves: [{ fromStatusId, toStatusId, ideaCount }]` when anything moved.
  - A move sends no notification (decided by the user 2026-09-29): it is a board reconfiguration, not a decision about any one idea. `20-feature-notifications.md` trigger 4 carries the exception.

### Pulling items (`pullItemIds`, added 2026-10-13, slice 180)
`POST …/boards` and `PUT …/boards/{boardId}` file existing items onto the board in the same save (`20-feature-board-pull-in.md` rules 9 to 18).

- **Eligible** (rule 10): an item of the caller's organization, not deleted, **with no parent (a task is never eligible; decided 2026-10-16)**, that is a Discovery idea with no board; a Discovery idea on another board, live or archived; or a backlog Issue (Delivery phase, no sprint). **Never the board's own ideas** — naming one on `PUT` is refused, and so is an Issue already on that board. An Issue in a sprint is refused.
- **Rights** (rule 11), evaluated against the effective role (the target's, through View As): an **Org Admin** may pull anything eligible; a **User** only Discovery ideas they authored (so in practice only on create, because `PUT` is Org Admin only); **Issues are Org Admin only**. Read Only cannot create a board (`403`, unchanged) and a direct Site Admin is refused every board write (`403`, unchanged).
- **Refusal** (rule 12): `400`, title `One or more fields are invalid.`, keyed `pullItemIds`, nothing saved — a new board is not created, an edit changes nothing (not even its lanes). A malformed request (the cap, a non-array, the first malformed id, a repeated id) reports one message; the per-item problems below (not found, no longer available, already on the board, in a sprint, a task, waiting on open tasks, rights) are all reported together, one message each, naming the item by title:
  - more than 100 ids: `At most 100 items can be pulled in one save.`
  - not an array of ids (any other JSON value, or a non-string entry): `Pull item ids must be an array of ids.`
  - an entry that is not a GUID: `'{value}' is not a valid item id.`
  - the same id twice: `An item can be named only once.`
  - no such item, or one in another organization: `Item '{id}' was not found.`
  - deleted, or gone/moved/promoted between the picker and the commit: `'{title}' is no longer available.`
  - already on this board: `'{title}' is already on this board.`
  - in a sprint: `'{title}' is in a sprint, so it cannot be pulled. Move it back to the backlog first.`
  - a task, meaning an item with a parent (added 2026-10-16): `'{title}' is a task, so it cannot be pulled. Tasks stay on their parent's reference board.` Not overridable by `forceReason`.
  - an Issue, for a User: `'{title}' is an issue, and only an Org Admin can pull issues.`
  - in a reference lane with open tasks (added 2026-10-16): `'{title}' is waiting on {n} open tasks, so it cannot be pulled.` An Org Admin may override with a non-empty `forceReason` on the request (`403` for anyone else); audited as `IdeaMovedPastOpenTasks`.
  - an idea a User did not author: `You can pull only ideas you created; '{title}' was created by someone else.`
- **Auto-create** (decided 2026-10-16): a pulled item placed in an `autoCreateTask` lane gets its one task in this same transaction; a failure fails the whole save. The same holds for an item an `ideaMoves` entry sends into such a lane. **First entry only (amended 2026-10-19):** an item that already has at least one task on the referenced board gets none, in any lane, so a card moved back into the lane does not get a second automatic task.
- **Placement** (rule 13): the lanes are those this same save leaves — after any lane removal and its `ideaMoves` on a `PUT`. An item whose status is a lane keeps it; any other lands in the board's leftmost lane and takes that lane's status. The model has no card position, so cards in a lane are ordered by the list sort as before; a pull neither adds nor changes a position, and the response and the audit list items oldest first.
- **Backlog Issues** (rule 14): returned to Discovery first (delivery status and sprint cleared; effort, the promotion snapshot and tasks kept), then placed. The archived-board refusal of the standalone `return-to-discovery` does not apply: the Issue is leaving that board.
- **One commit** (rule 16): the board, its lanes, `ideaMoves` and every pulled item commit in one transaction. Each item is written only if it is still as it was read (board, status, phase, sprint), so one that changed in between fails the whole save with the `'{title}' is no longer available.` refusal above. `updated_at_utc` and `updated_by_user_id` are stamped on each item. **No notification is sent and followers are unchanged** (rule 15).
- **Audit** (rule 18). The board's own event, `BoardCreated` or `BoardUpdated`, gains metadata `pulledItemCount` and `returnedIssueCount` **only when items were pulled**. Then, per pulled item, all attributed to the real user with a View As target as on-behalf-of: `IdeaBoardChanged` (`entityType` `Idea`, message `Idea '{title}' pulled onto board '{board name}'.`, metadata `{ fromBoardId (or null), toBoardId }`); `IdeaStatusChanged` when placement changed the status (message `Idea '{title}' moved to a new status.`, metadata `{ fromStatusId, toStatusId }`); `IssueReturnedToDiscovery` for a returned Issue (message `Issue '{title}' returned to discovery.`, metadata `{ previousSprintId }`). The audit writer commits on its own after the transaction, as for every other event (`PrismaAuditEventWriter`), so a failure after the commit can lose entries but never the pull.

### Allowed idea types (added 2026-10-22, slice 318)

`SPEC/decisions.md` "A board can limit which idea types it takes"; `20-feature-boards-and-statuses.md` rule 15. The read flag, the audit shape and the import rule were confirmed by the owner 2026-10-22.

- **Reads.** `GET /api/v1/boards/{boardId}` gains:
  - `allowedIdeaTypeIds` — an array of idea type ids, in idea type sort order; `[]` means every active type is allowed. An archived type is left out, so a list of only archived types reads `[]` (decided 2026-10-22).
  - `canSetAllowedIdeaTypes` — boolean, for the caller: true for an Org Admin, or for the board's creator while an active User or Org Admin; false otherwise and on an archived board.
- **Create.** `POST …/boards` accepts optional `allowedIdeaTypeIds` (absent, `null` or `[]`: all types), checked as below.
- **`PUT /api/v1/boards/{boardId}/allowed-idea-types`**
  - **Roles:** an Org Admin of the board's organization, or the board's creator while an active User or Org Admin there; a Site Admin through View As, acting as the target. Anyone else `403`; Read Only `403`.
  - **Request:** `{ "ideaTypeIds": [ … ] }` — replaces the whole list; `[]` allows every type.
  - **Response:** `200` with the board detail shape.
  - **Errors:** `404` for a board the caller cannot read; `409` for an archived board; `400` keyed `ideaTypeIds`, title `One or more fields are invalid.`: not an array of GUIDs (`Idea type ids must be an array of ids.`), the same id twice (`An idea type can be named only once.`), an id that is not an active idea type of the organization (`Idea type '{id}' was not found.`).
  - **Rules:** accepted while Idea features are off (the list is stored, not applied). Ideas on the board are not touched. Audited as `BoardUpdated` (decided 2026-10-22), its metadata gaining `allowedIdeaTypeIds` with the new list; no separate event. No notification.
- **Where it is enforced** (only while the board's Idea features are on and its list is non-empty):
  - `POST /api/v1/boards/{boardId}/ideas` and `PUT /api/v1/ideas/{ideaId}` (when `ideaTypeId` changes on an idea that is on a board): `400` keyed `ideaTypeId`, `This board doesn't take '{type name}' ideas.` An edit that keeps a no-longer-allowed type is accepted.
  - `PUT /api/v1/organizations/{organizationId}/ideas/{ideaId}/idea-type` (the admin reassign, decided 2026-10-22): the same `400` keyed `ideaTypeId`, checked after the active-type check; reassigning to the current type is still a no-op.
  - `pullItemIds` on create and update: `400` keyed `pullItemIds`, `'{title}' is a {type name} idea, and this board doesn't take those.` Nothing is saved, as for every pull refusal.
  - `POST /api/v1/boards/{boardId}/ideas/import`: a row of a disallowed type is refused with the importer's per-row error, `This board doesn't take '{type name}' ideas.`; the other rows import.
  - Auto-created tasks are never checked, so a hand-off into an `autoCreateTask` lane is never refused for its type.

### Board access (proposed 2026-10-26, slice 348)

`SPEC/20-feature-board-access-and-groups.md` BAG-2 to BAG-4; `SPEC/decisions.md` 2026-10-26 "A board can be Restricted to named users and groups". Not built. Groups: [`contracts/groups.md`](groups.md).

- **Who can see a board.** An Org Admin of its organization; a Site Admin acting directly; anyone when its `visibility` is `Organization`; and, when it is `Restricted`, its creator and every user on its access list directly or through a group. Membership is read on each request. A Site Admin in View As sees what the target sees. This one rule governs every route in every contract file: for a caller who cannot see a board, the board and every item on it (idea, Issue, task) answer as if they did not exist.
- **Reads.**
  - `GET …/boards` lists only boards the caller can see; each item gains `visibility` (`Organization` or `Restricted`).
  - `GET /api/v1/boards/{boardId}` gains `visibility`; `accessUserIds` and `accessGroupIds` (arrays, stored even while `Organization`, `[]` when none); and `canManageAccess` — true for an Org Admin, or for the board's creator while an active User or Org Admin; false otherwise and on an archived board.
- **Create.** `POST …/boards` accepts optional `visibility` (default `Organization`), `accessUserIds` and `accessGroupIds` (default `[]`), checked as below. Any caller who may create a board may set them, since they become its creator.
- **`PUT /api/v1/boards/{boardId}/access`**
  - **Roles:** an Org Admin of the board's organization, or the board's creator while an active User or Org Admin there; a Site Admin through View As, acting as the target. Anyone else who can see the board `403`; Read Only `403`.
  - **Request:** `{ "visibility": "Organization" | "Restricted", "userIds": [ … ], "groupIds": [ … ] }` — replaces the whole setting.
  - **Response:** `200` with the board detail shape.
  - **Errors:** `404` for a board the caller cannot see; `409` for an archived board; `400` keyed `visibility` (`Visibility must be Organization or Restricted.`); `400` keyed `userIds` / `groupIds`, title `One or more fields are invalid.`: not an array of GUIDs (`User ids must be an array of ids.` / `Group ids must be an array of ids.`), the same id twice (`A user can be named only once.` / `A group can be named only once.`), an id not of the board's organization (`User '{id}' was not found.` / `Group '{id}' was not found.`).
  - **Rules:** a Restricted board with both lists empty is accepted (only Org Admins and the creator see it). Switching to `Organization` keeps the lists, which then grant nothing. Ideas are not touched. Audited as `BoardAccessChanged`, metadata `{ fromVisibility, toVisibility, addedUserIds, removedUserIds, addedGroupIds, removedGroupIds }`; no event when nothing changed. No notification.
- **Where the rule applies to a caller who cannot see board B** (BAG-4):
  - Every route addressing B, or an item on B, by id — read or write: `404`, never `403`. That includes comments, upvotes, following, fields, metrics, dependencies, issue tasks, delivery, status and board moves, and `ideas/{ideaId}/board-tasks`.
  - Every list, search, count and total leaves B's items out: the Ideas list, Home, the notification inbox and unread count, the Backlog, `/tasks`, sprints and sprint planning, the Roadmap and Outcome totals, `pull-candidates`, `ideas/export`, and `GET …/boards`' counts.
  - A Board References lane referencing B shows none of B's cards, and its counts leave them out. Setting `referencesBoardId` to B is `400` keyed `referencesBoardId`, worded as for an unknown board.
  - Moving an idea to B, pulling into or from B, and naming B in a CSV import row are refused as for an unknown board.
  - For an idea on a Restricted board, `mention-candidates` and the assignee picker list only users who can see that board; naming any other user is `400` keyed `mentionEmails` / `assigneeIds` (`'{name}' can't see this board.`).
  - Notification events about B's items are kept but not listed or counted for a user who cannot see B at read time.

### `GET /api/v1/organizations/{organizationId}/boards/pull-candidates`
The pull picker's read (added 2026-10-13, slice 180). One tab per `source`; each is searchable by title and filterable by tag and author, within the caller's organization. The organization idea list cannot carry it: it has no "not on board X" and no way to list Issues with no sprint, so this is a dedicated read as `20-feature-board-pull-in.md` allowed.

- **Roles:** the roles that may create a board — an Org Admin or a User of the organization (a Site Admin through View As as the target). Read Only and a direct Site Admin are `403`; another organization is `404`. **Scoped to what the caller may pull**: a User sees only Discovery ideas they authored and asking for `backlog` is `403` (`Only an Org Admin can pull backlog issues.`); an Org Admin sees everything eligible.
- **Request:** query
  - `source` required: `unassigned` (live Discovery ideas with no board), `boards` (live Discovery ideas on a board, live or archived) or `backlog` (Delivery-phase Issues with no sprint). Anything else, or absent, is `400` keyed `source`.
  - `excludeBoardId` optional GUID — the board being edited; its own items are never offered (an Issue on it included). A value that is not a GUID matches nothing excluded.
  - `search` optional — case-insensitive substring of the title
  - `tag` optional, repeatable — tag names, any-of
  - `authorUserId` optional GUID — for a User it is ignored: their own ideas only
  - `page`, `pageSize` — the standard paging (default 20, 1–100)
- **Response:** `200`: `{ items, page, pageSize, totalCount }`, oldest first, then title, then id. Each item: `ideaId`, `title`, `authorUserId`, `authorName`, `boardId` and `boardName` (`null` in the pool), `statusId`, `statusName`, `phase`, `tags` (names, alphabetical), `priority`, `upvoteCount`, `isMine`.
- **Response addition (confirmed by the owner, 2026-10-19):** `hiddenTaskCount` integer beside `items`: how many live tasks (items with a parent) match the same `source`, `excludeBoardId`, `search`, `tag` and `authorUserId` filters and are therefore withheld. The UI shows "N tasks are hidden" only when `search` is set and the count is above 0.
- **Errors:** `400` (`source`), `401`, `403`, `404`.
- **Rules:** items with a parent are never offered (decided 2026-10-16). A read only. The list can be stale by the time the form is saved; `pullItemIds` is checked again then.

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

## Board References (planned 2026-10-15)

*Specified in `SPEC/20-feature-board-references.md`. Not built until Plan 2. Existing routes keep their shapes; the fields below are added.*

- **Board item fields (added):**
  - `keyPrefix` string or `null`, 2 to 10 characters `A-Z0-9`, upper-cased on store; unique per organization among boards that have one. On create, an omitted `keyPrefix` is derived from the name: the initials, or the first two letters for a one-word name, with a number appended on a clash (`CI`, `CI2`). The board form no longer asks for it (2026-10-21).
  - `sprintsEnabled` boolean, default `false`.
  - `ideaFeaturesEnabled` boolean, default `true`; default `false` for a board when it is first named as a reference target.
- **Lane item fields (added) on every lane in a board read and write.** The lane-save routes that carry `isFinal` and `referencesBoardId` are `PUT /api/v1/boards/{boardId}`, `POST /api/v1/organizations/{organizationId}/boards` and `POST /api/v1/boards/{boardId}/swimlanes/reorder`:
  - `isFinal` boolean, default `false`. A board may have several final lanes.
  - `referencesBoardId` GUID or `null`: the board whose tasks this lane hands work to.
  - `autoCreateTask` boolean, default `false`: the first entry into the lane (a status move, a pull with `pullItemIds`, a bulk lane move with `ideaMoves`; decided 2026-10-16, limited to the first entry 2026-10-19) creates one task on the referenced board, in the same transaction; a failure rolls the write back. An entry by an idea that already has a task on the referenced board (any lane) creates none. Setting it on a lane with no `referencesBoardId` is `422` `autoCreateTaskRequiresReference`.
- **Read fields (added 2026-10-19, slice 292):** the board detail (`GET /api/v1/boards/{boardId}`, and the `PUT` result) and each list item carry `nextItemNumber`, an integer: the number the next item key takes, so `1` means no key has been issued and keys `1` to `nextItemNumber - 1` exist. A client shows "Keys CI-1 to CI-N have been issued" (N = `nextItemNumber - 1`) beside a locked `keyPrefix`. Each list item also carries, so a client need not read every other board to resolve reference choices:
  - `hasReferenceLane` boolean: the board has at least one lane with `referencesBoardId` set.
  - `referencedByBoardIds` array of GUIDs: the non-archived boards with a lane that references this board; `[]` when none. Computed from the lanes the list already loads, with no per-board query.
- **Rules:**
  - A lane may not reference its own board.
  - **A Final lane cannot reference a board (decided 2026-10-19):** saving a lane with `isFinal` true and `referencesBoardId` set is `422` `finalLaneCannotReference`; so is turning an existing reference lane Final without clearing its reference. The Statuses page disables the reference selector on a Final lane.
  - A board that is the target of a reference may not itself contain a reference lane, and a board with a reference lane may not be a target (one level at launch).
  - A lane with ideas in it cannot have `referencesBoardId` changed or removed, and cannot be removed.
  - A board named as a reference target cannot be archived while a lane references it.
  - Saving lanes with `referencesBoardId` set to a board outside the organization, an archived board, or a missing board is refused with `422` `referencesBoardInvalid`.
  - `keyPrefix` can change only while no item key has been issued on the board; afterwards `422` `keyPrefixLocked`. A `keyPrefix` already used by another board in the organization is `409` `keyPrefixTaken`.
  - The archive-while-referenced rule is `422` `referenceTargetArchived`, the only archive error with that status; the existing archive conflicts stay `409`.
- **Errors:** `422` for each rule above, using the shared error model; message keys named after the rule (`laneReferencesOwnBoard`, `referenceChainNotAllowed`, `laneInUse`, `referenceTargetArchived`, `referencesBoardInvalid`, `finalLaneCannotReference`), plus `keyPrefixLocked` (`422`) and `keyPrefixTaken` (`409`).
