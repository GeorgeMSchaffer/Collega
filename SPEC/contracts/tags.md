# Contracts: tags

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Tag Contracts

### `GET /api/v1/organizations/{organizationId}/tags`
Return tag autocomplete suggestions within an organization.

- **Roles:** —
- **Request:** query parameters
  - `search` required string, minimum 2 characters
  - `limit` optional integer, defaults to `10`, maximum `50`
- **Response:** `200`: string array of matching tag names
- **Errors:** —
- **Rules:**
  - matching is case-insensitive by normalized tag prefix
  - suggestions are organization-scoped

### Tag colour and management (added 2026-09-28)

Comp R gives every tag a colour and adds Settings → Tags (`SPEC/20-feature-ideas-and-engagement.md`
"Tags" rules 9–15; `SPEC/decisions.md` 2026-09-28).

- The autocomplete above is **unchanged**: it still answers bare names, because the idea form's tag field only needs names.
- **Colour.** `color` is **any** `#RRGGBB` string (answered 2026-09-28: the palette plus a custom colour) — the same six-hex-digit format rule the status, business impact and idea type colours follow (`^#[0-9a-fA-F]{6}$`), stored and returned in upper case. Anything else is a `400` keyed `color`, `"Color must be a valid #RRGGBB color."`
- The ten palette values — `#E5484D`, `#F5A524`, `#3FB86B`, `#2F9E8F`, `#5CC8E0`, `#6B9BF2`, `#B08CF5`, `#E879A6`, `#A87B2F`, `#94A3B8` — are what the picker offers first and what random colours are drawn from; the API gives them no other privilege.
- **Every tag created without a colour gets a random palette colour** — the management create below when `color` is absent, and every tag created inline by `POST /api/v1/boards/{boardId}/ideas`, `PUT /api/v1/ideas/{ideaId}` or CSV import. The server picks it, from an injected random source.
- A Site Admin acting directly is refused every mutation below with `403` (the guard already lists tags) and reads with `200`; View As is the path. Cross-organization access answers `404`.

Tag item shape (the list, create and update below):
- `tagId`
- `name` — as stored (trimmed; case preserved)
- `color`
- `ideaCount` integer — live (not soft-deleted) ideas carrying the tag, **both phases**
- `boards` array of `{ boardId, name }`, the boards those ideas are on, ordered by `name` (case-insensitive); archived boards included
- `createdAtUtc`
- `createdBy` — `{ userId, displayName }`, or `null`, as on the board list item

#### `GET /api/v1/organizations/{organizationId}/tags/catalog`
Every tag in the organization, for Settings → Tags and for any tag filter that needs the full set (the Ideas screen's Tags filter has had to assemble its options from other reads — slice 102's recorded deviation).

- **Roles:** every member of the organization, `Read Only` included.
- **Request:** —
- **Response:** `200`: an **unpaged** array of the tag item shape (tags are a small configuration collection, per "Collection Conventions"), ordered by `name` ascending (case-insensitive).
- **Errors:**
  - `401` caller is not authenticated
  - `404` the organization does not exist or is outside caller scope
- **Rules:**
  - **Kept member-readable on purpose (2026-09-28)**, although Settings → Tags itself is Org Admins' only: the Ideas screen's **Tags filter** is used by every role and needs the organization's full tag set with colours — today it assembles its options from the boards' top tags, the rows in view and a typeahead, so a tag that is on none of those cannot be picked (slice 102's recorded deviation). Scoping this read to admins would leave that defect in place for members. It exposes nothing a member cannot already see: every idea in the organization is visible to its members, and with it every tag's name, colour, usage and board.
  - The counts and board lists are computed with a fixed number of grouped queries for the whole list, never one query per tag.
  - The drawer's *Used on* list is not a new read: it is `GET /api/v1/organizations/{organizationId}/ideas?tag={name}` with its existing paging.

#### `POST /api/v1/organizations/{organizationId}/tags`
Add a tag in advance of use.

- **Roles:** in-scope Org Admin.
- **Request:** body
  - `name` required string — trimmed; 1–100 characters
  - `color` optional — see *Colour*; absent **or `null`** means a random palette colour
- **Response:** `201`: the tag item shape (`ideaCount` `0`, `boards` empty).
- **Errors:**
  - `400` keyed `name`: missing or blank — `"Tag name is required."`; over 100 characters — `"Tag must be 100 characters or fewer."`; matches an existing tag's normalized name — `"A tag with this name already exists."`. Keyed `color`: invalid — `"Color must be a valid #RRGGBB color."`
  - `401` caller is not authenticated
  - `403` caller is not an in-scope Org Admin, or is a Site Admin acting directly
  - `404` the organization does not exist or is outside caller scope
- **Rules:** A concurrent create of the same normalized name answers the same field-keyed `400` to the loser (the unique index `ux_tags_organization_id_normalized_name` decides), not a `500`; so does a concurrent `PUT` rename onto a name another request has just taken. This differs from inline creation while tagging an idea, which merges (ideas rule 7), because here the caller asked for a new tag by name and should learn it exists.

#### `PUT /api/v1/tags/{tagId}`
Rename or recolour a tag.

- **Roles:** in-scope Org Admin.
- **Request:** body
  - `name` required string — trimmed; 1–100 characters
  - `color` optional — absent **or `null`** leaves the stored colour alone (like the `description` rule on `PUT /api/v1/boards/{boardId}`, except that `null` does not clear: a tag always has a colour)
- **Response:** `200`: the tag item shape.
- **Errors:**
  - `400` as for create, keyed `name` or `color`, including the concurrent-duplicate case above
  - `401` caller is not authenticated
  - `403` caller is not an in-scope Org Admin, or is a Site Admin acting directly
  - `404` the tag does not exist or belongs to another organization
- **Rules:**
  - a rename takes effect on every idea carrying the tag, since ideas reference the tag's id
  - renaming onto **another** tag's normalized name is refused — there is no merge; a case-only rename of the same tag is allowed (its normalized name does not change)
  - when the name changes, writes one `TagRenamed` audit event (`entityType` `Tag`, `entityId` the tag id; metadata `tagId`, `oldName`, `newName`, `ideaCount` — the ideas carrying it). A colour-only change writes none. No per-idea event, no idea's `updatedAtUtc` changes, no notification (ideas rule 15; decided by the user 2026-09-28)

#### `DELETE /api/v1/tags/{tagId}`
Delete a tag and remove it from every idea.

- **Roles:** in-scope Org Admin.
- **Request:** —
- **Response:** `204 No Content`.
- **Errors:**
  - `401` caller is not authenticated
  - `403` caller is not an in-scope Org Admin, or is a Site Admin acting directly
  - `404` the tag does not exist or belongs to another organization
- **Rules:**
  - removes **every** `idea_tags` row for the tag — both phases, archived boards and soft-deleted ideas included, since `FK_idea_tags_tags_tag_id` has no cascade and the delete would otherwise fail — and deletes the tag, in one transaction. A hard delete: there is no soft-delete or restore. An idea's `updatedAtUtc` is **not** touched; its content did not change, its labels did.
  - writes one `TagDeleted` audit event (`entityType` `Tag`, `entityId` the tag id; metadata `tagId`, `name`, `ideaCount` — the live ideas it was removed from). No per-idea event, no notification (ideas rule 15; decided by the user 2026-09-28)
