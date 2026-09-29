# Contracts: idea-field-options

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Idea Field Option Contracts

`30-Contracts.md` once carried two sections with this heading; they were merged 2026-09-28 (slice
119). Eight differences — six between the two copies, two between text they shared and the code —
were decided by the user the same day to match the code as it stands (`SPEC/decisions.md`
2026-09-28).

Idea Type and Business Impact are dedicated organization-scoped option collections. Active labels are trimmed, case-insensitively unique within their field and organization, and returned in ascending `sortOrder`. The first active option is the default. Every organization must retain at least one active option in each collection.

Shared rules, for both option types:
- **Roles, mutations** (create, update, reorder, delete): an in-scope Org Admin, for their own organization only. User and Read Only callers receive `403 Forbidden`.
- **A Site Admin acting directly is refused** with `403` on every mutation (`ensureNotDirectSiteAdmin`, called from `ensureAdminScope`); the way in is View As. Listing is unaffected.
- **Cross-organization access returns `404 Not Found`** "Organization not found.": an Org Admin mutating another organization's options (`ensureAdminScope`), and a member reading another organization's list (`ensureReadScope`).
- **Roles, list:** every member of the organization, and a Site Admin.
- Labels are trimmed before persistence and active labels are unique case-insensitively within the same organization and option type.
- Missing resources return `404 Not Found`.

### `GET /api/v1/organizations/{organizationId}/idea-types`
List the organization's Idea Type options.
- **Roles:** any member of the organization; Site Admin.
- **Request:** query `includeDeleted` optional boolean — `true` adds archived options; any caller who may read the list may pass it.
- **Response:** `200`, array ordered by `sortOrder`, then `name`. Item shape:
  - `ideaTypeId` GUID string
  - `organizationId` GUID string
  - `name` string, max 100 characters
  - `sortOrder` integer
  - `isDeleted` boolean
  - `effectiveFields` array — the custom fields an idea of this type shows, in form order, resolved by
    the effective-field rule (`SPEC/20-feature-idea-type-fields.md` "Effective-field resolution"). An
    archived type (returned under `includeDeleted=true`) resolves the same way. Item shape:
    - `fieldDefinitionId` GUID string
    - `name` string
    - `fieldType` one of `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`
    - `isRequired` boolean — required for this type, not the field's global flag
    - `options` array of `{ optionId, label }` in display order; empty for a field that is not
      `Dropdown` or `MultiSelect`
- **Errors:** `404` "Organization not found." for a caller outside the organization.
- **Rules:**
  - Active options only unless `includeDeleted=true`.
  - `effectiveFields` was added 2026-09-27 so the idea form stops re-deriving the rule in the browser,
    where it could drift from the validator (`SPEC/decisions.md` 2026-09-27, "The API sends the custom
    field list").

### `POST /api/v1/organizations/{organizationId}/idea-types`
Create an Idea Type option.
- **Roles:** in-scope Org Admin only (see the shared rules).
- **Request:**
  - `name` required string, max 100 characters
  - `sortOrder` optional integer — absent, the option goes at the end (the highest existing `sortOrder` plus 10); present, it is used as given. No negative check.
- **Response:** `201`, Idea Type item shape.
- **Errors:** `403`, `404` as in the shared rules.
- **Rules:** creates an active option.

### `PUT /api/v1/idea-types/{ideaTypeId}`
Rename an active Idea Type, and optionally move it.
- **Roles:** in-scope Org Admin only.
- **Request:**
  - `name` required string, max 100 characters
  - `sortOrder` optional integer — absent, the option keeps its current `sortOrder`. No negative check.
- **Response:** `200`, updated Idea Type item shape.
- **Errors:** `404` for a missing or archived option; `403` as in the shared rules.
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/idea-types/reorder`
Replace the complete active Idea Type order atomically.
- **Roles:** in-scope Org Admin only.
- **Request:**
  - `orderedIdeaTypeIds` required non-empty array listing every active Idea Type ID in the organization exactly once; archived options are not listed
- **Response:** `204 No Content`
- **Errors:** `400` "The reorder must list every active option exactly once." when the array misses, repeats or adds an ID; `403`, `404` as in the shared rules.
- **Rules:** sets no default — idea create requires an active `ideaTypeId`.

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Soft-delete an Idea Type while preserving existing idea references.
- **Roles:** in-scope Org Admin only.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** `400 Bad Request` when the option is the organization's last active Idea Type; `404` for a missing option; `403` as in the shared rules.
- **Rules:** see "Option deletion behavior" below.

### `GET /api/v1/organizations/{organizationId}/business-impacts`
List the organization's Business Impact options.
- **Roles:** any member of the organization; Site Admin.
- **Request:** query `includeDeleted` optional boolean — as for the Idea Type list.
- **Response:** `200`, array ordered by `sortOrder`, then `name`. Item shape:
  - `businessImpactId` GUID string
  - `organizationId` GUID string
  - `name` string, max 100 characters
  - `color` required string, CSS hex color in `#RRGGBB` format
  - `sortOrder` integer
  - `isDeleted` boolean
- **Errors:** `404` "Organization not found." for a caller outside the organization.
- **Rules:** active options only unless `includeDeleted=true`.

### `POST /api/v1/organizations/{organizationId}/business-impacts`
Create a Business Impact option.
- **Roles:** in-scope Org Admin only.
- **Request:**
  - `name` required string, max 100 characters
  - `color` required string in `#RRGGBB` format
  - `sortOrder` optional integer — as for Idea Types: absent appends at the end (highest plus 10). No negative check.
- **Response:** `201`, Business Impact item shape.
- **Errors:** `403`, `404` as in the shared rules.
- **Rules:** creates an active option.

### `PUT /api/v1/business-impacts/{businessImpactId}`
Rename or recolor an active Business Impact, and optionally move it.
- **Roles:** in-scope Org Admin only.
- **Request:**
  - `name` required string, max 100 characters
  - `color` required string in `#RRGGBB` format
  - `sortOrder` optional integer — absent keeps the current value. No negative check.
- **Response:** `200`, updated Business Impact item shape.
- **Errors:** `404` for a missing or archived option; `403` as in the shared rules.
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/business-impacts/reorder`
Replace the complete active Business Impact order atomically.
- **Roles:** in-scope Org Admin only.
- **Request:**
  - `orderedBusinessImpactIds` required non-empty array listing every active Business Impact ID in the organization exactly once; archived options are not listed
- **Response:** `204 No Content`
- **Errors:** `400` "The reorder must list every active option exactly once."; `403`, `404` as in the shared rules.
- **Rules:** sets no default.

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Soft-delete a Business Impact while preserving existing idea references.
- **Roles:** in-scope Org Admin only.
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** `400 Bad Request` when the option is the organization's last active Business Impact; `404` for a missing option; `403` as in the shared rules.
- **Rules:** see below.

Option deletion behavior:
- soft deletion preserves existing idea references and their prior labels
- archived options cannot be assigned on create or update
- existing ideas return archived option labels with an archived indicator
