# Contracts: fieldsets

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Fieldset Contracts

*Written 2026-10-04 with the decision "Fieldsets: reusable groups of fields, attached to idea types"
(`SPEC/decisions.md`), before the code. The feature is `SPEC/20-feature-idea-type-fields.md`
("Effective-field resolution"); a type attaches fieldsets through `PUT .../idea-types/{id}/fields` in
[`contracts/idea-type-fields.md`](idea-type-fields.md). Where the build differs, the backend slice
corrects this file in the same change.*

A **fieldset** is a named, ordered group of the organization's field definitions. It is a live
reference: editing one changes every idea type that uses it.

Shared by every route below:
- **Roles.** Reading (list, get) is open to a Site Admin for any organization and to any member of
  the organization, whatever their role, because every idea-type screen needs the sets. Writing
  (create, update, delete, set fields) is an in-scope Org Admin's, for their own organization only.
  - User and Read Only are refused with `403`, `detail` `"You are not allowed to manage fieldsets in
    this organization."`, whichever organization the route names.
  - **A Site Admin acting directly is refused with `403`**, `detail` `"Site Admins cannot change
    organization content directly. Use View As to act as a user in that organization."`; they
    write only while acting through View As.
  - An Org Admin naming another organization gets `404` `"Organization not found."`, and so does
    any non-Site-Admin reading another organization's fieldsets.
- **Item shape** (`FieldsetModel`), returned by list, get, create and update:
  - `fieldsetId`
  - `organizationId`
  - `name` string, trimmed
  - `description` string or `null` (blank is stored as `null`)
  - `displayOrder` integer
  - `usedByIdeaTypeCount` integer — idea types, archived ones excluded, that have the fieldset attached
  - `fields` array, ordered by `displayOrder`, of `{ fieldDefinitionId, name, fieldType, isActive,
    displayOrder }`. `isActive` is `false` for an archived field definition: the membership is kept
    but the field is skipped wherever fields are resolved. Empty for a new fieldset.
- **Create and update body** (the same shape for both):
  - `name` required string, max 100 characters
  - `description` optional string, max 500 characters
  - `displayOrder` optional integer
  - Membership is not part of this body; it has its own route below.
- **Validation.** Two envelopes, in this order, as for field definitions:
  - The request shape, checked after sign-in but before the role check or any lookup, keyed by
    field, with no `traceId`: `"Name is required."`, `"Name must be 100 characters or fewer."`,
    `"Description must be 500 characters or fewer."`.
  - The service's, with a `traceId`: `name` `"A fieldset named '<name>' already exists in this
    organization."` — names are unique case-insensitively across the organization's fieldsets.
- A path id that is not a GUID answers `404`.
- The error bodies follow the shared model in `packages/*/src/common`; no route builds its own.

### `GET /api/v1/organizations/{organizationId}/fieldsets`
List the organization's fieldsets.

- **Roles:** as above (readers).
- **Request:** —
- **Response:** `200`, array of the item shape, ordered by `name` (case-insensitive), then
  `fieldsetId`. There is no reorder route; `displayOrder` is stored for a later one.
- **Errors:** `401`; `404` `"Organization not found."` when the organization does not exist or is
  outside the caller's scope.
- **Rules:** —

### `GET /api/v1/organizations/{organizationId}/fieldsets/{id}`
Return one fieldset.

- **Roles:** as above (readers).
- **Request:** —
- **Response:** `200`, the item shape.
- **Errors:** `401`; `404` `"Fieldset not found."` when it does not exist or belongs to another
  organization; `404` `"Organization not found."` for a non-Site-Admin naming another organization.
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/fieldsets`
Create a fieldset, with no fields.

- **Roles:** as above (writers).
- **Request:** the create body.
- **Response:** `201`, the item shape, with `fields` empty and `usedByIdeaTypeCount` `0`.
- **Errors:** `400` as under Validation; `401`; `403` as under Roles; `404` `"Organization not
  found."`.
- **Rules:** `displayOrder` absent places the fieldset last: the highest `displayOrder` among the
  organization's fieldsets plus 10, or 10 for the first.

### `PUT /api/v1/organizations/{organizationId}/fieldsets/{id}`
Update a fieldset's name, description and order.

- **Roles:** as above (writers).
- **Request:** the update body.
- **Response:** `200`, the item shape.
- **Errors:** `400` as under Validation; `401`; `403` as under Roles; `404` `"Fieldset not found."`
  when it does not exist or belongs to another organization.
- **Rules:** `displayOrder` absent keeps the stored value. Membership is untouched.

### `PUT /api/v1/organizations/{organizationId}/fieldsets/{id}/fields`
Replace the fieldset's members and their order.

- **Roles:** as above (writers).
- **Request:** body `fieldDefinitionIds` array of field definition GUIDs, in the order they should
  appear; may be empty.
- **Response:** `200`, the item shape.
- **Errors:** `400` `fieldDefinitionIds` `"Field Definition Ids is required."` when absent or an
  explicit `null`; `400` `fieldDefinitionIds` when an id is not a GUID, is repeated, or names a field
  definition that does not exist, is archived, or belongs to another organization; `401`; `403` as
  under Roles; `404` `"Fieldset not found."`.
- **Rules:**
  - The array is authoritative: listed fields are added or reordered, and a stored member left out
    is removed. `displayOrder` is renumbered `10, 20, 30, …` in one commit.
  - Takes effect at once for every idea type using the fieldset (live reference). Stored idea
    values for a removed field are kept.

### `DELETE /api/v1/organizations/{organizationId}/fieldsets/{id}`
Delete a fieldset.

- **Roles:** as above (writers).
- **Request:** —
- **Response:** `204 No Content`.
- **Errors:** `401`; `403` as under Roles; `404` `"Fieldset not found."` when it does not exist or
  belongs to another organization; `409` `"This fieldset is used by <n> idea type(s). Remove it from
  them first."` while any idea type, archived ones included, has it attached.
- **Rules:** A hard delete: the fieldset and its membership go. The field definitions are untouched.
