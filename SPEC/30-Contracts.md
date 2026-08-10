# Contracts

## Purpose
Defines the system contracts that implementations must follow.

## Contract Authorship Rule
- Canonical contract behavior is authored in this file and related canonical `SPEC/20-feature-*.md` docs.
- Contract tests verify the API surface directly against the canonical documents under `SPEC`.
- Do not introduce API behavior without corresponding canonical updates in `SPEC`.

## Route Conventions
- HTTP APIs use path versioning under `/api/v1`.
- Resource routes use plural nouns.
- Nested routes are allowed when needed to express parent-child ownership clearly.

## MVP Boundary For External Auth
- MVP contract conformance does not require OAuth or SAML endpoints.
- OAuth/OIDC endpoints are planned for post-MVP Phase 2.
- SAML endpoints are planned for a post-OAuth phase.
- Until those phases begin, `/api/v1/auth/*` contracts are limited to local credential and password-management flows defined in this document.

## Error Envelope
- All non-2xx responses use a problem-details-style payload.
- Standard fields are `type`, `title`, `status`, `detail`, and `instance`.
- Validation failures may include an additional `errors` object keyed by field name.

## Standard Error Responses
- `400 Bad Request`: request JSON is malformed, required fields are missing, field values violate contract constraints, or the request shape is otherwise invalid.
- `401 Unauthorized`: the caller is not authenticated or the authentication token is missing, expired, or invalid.
- `403 Forbidden`: the caller is authenticated but not permitted to perform the requested action in the current scope.
- `404 Not Found`: the targeted resource does not exist or is not visible within the caller's authorized scope.

## Collection Conventions
- Organization, user, idea, and comment list endpoints support pagination in MVP.
- Smaller configuration collections such as statuses, boards, and tags may return full result sets unless a feature-specific contract says otherwise.
- Paginated collections support basic filtering plus one explicit sort field and sort direction.
- Archived organizations are hidden from list results by default unless explicitly filtered with `isArchived=true` or an equivalent include-archived flag.

## Update Conventions
- MVP update operations use last-write-wins behavior unless a feature-specific contract defines a stronger rule.

## Validation Ownership
- The API contract validates request shape, required fields, and basic field constraints.
- The Application and Domain layers enforce business rules, authorization rules, and cross-entity invariants.

## Validation Message Conventions
- API validation messages follow these canonical templates:
	- Required: `<FieldName> is required.`
	- Max length: `<FieldName> must be <N> characters or fewer.`
	- Min length: `<FieldName> must be at least <N> characters.`
	- Invalid format: `<FieldName> must be a valid <FormatName>.`
	- Invalid enum value: `<FieldName> must be one of: <Value1>, <Value2>, <Value3>.`
	- Numeric or date range: `<FieldName> must be between <Min> and <Max>.`
	- Mention resolution: `Mention '<Value>' could not be resolved to a user in your organization.`
- Validation failures use the `errors` object keyed by request field names.
- UI should mirror API validation wording where practical to reduce interpretation drift.
- **Casing (Resolved 2026-08-07)**: the `errors` object *keys* are camelCase to match wire JSON field names (e.g. `"firstName"`). The `<FieldName>` substituted into message *text* is separate and uses human-readable, spaced Title Case (e.g. `"First Name is required."`, `"Email is required."`), not the raw camelCase or PascalCase property name. This applies to every validation template in this section.

## Shared Data Rules
- Identifiers are GUID strings.
- Timestamps are UTC ISO-8601 strings.
- Enum values are serialized as strings.
- Paginated responses use:
	- `items`
	- `page`
	- `pageSize`
	- `totalCount`
	- `sortBy`
	- `sortDirection`
- User and organization text fields are trimmed before validation and persistence.
- First and last name maximum length is 100 characters.
- Company name maximum length is 200 characters.
- Address maximum length is 200 characters.
- City maximum length is 100 characters.
- State maximum length is 50 characters.
- Zip maximum length is 20 characters.
- Phone maximum length is 25 characters.
- Comment body maximum length is 2000 characters and supports plain text with line breaks only.

## Authentication Contracts

