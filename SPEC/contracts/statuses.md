# Contracts: statuses

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Status Contracts

### `GET /api/v1/organizations/{organizationId}/statuses`
List all active and visible statuses for an organization.

- **Roles:** —
- **Request:** —
- **Response:** `200`, item shape:
  - `statusId`
  - `organizationId`
  - `name`
  - `isDeleted`
- **Errors:** —
- **Rules:** Historical display behavior: when a soft-deleted status is surfaced through related entities, the prior name remains visible with an archived or deleted label.

### `POST /api/v1/organizations/{organizationId}/statuses`
Create a new organization status.

- **Roles:** —
- **Request:** body
  - `name` required string
  - `color` optional string in `#RRGGBB` format (max 20 chars, but the format is what is enforced); defaults to `#64748B` when omitted — drives the swimlane color dot and idea-card status chip. **Format-checked since 2026-09-10**: it was previously length-checked only, and twenty characters is enough for a working CSS `url()`, which the client renders into a `style` attribute
  - `sortOrder` optional integer (organization-level catalog order); appended after the current maximum when omitted
- **Response:** `201`
  - `statusId`
  - `name`
  - `color`
  - `sortOrder`
- **Errors:** —
- **Rules:** —

### `PUT /api/v1/statuses/{statusId}`
Rename or update a status.

- **Roles:** —
- **Request:** body
  - `name` required string
  - `color` optional string in `#RRGGBB` format (max 20 chars, but the format is what is enforced)
  - `sortOrder` optional integer
- **Response:** —
- **Errors:** —
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/statuses/reorder`
Replace the complete active-status order atomically.

- **Roles:** —
- **Request:** body
  - `orderedStatusIds` required array containing every active organization status ID exactly once
- **Response:** `204 No Content`
- **Errors:** —
- **Rules:** —

### `DELETE /api/v1/statuses/{statusId}`
Soft-delete a status while preserving existing references.

- **Roles:** —
- **Request:** —
- **Response:** `204 No Content`
- **Errors:** —
- **Rules:** —
