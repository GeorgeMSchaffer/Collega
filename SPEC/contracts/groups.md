# Contracts: groups

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Group Contracts

Proposed 2026-10-26 (`SPEC/20-feature-board-access-and-groups.md` BAG-1; `SPEC/decisions.md`
2026-10-26, "A board can be Restricted to named users and groups"). Not built. A group is a named set
of an organization's users; its only use is a board's access list (`contracts/boards.md` "Board
access").

Shared rules for every route below:

- **Reads** are open to every member of the organization (User and Read Only included) and to a
  Site Admin acting directly.
- **Changes** are an Org Admin of the organization's, or a Site Admin through View As acting as the
  target. Anyone else `403`; a Site Admin acting directly `403`.
- A group of another organization, or one that does not exist, is `404`.
- Validation failures are `400`, title `One or more fields are invalid.`, keyed by field.

### `GET /api/v1/organizations/{organizationId}/groups`
List the organization's groups.

- **Roles:** any member; a Site Admin acting directly.
- **Request:** —
- **Response:** `200`, array ordered by `name` (case-insensitive); item shape:
  - `groupId`
  - `organizationId`
  - `name`
  - `description` string or `null`
  - `memberCount` integer
  - `boardCount` integer — Restricted boards whose access list names the group, counted only among
    boards the caller can see
- **Errors:** `401`; `404` organization does not exist or is outside the caller's scope.
- **Rules:** a plain array, no pagination.

### `POST /api/v1/organizations/{organizationId}/groups`
Create a group.

- **Roles:** Org Admin; Site Admin through View As.
- **Request:** body
  - `name` required string, trimmed, 1–100 characters
  - `description` optional string or `null`, at most 500 characters; blank is stored as `null`
  - `userIds` optional array of user ids, the initial members; absent or `[]` is none
- **Response:** `201`, the detail shape below.
- **Errors:**
  - `400` keyed `name`: missing or blank — `Group name is required.`; over 100 characters —
    `Group name must be 100 characters or fewer.`; matches an existing group's name, trimmed and
    case-insensitive — `A group with this name already exists.`
  - `400` keyed `description`: over 500 characters — `Description must be 500 characters or fewer.`
  - `400` keyed `userIds`: not an array of GUIDs — `User ids must be an array of ids.`; the same id
    twice — `A user can be named only once.`; an id that is not a user of the organization —
    `User '{id}' was not found.`
- **Rules:** audited as `GroupCreated`, metadata `{ name, userIds }`.

### `GET /api/v1/groups/{groupId}`
Return one group with its members.

- **Roles:** any member of the group's organization; a Site Admin acting directly.
- **Request:** —
- **Response:** `200`:
  - `groupId`, `organizationId`, `name`, `description`
  - `members` — array ordered by last name, then first name: `userId`, `firstName`, `lastName`,
    `email`, `role`, `status`. Every status is listed, so an Inactive member stays visible.
  - `boards` — the Restricted boards whose access list names the group and that the caller can see:
    `boardId`, `name`, `isArchived`
  - `canManage` boolean — true for the caller who may change it
- **Errors:** `401`; `404`.

### `PUT /api/v1/groups/{groupId}`
Rename or re-describe a group.

- **Roles:** Org Admin; Site Admin through View As.
- **Request:** body `name` required, `description` optional (absent leaves it unchanged; `null` or
  blank clears it). Same rules as create.
- **Response:** `200`, the detail shape.
- **Errors:** as for create, keyed `name` and `description`; `404`.
- **Rules:** audited as `GroupUpdated`, metadata `{ name, description }` with old and new values.

### `PUT /api/v1/groups/{groupId}/members`
Replace a group's members.

- **Roles:** Org Admin; Site Admin through View As.
- **Request:** body `userIds` required array — the whole new membership; `[]` empties the group.
- **Response:** `200`, the detail shape.
- **Errors:** `400` keyed `userIds` as for create; `404`.
- **Rules:**
  - Takes effect on each member's next request, on every board the group is on; no board is written.
  - Audited as `GroupMembersChanged`, metadata `{ addedUserIds, removedUserIds }`. No audit event when
    nothing changed. No notification.

### `DELETE /api/v1/groups/{groupId}`
Delete a group.

- **Roles:** Org Admin; Site Admin through View As.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** `404`.
- **Rules:**
  - A hard delete: the memberships and every board grant naming the group go with it. Boards are not
    otherwise changed, so a Restricted board the group was the only grant on stays Restricted.
  - Audited as `GroupDeleted`, metadata `{ name, userIds, boardIds }` (the boards whose grant was
    removed), so the access it gave can be rebuilt by hand.
