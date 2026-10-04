# Contracts: idea-type-fields

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Idea-Type Field Contracts

Shared by every route below:
- Idea Types scope which User-Defined Fields appear on an idea by **direct mapping**: an Idea Type owns an ordered selection of the organization's existing UDFs, each marked required-or-optional *for that type* (`SPEC/20-feature-idea-type-fields.md`). *Superseded 2026-10-04 (`SPEC/decisions.md`):* a type may also attach reusable **fieldsets** (live references), managed through [`contracts/fieldsets.md`](fieldsets.md); `SPEC/20-feature-idea-type-fields.md` holds the resolution rules.
- A type has a **field mode** — `AllActiveFields` (default; shows every active org UDF, global required) or `Curated` (shows only the mapped fields and the attached fieldsets' fields; direct fields use the per-type required flag, fieldset fields the field's global one).
- Roles: an in-scope Org Admin, for their own organization only; User and Read Only callers receive `403 Forbidden`. **A Site Admin acting directly is refused with `403`** (`ensureNotDirectSiteAdmin`, called from `ensureAdminScope`); a Site Admin manages another organization's types only while acting through View As. *Corrected 2026-09-29 (`SPEC/decisions.md`, "Spec contradictions resolved"): this said a Site Admin may manage any organization supplied by route context.*
- The Idea Type list/create/rename/reorder/soft-delete contracts are unchanged (see "Idea Field Option Contracts" in [`contracts/idea-field-options.md`](idea-field-options.md)); the routes below add field selection, appearance, and reassignment.

### `PUT /api/v1/organizations/{organizationId}/idea-types/{ideaTypeId}/fields`
Replace the Idea Type's field selection.

- **Roles:** as above.
- **Request:** body
  - `fields` array of `{ fieldDefinitionId (GUID), displayOrder (int), isRequired (bool) }`; every `fieldDefinitionId` must be an active field definition in the org, and each may appear at most once.
  - `fieldsetIds` optional array of fieldset GUIDs, in the order they apply; every id must name a fieldset in the org, each at most once. Omitted or `null` means none (so an existing request keeps its meaning). *(Added 2026-10-04.)*
- **Response:** `204 No Content`.
- **Errors:** `400` on unknown/archived field or duplicate field in the selection, and on an unknown (or other-organization) or duplicate fieldset id, keyed `fieldsetIds` (`"A fieldset may appear at most once in the selection."`, `"'<id>' is not a fieldset in this organization."`; a malformed id is read as unknown), and on a `fieldsetIds` that is present but not an array (`"Fieldset Ids must be a list of GUIDs."`, request-shape envelope); `404` when the Idea Type does not exist in the organization.
- **Rules:**
  - Supplying a non-empty `fields` or `fieldsetIds` switches the type to `Curated`; both empty or absent clears it back to `AllActiveFields`.
  - The arrays are authoritative — omitted fields and fieldsets are removed, new ones added, existing ones updated in place. Detaching a fieldset keeps stored idea values.
  - Both are replaced in one transaction.

### Additive response keys *(2026-10-04)*

Existing responses keep every current key; these are added.

- **Idea Type list and get** items gain `fieldsetIds` (GUID array, attach order) and `fieldsets` (array of `{ id, name }`, same order). Both are empty for a type with no fieldset.
- **Effective-field items** (the idea form's field list and an idea's resolved fields) gain `source`: `{ "kind": "field" }` for a directly mapped field or an `AllActiveFields` type, or `{ "kind": "fieldset", "fieldsetId", "fieldsetName" }` for a field supplied by an attached fieldset. The list follows the effective order in `SPEC/20-feature-idea-type-fields.md`, deduplicated by field.

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
