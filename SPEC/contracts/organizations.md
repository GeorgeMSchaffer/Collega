# Contracts: organizations

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Organization Contracts

### `GET /api/v1/organizations`
Purpose: List organizations for Site Admin with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `isArchived` optional boolean
- `sortBy` optional `companyName` or `createdAt`
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `organizationId`
- `title`
- `description`
- `inviteCode`
- `city`
- `state`
- `phone`
- `logoThumbnailUrl` nullable string
- `isArchived`

Default list behavior:
- archived organizations are excluded unless explicitly filtered in

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to list organizations

### `POST /api/v1/organizations`
Purpose: Create an organization, generate its invite code, and provision default statuses plus one default board.

Request body:
- `title` required string
- `description` required string
- `logoUrl` optional string

Optional profile fields:
- `address` optional string
- `city` optional string
- `state` optional string
- `zip` optional string
- `phone` optional string
- `primaryContactFirstName` optional string
- `primaryContactLastName` optional string

Success response `201`:
- `organizationId`
- `inviteCode`
- `defaultBoardId`
- `defaultStatusCount`

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create organizations

### `GET /api/v1/organizations/{organizationId}`
Purpose: Return organization detail.

Response fields also include:
- `inviteCode`
- `logoUrl` nullable string
- `logoThumbnailUrl` nullable string
- `logoHeightPx` nullable integer, max rendered value `150`
- `aiKeyConfigured` boolean indicating whether this organization has its own AI API key stored
- `aiKeyLastFour` nullable string, the last four characters of the stored key, null when `aiKeyConfigured` is false
- `aiKeyUpdatedAtUtc` nullable timestamp
- `aiKeyUpdatedByUserId` nullable GUID string

The stored AI API key value itself is never returned by this or any other endpoint. The three `aiKey*` metadata fields are omitted entirely for callers whose role is `User` or `Read Only`.

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to view this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}`
Purpose: Update organization detail.

Request body:
- same fields as organization create

Success response:
- `200` updated organization detail

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/logo`
Purpose: Upload or replace an organization logo.

Request body:
- `multipart/form-data`
- field `logoFile` required

Behavior rules:
- exactly one active logo per organization
- new upload replaces previous logo atomically
- return thumbnail metadata for immediate preview
- rendered usage in UI is constrained to max height `150px` while preserving aspect ratio

Success response `200`:
- `logoUrl`
- `logoThumbnailUrl`
- `logoHeightPx`

Error responses:
- `400` request body is malformed or violates file constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/invite-code/regenerate`
Purpose: Regenerate the organization invite code, invalidating the previous code.

Success response `200`:
- `inviteCode`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/archive`
Purpose: Archive an organization without hard deletion.

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to archive this organization
- `404` organization does not exist or is outside caller scope

### `PUT /api/v1/organizations/{organizationId}/ai-key`
Purpose: Set or rotate the organization's own AI API key, overriding the deployment default key for all AI calls made in this organization's scope.

Request body:
- `aiApiKey` required string, max 500 characters, trimmed before validation

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- the submitted key is validated with a single low-cost model call before persistence
- a key that fails validation is rejected and any previously stored key is left untouched
- the key is encrypted at rest and is never returned by this or any other endpoint
- replaces any previously stored key for this organization atomically
- generates an audit event recording the acting user and never the key value

Success response `200`:
- `aiKeyConfigured` boolean, always `true`
- `aiKeyLastFour`
- `aiKeyUpdatedAtUtc`
- `aiKeyUpdatedByUserId`

Error responses:
- `400` request body is malformed, violates field constraints, or the key failed provider validation
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

### `DELETE /api/v1/organizations/{organizationId}/ai-key`
Purpose: Clear the organization's own AI API key, returning the organization to the deployment default key.

Behavior rules:
- authorized for Site Admin on any organization, and for Org Admin on their own organization only
- succeeds idempotently when no key is currently stored
- generates an audit event recording the acting user

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to administer this organization
- `404` organization does not exist or is outside caller scope

