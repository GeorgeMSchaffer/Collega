# Contracts: idea-type-fields

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Idea-Type Field Contracts

Shared by every route below:
- Idea Types scope which User-Defined Fields appear on an idea by **direct mapping**: an Idea Type owns an ordered selection of the organization's existing UDFs, each marked required-or-optional *for that type* (`SPEC/20-feature-idea-type-fields.md`). There is no separate "field set" resource.
- A type has a **field mode** — `AllActiveFields` (default; shows every active org UDF, global required) or `Curated` (shows only the mapped fields, per-type required).
- Roles: an in-scope Org Admin, for their own organization only; User and Read Only callers receive `403 Forbidden`. **A Site Admin acting directly is refused with `403`** (`ensureNotDirectSiteAdmin`, called from `ensureAdminScope`); a Site Admin manages another organization's types only while acting through View As. *Corrected 2026-09-29 (`SPEC/decisions.md`, "Spec contradictions resolved"): this said a Site Admin may manage any organization supplied by route context.*
- The Idea Type list/create/rename/reorder/soft-delete contracts are unchanged (see "Idea Field Option Contracts" in [`contracts/idea-field-options.md`](idea-field-options.md)); the routes below add field selection, appearance, and reassignment.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/fields`
Replace the Idea Type's field selection.

- **Roles:** as above.
- **Request:** body
  - `fields` array of `{ fieldDefinitionId (GUID), displayOrder (int), isRequired (bool) }`; every `fieldDefinitionId` must be an active field definition in the org, and each may appear at most once.
- **Response:** `204 No Content`.
- **Errors:** `400` on unknown/archived field or duplicate field in the selection; `404` when the Idea Type does not exist in the organization.
- **Rules:**
  - Supplying a non-empty selection switches the type to `Curated`; an empty selection clears it back to `AllActiveFields`.
  - The array is authoritative — omitted fields are removed, new ones added, existing ones updated in place.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/appearance`
Set or clear the Idea Type's badge appearance.

- **Roles:** as above.
- **Request:** body
  - `colorHex` string `#RRGGBB` or `null` to clear (contrast is advisory, not blocking)
  - `icon` short token string (emoji or icon key) or `null` to clear
- **Response:** `204 No Content`.
- **Errors:** `400` when `colorHex` is present and not a valid `#RRGGBB`; `404` when the Idea Type does not exist in the organization.
- **Rules:** —

### `PUT /api/v1/organizations/{organizationId}/ideas/{ideaId}/idea-type`
**Admin-only reassignment** of an idea's type (the only path that mutates type after creation).

- **Roles:** admin only; `403` for non-admin callers.
- **Request:** body
  - `ideaTypeId` GUID string — must be an active Idea Type in the same organization
- **Response:** `204 No Content`.
- **Errors:** `400` when `ideaTypeId` names an unknown or archived type; `403` for non-admin callers; `404` when the idea does not exist in the organization.
- **Rules:**
  - Re-resolves the idea's fields; values for fields not in the new type's resolved set are archived (preserved, hidden), not dropped.
  - An `IdeaTypeReassigned` audit event is emitted.

> **Note (idea update contract):** idea type is immutable on the normal edit path. `PUT`/update paths for an idea must not change `ideaTypeId`; a request that supplies a differing `ideaTypeId` is rejected with `400`. Type changes go only through the admin reassignment route above. The `POST /api/v1/boards/{boardId}/ideas` create contract's required `ideaTypeId` is unchanged.
