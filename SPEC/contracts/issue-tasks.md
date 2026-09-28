# Contracts: issue-tasks

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Issue Task Contracts

Added 2026-09-11, Issues and Delivery Slice 1. A Task is a **checklist step on an Issue**, not a work item: no sprint of its own, no dates, no estimate, no comments, no upvotes, no tags, no nesting, and no promotion path. Anything needing one of those is an Issue, not a Task.

Nested under the Issue that owns them because a task has no life outside it and carries **no organization of its own** — every route resolves the parent idea first and authorizes against that, which keeps `ideas`' organization scoping the single enforcement point.

Authorization: reading is open to anyone who can see the Issue, `Read Only` included. Every mutation is the idea's author, any Issue assignee, or an in-scope admin — the same set that may change the Issue's delivery status. A direct Site Admin is refused every mutation.

**Task mutations are deliberately NOT audited.** This is a conscious asymmetry with every other mutation in the feature: a checklist ticked a dozen times a day would drown the audit log that exists to answer "who committed us to this work". `completedAtUtc`/`completedByUserId` on the row carry the only record that matters. The one notification anywhere in this surface is `IssueTaskAssigned` to a task's new assignee, self-suppressed — ticking a box must not page the room.

Task item shape:
- `taskId`
- `ideaId` — the parent Issue
- `title` string, max 200 characters, trimmed
- `assigneeUserId` GUID string or `null`
- `assignee` object or `null` — `userId`, `firstName`, `lastName`, `displayName`, `isActive`, `portraitDataUrl`, so a row renders a name and an avatar without a second request
- `state` string: `NotStarted`, `InProgress`, or `Done`
- `sortOrder` integer — **dense and contiguous, `0..n-1`** within the parent Issue, maintained on insert, delete and reorder
- `completedAtUtc` timestamp or `null`, `completedByUserId` GUID string or `null`

### `GET /api/v1/ideas/{ideaId}/tasks`
Purpose: An Issue's checklist in `sortOrder`.

Success response `200`: an unpaged array of the task item shape. An idea with no tasks — including one still in `Discovery` — returns `[]`.

Error responses:
- `401` caller is not authenticated
- `404` the idea does not exist, is deleted, or is outside caller scope

### `POST /api/v1/ideas/{ideaId}/tasks`
Purpose: Append a task to the end of the checklist.

Request body:
- `title` required string, max 200 characters, trimmed
- `assigneeUserId` optional GUID string or `null` — any **active user in the Issue's organization**, who **need not** be an assignee of the parent Issue. This is the one place delivery work is divided between people; constraining it to the Issue's assignees would force spurious Issue assignments just to name a helper.

Behavior:
- appends at `sortOrder = n`, and the `N of M done` rollup on the delivery card updates
- notifies a newly named assignee with `IssueTaskAssigned` (link `/ideas/{ideaId}`), self-suppressed

Success response `201`: the task item shape.

Error responses:
- `400` `title` is blank or too long; `assigneeUserId` is not an active user in this organization; **or the parent idea is still in `Discovery`** — keyed `ideaId`, `"Only a promoted idea can carry tasks."` A task list is a delivery artifact; ideas in Discovery do not have one.
- `401` caller is not authenticated
- `403` caller is not the author, an assignee, or an in-scope admin, or is a Site Admin acting directly
- `404` the idea does not exist, is deleted, or is outside caller scope

### `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}`
Purpose: Rename and/or reassign a task — the two edits the row exposes together. Full replacement of both fields.

Request body: same as create.

Only a genuinely **new** assignee is notified; re-saving a row without touching its assignee must not re-page them.

Success response `200`: the task item shape.

Error responses:
- `400` `title` is blank or too long; `assigneeUserId` is not an active user in this organization
- `401` caller is not authenticated
- `403` as for create
- `404` the idea does not exist or is outside caller scope, **or `{taskId}`'s parent is not `{ideaId}`** — `404`, never `403`, so the nested route cannot be used to probe for ideas in other organizations

### `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}/state`
Purpose: Move a task between its three states.

Request body:
- `state` required string: `NotStarted`, `InProgress`, or `Done`

Three states rather than a bare checkbox, because "started but not finished" is the state a standup actually asks about.

Behavior:
- reaching `Done` stamps `completedAtUtc` and `completedByUserId`; moving **off** `Done` clears both
- re-applying the state a task already has returns it untouched — re-stamping would quietly overwrite who actually finished it, and when
- a task's state never gates the parent Issue: it may be set to delivery `Complete` with tasks outstanding

Success response:
- `204 No Content`

Error responses:
- `400` `state` is missing or not one of the three (keyed `state`)
- `401`/`403`/`404` as for update

### `PUT /api/v1/ideas/{ideaId}/tasks/order`
Purpose: Rewrite the whole checklist's order.

Request body:
- `taskIds` required array of GUID strings, in the intended order

`taskIds` must name **each of this Issue's tasks exactly once** — no missing id, no unknown id, no duplicate. A partial reorder is rejected rather than interpreted, because every reading of a partial list ("move these to the front"? "drop the rest"?) is a guess at what the caller meant. `sortOrder` is then `0..n-1`; unmoved tasks are left untouched so a drag does not re-stamp the whole checklist, and the rewrite commits atomically so a failure cannot leave the list half-renumbered.

Success response:
- `204 No Content`

An omitted `taskIds` key is read as the empty list, which matches exactly when the Issue has no tasks (a `204` no-op) and is a `400` otherwise. A present `taskIds` that is not an array is a `400` keyed `taskIds` (`"Task Ids is invalid."`), the same rule `tagNames` and `mentionEmails` carry — reading it as absent would accept the request and silently discard an order the caller asked for.

Error responses:
- `400` the id set does not match the Issue's tasks exactly, or `taskIds` is present and not an array — keyed `taskIds`
- `401`/`403`/`404` as for update

This route is declared **before** `PUT /api/v1/ideas/{ideaId}/tasks/{taskId}`; `order` is a literal segment, not a task id.

### `DELETE /api/v1/ideas/{ideaId}/tasks/{taskId}`
Purpose: Remove a task from the checklist.

A **hard delete** — the one place in this feature that is not a soft delete. A checklist step keeps no history of its own beyond the completion stamps on the row, so there is nothing to preserve. The survivors are re-densified afterwards, so `sortOrder` stays `0..n-1`.

Success response:
- `204 No Content`

Error responses:
- `401`/`403`/`404` as for update