### Access Token Format and Session Revocation (Resolved 2026-08-07)
`accessToken` is a signed JWT, not an opaque server-tracked token. Every `User` has a server-side `SecurityStamp` (a random value regenerated whenever sessions must be invalidated). Each issued JWT embeds the `SecurityStamp` value current at issuance time as a claim. `GET /api/v1/auth/me` and every authenticated request revalidate the JWT's embedded `SecurityStamp` claim against the User's current `SecurityStamp` in the database — a mismatch is treated as an invalid/expired token (`401`), exactly like an expired JWT. "Revoke all existing sessions" (self-service and admin-issued password reset, `SPEC/20-feature-auth.md` requirements #29 and the self-service reset acceptance criteria) is implemented by regenerating `User.SecurityStamp`, which immediately invalidates every previously issued token for that user without needing a token blocklist or session table.

Access tokens expire absolutely 480 minutes after issuance, so a successful login returns `expiresInSeconds: 28800`. Deployments may override the lifetime through `Auth:AccessTokenLifetimeMinutes` (environment variable `Auth__AccessTokenLifetimeMinutes`). The browser independently enforces a 30-minute inactivity deadline, warns at minute 28 with a two-minute countdown, and synchronizes activity and logout/expiry across tabs. Staying signed in resets only browser inactivity and never changes `expiresInSeconds` or the JWT expiry. Idle or absolute expiry clears client authentication and navigates to `/login?sessionExpired=true`; explicit logout and successful password changes do not use that query state.

### `POST /api/v1/auth/login`
Purpose: Authenticate a user with globally unique email credentials.

Request body:
- `email` required string
- `password` required string

Success response `200` authenticated:
- `accessToken` string
- `expiresInSeconds` integer; `28800` under the canonical 480-minute configuration
- `requiresPasswordChange` boolean
- `user`
	- `userId` GUID string
	- `organizationId` GUID string or `null` for Site Admin
	- `role` string
	- `firstName` string
	- `lastName` string
	- `email` string
	- `status` string

Error responses:
- `401` invalid credentials
- `403` inactive account
- `429` locked out after 5 failed attempts within 15 minutes

### `GET /api/v1/auth/me`
Purpose: Return the currently authenticated user summary.

Success response `200`:
- `userId`
- `organizationId`
- `role`
- `firstName`
- `lastName`
- `email`
- `status`

Error responses:
- `401` caller is not authenticated

### `PUT /api/v1/auth/me`
Purpose: Update the currently authenticated user's editable profile fields.

Request body:
- `firstName` required string, max 100 characters
- `lastName` required string, max 100 characters

Both fields are trimmed before persistence. Email, role, organization, and status cannot be changed through this endpoint.

Success response `200`:
- updated authenticated user summary using the same shape as `GET /api/v1/auth/me`

Error responses:
- `400` missing or invalid name fields
- `401` caller is not authenticated or the authenticated user cannot be resolved

### `POST /api/v1/auth/change-password`
Purpose: Change the current user's password, including the first-login Site Admin password change.

Request body:
- `currentPassword` required string
- `newPassword` required string

Success response:
- `204 No Content`

Error responses:
- `400` invalid password policy
- `401` invalid current password
- `403` caller is authenticated but not allowed to change the password in the current state

### `POST /api/v1/users/{userId}/temporary-password`
Purpose: MVP/P1 admin-issued temporary password reset.

Request body:
- empty body or implementation-defined admin note

Success response `200`:
- `temporaryPassword` string
- `mustChangePassword` boolean

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to issue a temporary password for the target user
- `404` target user does not exist or is outside caller scope

Behavior rules:
- the temporary password is displayed one time only
- the temporary password expires after 24 hours if unused
- the user must change the password on first successful use

### `POST /api/v1/auth/password-reset/request`
Purpose: Post-MVP anonymous request for a self-service password-reset email.

Request body:
- `email` required string, valid email format

Success response `202 Accepted`:
- `message` string with the same generic wording for every syntactically valid request

Behavior rules:
- only active accounts with local-password credentials are eligible, including Site Admin and organization users
- unknown, inactive, external-only, throttled, and eligible emails receive the same response
- eligible requests send an unlinked anonymous reset-page URL containing a cryptographically random bearer token
- issuing a new token invalidates every prior token for the account
- the token expires after 24 hours and is single-use
- delivery is limited to 3 requests per normalized email and 10 requests per source IP in a rolling 15-minute window
- requests above either limit return the generic success response without sending an email
- token values are not persisted in plaintext or included in logs, audit metadata, analytics, or responses

Error responses:
- `400` malformed request body, missing email, or invalid email format

### `POST /api/v1/auth/password-reset/confirm`
Purpose: Post-MVP anonymous completion of a self-service password reset using the emailed token.

Request body:
- `token` required string
- `newPassword` required string
- `confirmPassword` required string

Success response:
- `204 No Content`

Behavior rules:
- `newPassword` and `confirmPassword` must match
- the new password must satisfy the existing authentication complexity policy
- invalid, expired, superseded, and used tokens return the same invalid-link failure
- a successful reset consumes the token and revokes all existing sessions for the account
- the response does not authenticate the user; the client shows confirmation and returns to Login
- token and plaintext password values are not persisted or included in logs, audit metadata, analytics, or error responses

Error responses:
- `400` malformed request, password mismatch, password-policy failure, or invalid-link failure

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

## User Contracts

### `POST /api/v1/auth/register`
Purpose: Self-register a new user account using an organization invite code. Anonymous endpoint.

Request body:
- `inviteCode` required string
- `firstName` required string
- `lastName` required string
- `email` required string
- `password` required string, must satisfy the authentication complexity policy

Behavior rules:
- the invite code determines the organization the user is associated with
- the created user receives role `User` and status `Active`
- registration against an archived organization is rejected as an invalid invite code

Success response `201`:
- `userId`
- `organizationId`
- `email`
- `role`
- `status`

Error responses:
- `400` request body is malformed or violates field constraints
- `400` invite code is missing or invalid; response prompts the user to provide a correct invite code
- `409` email is already in use

### `GET /api/v1/organizations/{organizationId}/users`
Purpose: List users within an organization with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `role` optional
- `status` optional `Active` or `Inactive`
- `sortBy` optional `lastName`, `email`, or `createdAt`
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `userId`
- `organizationId`
- `firstName`
- `lastName`
- `email`
- `role`
- `status`

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to list users in this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/users`
Purpose: Create a user within an organization.

Request body:
- `firstName` required string
- `lastName` required string
- `email` required string
- `role` required string
- `initialPassword` required string
- `status` optional, defaults to `Active`

Success response `201`:
- `userId`
- `organizationId`
- `email`
- `role`
- `status`

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create users in this organization
- `404` organization does not exist or is outside caller scope

### `POST /api/v1/organizations/{organizationId}/users/import`
Purpose: Bulk-create users in an organization from an uploaded CSV file. Site Admin may import into any organization; Org Admin only into their own.

Request body:
- `multipart/form-data`
- field `csvFile` required

CSV columns:
- `firstName` required
- `lastName` required
- `email` required
- `role` optional, defaults to `User`
- no invite code column; every created user is associated with the organization in the route

Behavior rules:
- each created user receives a system-generated temporary password and must change it on first login
- rows with invalid data or duplicate emails are rejected individually without failing the whole import

Success response `200`:
- `createdCount`
- `rejectedCount`
- `rows` per-row outcome list with `rowNumber`, `email`, `outcome`, `error` nullable, and `temporaryPassword` for created rows

Error responses:
- `400` file is missing, malformed, or not a valid CSV
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create users in this organization
- `404` organization does not exist or is outside caller scope

### `GET /api/v1/users/{userId}`
Purpose: Return user detail.

Error responses:
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to view this user
- `404` user does not exist or is outside caller scope

### `PUT /api/v1/users/{userId}`
Purpose: Update user profile, role, or status within the caller's authorized scope.

Request body:
- `firstName` required string
- `lastName` required string
- `email` required string
- `role` required string
- `status` required string

Success response:
- `200` updated user detail

Error responses:
- `400` request body is malformed or violates field constraints
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to update this user
- `404` user does not exist or is outside caller scope

## Status Contracts

### `GET /api/v1/organizations/{organizationId}/statuses`
Purpose: List all active and visible statuses for an organization.

Success response `200` item shape:
- `statusId`
- `organizationId`
- `name`
- `isDeleted`

Historical display behavior:
- when a soft-deleted status is surfaced through related entities, the prior name remains visible with an archived or deleted label

### `POST /api/v1/organizations/{organizationId}/statuses`
Purpose: Create a new organization status.

Request body:
- `name` required string
- `color` optional CSS/hex color string (max 20 chars); defaults to `#64748B` when omitted — drives the swimlane color dot and idea-card status chip
- `sortOrder` optional integer (organization-level catalog order); appended after the current maximum when omitted

Success response `201`:
- `statusId`
- `name`
- `color`
- `sortOrder`

### `PUT /api/v1/statuses/{statusId}`
Purpose: Rename or update a status.

Request body:
- `name` required string
- `color` optional CSS/hex color string (max 20 chars)
- `sortOrder` optional integer

### `DELETE /api/v1/statuses/{statusId}`
Purpose: Soft-delete a status while preserving existing references.

Success response:
- `204 No Content`

## Idea Field Option Contracts

Idea Type and Business Impact collections include active and archived options ordered by `sortOrder`, then `name`.
Site Admin may manage any target organization supplied by route context. Org Admin may manage only their own organization. User and Read Only callers receive `403 Forbidden`.

### `GET /api/v1/organizations/{organizationId}/idea-types`
Purpose: List all Idea Type options for an organization, including archived options.

Success response `200` item shape:
- `ideaTypeId`
- `organizationId`
- `name`
- `sortOrder`
- `isDeleted`

### `POST /api/v1/organizations/{organizationId}/idea-types`
Purpose: Create an active Idea Type at the end of the organization's current option order.

Request body:
- `name` required string, max 100 characters

Success response `201`: Idea Type item shape.

### `PUT /api/v1/idea-types/{ideaTypeId}`
Purpose: Rename an active Idea Type.

Request body:
- `name` required string, max 100 characters

Success response `200`: updated Idea Type item shape.

### `POST /api/v1/organizations/{organizationId}/idea-types/reorder`
Purpose: Replace the complete Idea Type order atomically.

Request body:
- `orderedIdeaTypeIds` required array containing every organization Idea Type ID exactly once, including archived options

Success response:
- `204 No Content`

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Purpose: Soft-delete an Idea Type while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Idea Type.

### `GET /api/v1/organizations/{organizationId}/business-impacts`
Purpose: List all Business Impact options for an organization, including archived options.

Success response `200` item shape:
- `businessImpactId`
- `organizationId`
- `name`
- `color` required `#RRGGBB` string
- `sortOrder`
- `isDeleted`

### `POST /api/v1/organizations/{organizationId}/business-impacts`
Purpose: Create an active Business Impact at the end of the organization's current option order.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format

Success response `201`: Business Impact item shape.

### `PUT /api/v1/business-impacts/{businessImpactId}`
Purpose: Rename or recolor an active Business Impact.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format

Success response `200`: updated Business Impact item shape.

### `POST /api/v1/organizations/{organizationId}/business-impacts/reorder`
Purpose: Replace the complete Business Impact order atomically.

Request body:
- `orderedBusinessImpactIds` required array containing every organization Business Impact ID exactly once, including archived options

Success response:
- `204 No Content`

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Purpose: Soft-delete a Business Impact while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Business Impact.

For both option types, labels are trimmed before persistence and active labels are unique case-insensitively within the same organization and option type. Missing resources return `404 Not Found`; cross-organization access returns `403 Forbidden`.

## Idea-Type Field Contracts

Idea Types scope which User-Defined Fields appear on an idea by **direct mapping**: an Idea Type owns an ordered selection of the organization's existing UDFs, each marked required-or-optional *for that type* (`SPEC/20-feature-idea-type-fields.md`). There is no separate "field set" resource. A type has a **field mode** — `AllActiveFields` (default; shows every active org UDF, global required) or `Curated` (shows only the mapped fields, per-type required). Site Admin may manage any organization supplied by route context; Org Admin only their own; User and Read Only callers receive `403 Forbidden`. The Idea Type list/create/rename/reorder/soft-delete contracts are unchanged (see the Idea Field Option Contracts above); the routes below add field selection, appearance, and reassignment.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/fields`
Purpose: Replace the Idea Type's field selection. Supplying a non-empty selection switches the type to `Curated`; an empty selection clears it back to `AllActiveFields`.

Request body:
- `fields` array of `{ fieldDefinitionId (GUID), displayOrder (int), isRequired (bool) }`; every `fieldDefinitionId` must be an active field definition in the org, and each may appear at most once. The array is authoritative — omitted fields are removed, new ones added, existing ones updated in place.

Success response `204 No Content`. `400` on unknown/archived field or duplicate field in the selection; `404` when the Idea Type does not exist in the organization.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/appearance`
Purpose: Set or clear the Idea Type's badge appearance.

Request body:
- `colorHex` string `#RRGGBB` or `null` to clear (contrast is advisory, not blocking)
- `icon` short token string (emoji or icon key) or `null` to clear

Success response `204 No Content`. `400` when `colorHex` is present and not a valid `#RRGGBB`; `404` when the Idea Type does not exist in the organization.

### `PUT /api/v1/organizations/{organizationId}/ideas/{ideaId}/idea-type`
Purpose: **Admin-only reassignment** of an idea's type (the only path that mutates type after creation). Re-resolves the idea's fields; values for fields not in the new type's resolved set are archived (preserved, hidden), not dropped; an `IdeaTypeReassigned` audit event is emitted.

Request body:
- `ideaTypeId` GUID string — must be an active Idea Type in the same organization

Success response `204 No Content`. `400` when `ideaTypeId` names an unknown or archived type; `403` for non-admin callers; `404` when the idea does not exist in the organization.

> **Note (idea update contract):** idea type is immutable on the normal edit path. `PUT`/update paths for an idea must not change `ideaTypeId`; a request that supplies a differing `ideaTypeId` is rejected with `400`. Type changes go only through the admin reassignment route above. The `POST /api/v1/boards/{boardId}/ideas` create contract's required `ideaTypeId` is unchanged.

## Board Contracts

### `GET /api/v1/organizations/{organizationId}/boards`
Purpose: List boards for an organization.

Success response `200` item shape:
- `boardId`
- `organizationId`
- `name`
- `allowUserStatusUpdate` boolean
- `swimlaneCount`

### `POST /api/v1/organizations/{organizationId}/boards`
Purpose: Create a board with at least two swimlanes.

Request body:
- `name` required string
- `allowUserStatusUpdate` required boolean
- `swimlanes` required array of
	- `statusId` GUID string
	- `order` integer

Success response `201`:
- `boardId`
- `name`
- `swimlanes`

### `GET /api/v1/boards/{boardId}`
Purpose: Return board detail including swimlanes.

### `PUT /api/v1/boards/{boardId}`
Purpose: Update board name or selected statuses.

Request body:
- `name` required string
- `allowUserStatusUpdate` required boolean
- `swimlanes` required array of `statusId` and `order`

### `POST /api/v1/boards/{boardId}/swimlanes/reorder`
Purpose: Persist swimlane reorder immediately after drag-and-drop.

Request body:
- `swimlanes` required array of
	- `statusId`
	- `order`

Success response:
- `204 No Content`

## Idea Contracts

### `GET /api/v1/boards/{boardId}/ideas`
Purpose: List ideas on a board with pagination.

Query parameters:
- `page`
- `pageSize`
- `search` optional
- `statusId` optional
- `tag` optional
- `priority` optional `Low`, `Medium`, `High`, or `Critical`
- `dueBefore` optional date string (`YYYY-MM-DD`)
- `sortBy` optional `createdAt`, `updatedAt`, `upvoteCount`, `priority`, or `dueDate`
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `ideaId`
- `boardId`
- `title`
- `priority` string
- `ideaTypeId` GUID string
- `ideaTypeName` string
- `businessImpactId` GUID string
- `businessImpactName` string
- `businessImpactColor` string
- `dueDate` date string (`YYYY-MM-DD`) or `null`
- `assignees` array with at most five items, ordered by `firstName`, then `lastName`; each item contains `userId`, `firstName`, `lastName`, `displayName`, and `isActive`; clients derive persona initials from the name fields
- `tagNames` string array, ordered alphabetically
- `statusId`
- `statusName`
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer
- `authorUserId`
- `createdAtUtc`

### `GET /api/v1/organizations/{organizationId}/ideas`
Purpose: Cross-board, organization-scoped idea list for the global `/ideas` page (`SPEC/20-feature-client-ui-revisions.md` "Ideas Page"). Scoped to the caller's organization.

Query parameters:
- `page`
- `pageSize`
- `search` optional (matches the idea title and the values of Text/Url User-Defined Fields)
- `scope` optional `all` (default), `created` (authored by the caller), or `assigned` (assigned to the caller)
- `sortBy` optional `createdAt` (default) or `title`
- `sortDirection` optional `asc` or `desc` (the page requests `desc` for newest-first)
- `fieldFilters[<fieldDefinitionId>]=<value>` optional, repeatable — filter by User-Defined Field value (T059). Semantics per field type: `Text`/`Url` contains; `Number` range `<min>:<max>` (either side omittable); `Date` range `<from>:<to>` (ISO-8601, either side omittable); `Boolean` `true`/`false`; `Dropdown` exact option id; `MultiSelect` any-of (matches when the stored option ids include the value). Unknown/invalid `fieldDefinitionId` keys and unparseable values are silently ignored.

Success response `200`: same paged item shape as `GET /api/v1/boards/{boardId}/ideas`.

### `GET /api/v1/boards/{boardId}/ideas/export`
Purpose: Export a board's active ideas as CSV (T059/T060).

Success response `200`:
- `Content-Type: text/csv` (UTF-8 with BOM), attachment `ideas.csv`
- Columns: `Title`, `Description`, `Priority`, `Idea Type`, `Business Impact`, `Status`, `Due Date`, `Tags`, then one column per active User-Defined Field (header = field name). Dropdown/MultiSelect values render as option labels.

### `POST /api/v1/boards/{boardId}/ideas/import`
Purpose: Create-only CSV import of ideas onto a board (T059/T060). Multipart form field `csvFile`.

Behavior:
- Each data row creates a new idea. Required columns: `Title`, `Description`, `Priority`, `Idea Type`, `Business Impact`. `Status` is optional (must name a board swimlane; defaults to the left-most swimlane); `Due Date`, `Tags`, and per-UDF-field columns are optional.
- `Idea Type` and `Business Impact` are matched by name (case-insensitive) against active options; a missing or unknown value rejects that row. Dropdown/MultiSelect UDF columns are matched by option label; Boolean accepts `Yes`/`No` or `true`/`false`.
- Invalid rows are rejected individually with a per-row message; valid rows still import.

Success response `200`:
- `createdCount` integer
- `rejectedCount` integer
- `rows` array of `{ rowNumber, title, outcome (`Created`/`Rejected`), error }`

Error responses:
- `400` the file is missing/empty or its header lacks the required columns

### `POST /api/v1/boards/{boardId}/ideas`
Purpose: Create a new idea on a board.

Request body:
- `title` required string, max 150 characters
- `description` required string, max 4000 characters
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the board's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the board's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every user must be active and belong to the board's organization
- `statusId` optional GUID string, defaults to the left-most swimlane when omitted
- `tagNames` optional string array
- `mentionEmails` optional string array

Success response `201`:
- `ideaId`
- `boardId`
- `statusId`
- `title`
- `priority`
- `ideaTypeId`
- `businessImpactId`
- `dueDate`

### `POST /api/v1/boards/{boardId}/ideas/ai-draft`
Purpose: Turn a plain-English description into a pre-filled, unsaved idea draft for review. This endpoint never creates an idea; the client submits the reviewed result to `POST /api/v1/boards/{boardId}/ideas` as normal.

Authorized for the same roles as manual idea creation: Site Admin, Org Admin, and `User`. `Read Only` is rejected with `403`.

Request body:
- `rawInput` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- authenticates with the board organization's own AI API key when configured, otherwise the deployment default key; on organization-key failure the call is retried once against the deployment default key
- the extraction call is constrained to the board organization's active Idea Type and Business Impact options and never receives the organization's user or tag lists
- `description` is produced by backend cleaning of `rawInput`, not by the model
- person, tag, and date mentions returned by the model as raw text are resolved in backend code against active organization users, existing tags, and a date parser
- unambiguous resolutions are returned pre-filled; ambiguous or unresolved mentions and no-signal required fields are returned in `clarifications`
- at most one clarification round is supported; the client resolves the returned questions locally and does not call this endpoint again for the same input

Success response `200`:
- `title` string, max 150 characters
- `description` string, max 4000 characters
- `priority` nullable string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` nullable GUID string
- `businessImpactId` nullable GUID string
- `dueDate` nullable date string (`YYYY-MM-DD`)
- `assigneeUserIds` array of zero to five distinct GUID strings, unambiguous resolutions only
- `tagNames` string array, unambiguous resolutions only
- `inferredFields` string array naming every field populated by inference rather than by unambiguous resolution; the client renders these as "inferred, unconfirmed" until the user interacts with them
- `clarifications` array, empty when nothing needs clarifying

`clarifications` item shape:
- `field` required string: `priority`, `ideaType`, `businessImpact`, `assignee`, `tag`, or `dueDate`
- `kind` required string: `choice` when a required field had no usable signal, or `disambiguation` when a mention matched more than one candidate
- `prompt` required string, the question presented to the user
- `sourceMention` nullable string, the raw input text that could not be resolved, null for `choice`
- `options` required array of `{ value, label }`, sourced from the organization's current active options for `choice` and from the matching candidates for `disambiguation`

Error responses:
- `400` request body is malformed or violates field constraints, including `rawInput` below the minimum length
- `401` caller is not authenticated
- `403` caller is authenticated but not allowed to create ideas on this board
- `404` board does not exist or is outside caller scope
- `409` AI-assisted creation is not configured: neither an organization key nor a deployment default key is available
- `503` the provider failed after both the organization key and the deployment default key were attempted

`409` and `503` are feature-specific extensions to the standard error responses. The client treats both as recoverable by falling back to the blank manual idea form.

### `POST /api/v1/boards/{boardId}/ideas/ai-polish`
Purpose: Rewrite a draft description on explicit user request. This is the opt-in "Polish with AI" action and is never invoked automatically.

Authorized for the same roles as `ai-draft`.

Request body:
- `description` required string, min 20 characters, max 4000 characters, trimmed before validation

Behavior rules:
- uses the same key precedence and fallback behavior as `ai-draft`
- returns rewritten text only; the caller decides whether to accept it, and no idea is created or modified

Success response `200`:
- `description` string, max 4000 characters

Error responses:
- same set as `POST /api/v1/boards/{boardId}/ideas/ai-draft`

### `GET /api/v1/ideas/{ideaId}`
Purpose: Return full idea detail.

Success response `200`:
- `ideaId`
- `boardId`
- `title`
- `description`
- `priority`
- `ideaTypeId`
- `ideaTypeName`
- `businessImpactId`
- `businessImpactName`
- `businessImpactColor`
- `dueDate`
- `assignees` array using the board-list assignee item shape
- `statusId`
- `statusName`
- `tagNames`
- `mentions`
- `comments`
- `upvoteCount`
- `hasUpvoted` boolean for the current caller
- `commentCount` integer

### `PUT /api/v1/ideas/{ideaId}`
Purpose: Update idea content.

Request body:
- `title` required string, max 150 characters
- `description` required string, max 4000 characters
- `priority` required string: `Low`, `Medium`, `High`, or `Critical`
- `ideaTypeId` required GUID string referencing an active Idea Type in the idea's organization
- `businessImpactId` required GUID string referencing an active Business Impact in the idea's organization
- `dueDate` optional date string (`YYYY-MM-DD`)
- `assigneeUserIds` optional array of zero to five distinct GUID strings; every newly selected user must be active and belong to the idea's organization
- `tagNames` optional array of no more than 10 distinct normalized tag names
- `mentionEmails` optional string array

UI behavior contract:
- board cards remain compact and show `title`, `priority`, Business Impact chip, the first three alphabetical `tagNames` plus tag overflow count, the first three ordered `assignees` plus assignee overflow count, viewer-local age derived from `createdAtUtc`, current-user upvote state/count, and comment count.
- selecting the card title navigates to the full-page Idea Detail view (`/ideas/{ideaId}/edit`) for full idea editing.
- Idea Detail supports all editable idea fields and collaboration fields.
- selecting the card comment action navigates to Idea Detail and focuses the comment composer.
- description updates are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized description changes return `403 Forbidden`.
- assignee updates replace the complete collection atomically and are accepted only from the idea author, an in-scope Org Admin, or Site Admin; unauthorized assignment changes return `403 Forbidden`.
- duplicate assignee IDs, more than five assignee IDs, inactive newly selected users, cross-organization users, or more than 10 distinct tags return `400 Bad Request`.

### `POST /api/v1/ideas/{ideaId}/status`
Purpose: Move an idea to another board status.

Request body:
- `statusId` required GUID string

Success response:
- `204 No Content`

### `DELETE /api/v1/ideas/{ideaId}`
Purpose: Soft-delete an idea while preserving its row and audit history.

Authorization:
- Site Admin within the target resource context
- Org Admin within their own organization

Success response:
- `204 No Content`

Error responses:
- `401` caller is not authenticated
- `403` caller is not an authorized in-scope admin
- `404` idea does not exist, is already deleted, or is outside caller scope

Query behavior:
- normal board, list, and detail endpoints exclude soft-deleted ideas
- no restore endpoint is exposed in this release

## Idea Field Option Contracts

Idea Type and Business Impact are dedicated organization-scoped option collections. Active labels are trimmed, case-insensitively unique within their field and organization, and returned in ascending `sortOrder`. The first active option is the default. Every organization must retain at least one active option in each collection.

### `GET /api/v1/organizations/{organizationId}/idea-types`
Purpose: List active Idea Type options. Authorized admins may pass `includeDeleted=true` to include archived options.

Success response `200` item shape:
- `ideaTypeId` GUID string
- `organizationId` GUID string
- `name` string, max 100 characters
- `sortOrder` integer
- `isDeleted` boolean

### `POST /api/v1/organizations/{organizationId}/idea-types`
Purpose: Create an Idea Type option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `sortOrder` required integer, zero or greater

Success response: `201` Idea Type item

### `PUT /api/v1/idea-types/{ideaTypeId}`
Purpose: Rename or reorder an Idea Type option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `sortOrder` required integer, zero or greater

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Purpose: Soft-delete an Idea Type option. Reject deletion with `400` when it is the last active Idea Type in the organization.

### `PUT /api/v1/organizations/{organizationId}/idea-types/reorder`
Purpose: Atomically set the complete active Idea Type order. The first identifier becomes the default for future ideas.

Request body:
- `orderedIdeaTypeIds` required non-empty array of all active Idea Type GUIDs in the organization

### `GET /api/v1/organizations/{organizationId}/business-impacts`
Purpose: List active Business Impact options. Authorized admins may pass `includeDeleted=true` to include archived options.

Success response `200` item shape:
- `businessImpactId` GUID string
- `organizationId` GUID string
- `name` string, max 100 characters
- `color` required string, CSS hex color in `#RRGGBB` format
- `sortOrder` integer
- `isDeleted` boolean

### `POST /api/v1/organizations/{organizationId}/business-impacts`
Purpose: Create a Business Impact option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format
- `sortOrder` required integer, zero or greater

Success response: `201` Business Impact item

### `PUT /api/v1/business-impacts/{businessImpactId}`
Purpose: Rename, recolor, or reorder a Business Impact option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format
- `sortOrder` required integer, zero or greater

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Purpose: Soft-delete a Business Impact option. Reject deletion with `400` when it is the last active Business Impact in the organization.

### `PUT /api/v1/organizations/{organizationId}/business-impacts/reorder`
Purpose: Atomically set the complete active Business Impact order. The first identifier becomes the default for future ideas.

Request body:
- `orderedBusinessImpactIds` required non-empty array of all active Business Impact GUIDs in the organization

Option deletion behavior:
- soft deletion preserves existing idea references and their prior labels
- archived options cannot be assigned on create or update
- existing ideas return archived option labels with an archived indicator

## Tag Contracts

### `GET /api/v1/organizations/{organizationId}/tags`
Purpose: Return tag autocomplete suggestions within an organization.

Query parameters:
- `search` required string, minimum 2 characters
- `limit` optional integer, defaults to `10`, maximum `50`

Success response `200`:
- string array of matching tag names

Rules:
- matching is case-insensitive by normalized tag prefix
- suggestions are organization-scoped

## Comment Contracts

### `GET /api/v1/ideas/{ideaId}/comments`
Purpose: List comments for an idea with pagination and chronological ordering.

Query parameters:
- `page`
- `pageSize`
- `sortBy` fixed to chronological order
- `sortDirection` optional `asc` or `desc`

Success response `200` paged item shape:
- `commentId`
- `ideaId`
- `authorUserId`
- `body`
- `createdAtUtc`
- `updatedAtUtc`

### `POST /api/v1/ideas/{ideaId}/comments`
Purpose: Add a comment to an idea.

Request body:
- `body` required string, max 2000 characters, plain text with line breaks
- `mentionEmails` optional string array — same organization-scoped, email-based mention resolution as ideas (`SPEC/20-feature-ideas-and-engagement.md` "Comments" #5); unresolved addresses are ignored

UX rules:
- clients should show a live character counter and inline overflow validation

Success response `201`:
- `commentId`
- `ideaId`

### `PUT /api/v1/comments/{commentId}`
Purpose: Edit a comment authored by the caller.

Request body:
- `body` required string, max 2000 characters, plain text with line breaks

UX rules:
- clients should show a live character counter and inline overflow validation

### `DELETE /api/v1/comments/{commentId}`
Purpose: Delete a comment authored by the caller or by an authorized admin.

Success response:
- `204 No Content`

## Upvote Contracts

### `POST /api/v1/ideas/{ideaId}/upvote/toggle`
Purpose: Toggle the caller's upvote on an idea.

Success response `200`:
- `ideaId`
- `hasUpvoted` boolean
- `upvoteCount` integer

## Notification Event Contract

### Internal notification event types
- `IdeaMentioned`
- `CommentMentioned`
- `IdeaCommented`
- `IdeaStatusChanged`

### Internal notification event payload
- `eventId` GUID string
- `eventType` string
- `organizationId` GUID string
- `boardId` GUID string
- `ideaId` GUID string
- `actorUserId` GUID string
- `recipientUserId` GUID string
- `occurredAtUtc` UTC timestamp
- `ideaLink` string using `/ideas/{ideaId}/edit` (superseded from the earlier `/org/{organizationId}/boards/{boardId}/ideas/{ideaId}` pattern; see `SPEC/20-feature-notifications.md`)
- `message` human-readable event summary string
- `metadata` object for event-specific context

MVP event query scope:
- audit and notification events must be persisted for internal processing and verification
- read or query endpoints for those events are not required in MVP
- verification should be provided through tests and internal diagnostics outside the public API surface

## Notes
- API routes, request/response schemas, and validation rules should be defined here.
- Contract tests should stay aligned with this file.