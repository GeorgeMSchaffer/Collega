# Contracts: field-definitions

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## User-Defined Field Contracts

*Written 2026-09-29 from the code (slice 124, `SPEC/decisions.md` 2026-09-29 "Contracts and wording
written from the code"): `apps/api/src/field-definitions/field-definitions.controller.ts`,
`packages/application/src/fields/field-definition-service.ts` and
`packages/domain/src/fields/field-definition.ts`. It agrees with every
`tools/golden/fixtures/fielddefinitions.*` fixture.* The feature is
`SPEC/20-feature-user-defined-fields.md`; values ride on the idea create and update payloads and
have no routes of their own.

Shared by every route below:
- **Roles.** Reading (list, get) is open to a Site Admin for any organization and to any member of
  the organization, whatever their role, because every idea form needs the schema. Writing (create,
  update, delete, reorder) is an in-scope Org Admin's, for their own organization only.
  - User and Read Only are refused with `403`, `detail` `"You are not allowed to manage field
    definitions in this organization."`, whichever organization the route names.
  - **A Site Admin acting directly is refused with `403`**, `detail` `"Site Admins cannot change
    organization content directly. Use View As to act as a user in that organization."`; they
    write only while acting through View As.
  - An Org Admin naming another organization gets `404` `"Organization not found."`, and so does
    any non-Site-Admin reading another organization's schema.
- **Item shape** (`FieldDefinitionModel`), returned by list, get, create and update:
  - `fieldDefinitionId`
  - `organizationId`
  - `name` string, trimmed
  - `description` string or `null` (blank is stored as `null`)
  - `fieldType` one of `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`
  - `isRequired` boolean
  - `displayOrder` integer
  - `isDeleted` boolean
  - `options` array, ordered by `displayOrder`, of `{ optionId, label, displayOrder }`; empty for a
    type other than `Dropdown` and `MultiSelect`
- **Create and update body** (the same shape for both):
  - `name` required string, max 100 characters
  - `description` optional string, max 500 characters
  - `fieldType` required string, matched case-insensitively against the values above
  - `isRequired` optional boolean; only a JSON `true` sets it, anything else is `false`
  - `displayOrder` optional integer
  - `options` optional array of `{ optionId, label, displayOrder }`; anything that is not an array
    (including `null`) reads as empty
    - `optionId` optional GUID — absent or `null` creates a new option, a GUID updates that option
      in place (so idea values that reference it survive the edit)
    - `label` required string, max 200 characters
    - `displayOrder` optional integer; absent or `0` takes the option's position in the array
      (0-based)
- **Validation.** Two envelopes, in this order:
  - The request shape, checked after sign-in but before the role check or any lookup, keyed by field, with no
    `traceId`: `"Name is required."`, `"Name must be 100 characters or fewer."`, `"Description must
    be 500 characters or fewer."`, `"Field Type is required."`, and for option `n`,
    `options[n].label` `"Label is required."` / `"Label must be 200 characters or fewer."` and
    `options[n].optionId` `"Option Id must be a valid GUID."` (every malformed id is reported).
  - The service's, with a `traceId`:
    - `fieldType` `"Field type must be one of: Text, Number, Date, Boolean, Dropdown,
      MultiSelect, Url."`
    - `name` `"A field named '<name>' already exists in this organization."` — names are unique
      case-insensitively among the organization's **active** definitions, so an archived
      definition's name may be reused
    - under the single key `fieldDefinition`, whichever invariant failed: `"A <Type> field cannot
      have options."` (create only), `"A <Type> field must have at least one option."` and
      `"Option labels must be unique; '<label>' is duplicated."` (labels are trimmed and compared
      case-insensitively)
- A path id that is not a GUID answers `404`.

### `GET /api/v1/organizations/{organizationId}/field-definitions`
List the organization's field definitions.

- **Roles:** as above (readers).
- **Request:** query `includeDeleted` optional boolean — only the literal `true` (any casing) sets it.
- **Response:** `200`, array of the item shape, ordered by `displayOrder`, then `name`.
- **Errors:** `401`; `404` `"Organization not found."` when the organization does not exist or is
  outside the caller's scope.
- **Rules:** `includeDeleted=true` adds archived definitions for a Site Admin or an in-scope Org
  Admin only; anyone else asking for it is not refused and gets the active schema.

### `GET /api/v1/organizations/{organizationId}/field-definitions/{id}`
Return one field definition.

- **Roles:** as above (readers).
- **Request:** —
- **Response:** `200`, the item shape.
- **Errors:** `401`; `404` `"Field definition not found."` when it does not exist, belongs to another
  organization, or is archived and the caller is not a Site Admin or in-scope Org Admin; `404`
  `"Organization not found."` for a non-Site-Admin naming another organization.
- **Rules:** —

### `POST /api/v1/organizations/{organizationId}/field-definitions`
Create a field definition.

- **Roles:** as above (writers).
- **Request:** the create body.
- **Response:** `201`, the item shape.
- **Errors:** `400` as under Validation; `401`; `403` as under Roles; `404` `"Organization not
  found."`.
- **Rules:**
  - `displayOrder` absent places the field last: the highest `displayOrder` among the
    organization's definitions, archived ones included, plus 10 — or 10 for the first.
  - `Dropdown` and `MultiSelect` need at least one option; every other type must send none.
  - Audited as `FieldDefinitionCreated`.

### `PUT /api/v1/organizations/{organizationId}/field-definitions/reorder`
Renumber the active field definitions.

- **Roles:** as above (writers).
- **Request:** body `orderedIds` array of field definition IDs.
- **Response:** `204 No Content`.
- **Errors:** `400` `orderedIds` `"Ordered Ids is required."` when it is an explicit `null`; `401`;
  `403` as under Roles; `404` `"Organization not found."`.
- **Rules:**
  - No coverage check, unlike the Idea Type, Business Impact and status reorders: IDs that are
    unknown, archived, repeated or not GUIDs are skipped; active definitions left out keep their
    prior relative order after the listed ones. An absent or non-array `orderedIds` is therefore an
    accepted renumber that changes nothing but the numbers.
  - Every active definition is renumbered `10, 20, 30, …` in one commit. Audited as
    `FieldDefinitionsReordered`.
  - `PUT`, not `POST` as the other catalogs' reorders are.

### `PUT /api/v1/organizations/{organizationId}/field-definitions/{id}`
Update a field definition's name, description, required flag, order and options.

- **Roles:** as above (writers).
- **Request:** the update body. `fieldType` is still required and must equal the stored type.
- **Response:** `200`, the item shape.
- **Errors:** `400` as under Validation, and `fieldType` `"Field type cannot be changed after
  creation."`; `401`; `403` as under Roles; `404` `"Field definition not found."` when it does not
  exist, belongs to another organization, or is archived.
- **Rules:**
  - `displayOrder` absent keeps the stored value.
  - For `Dropdown` and `MultiSelect`, `options` is authoritative: listed options are updated or
    created, and a stored option left out is removed. For every other type `options` is ignored.
  - Audited as `FieldDefinitionUpdated`.

### `DELETE /api/v1/organizations/{organizationId}/field-definitions/{id}`
Archive (soft-delete) a field definition.

- **Roles:** as above (writers).
- **Request:** —
- **Response:** `204 No Content`.
- **Errors:** `401`; `403` as under Roles; `404` `"Field definition not found."` when it does not
  exist or belongs to another organization.
- **Rules:**
  - Idempotent: an already archived definition answers `204` and changes nothing.
  - Existing idea values are kept; the definition leaves forms and the active list. Audited as
    `FieldDefinitionDeleted`.
