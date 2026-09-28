# Contracts: idea-field-options

Part of the contract set indexed in [`SPEC/30-Contracts.md`](../30-Contracts.md), which also holds
the conventions every contract here follows (routes, errors, collections, validation messages,
shared data rules). Canonical, and read, not edited, by implementation slices.

## Idea Field Option Contracts

> **Merged 2026-09-28 (slice 119), for the user to review.** `30-Contracts.md` carried two sections
> with this heading: one after "Status Contracts" (lines 737–832 at `6792cf3`, **copy A**) and one
> after "Issue Task Contracts" (lines 1735–1829, **copy B**). Every statement from both is kept
> here. Where the two said the same thing, one copy is kept; where they disagree, both statements
> stand side by side under **Conflict — needs a decision**, with what the code does today. The code
> was not changed, and neither statement has been chosen. Conflicts (7) and (8) are between text
> both copies share and the code, found at review.

Idea Type and Business Impact are dedicated organization-scoped option collections. Active labels are trimmed, case-insensitively unique within their field and organization, and returned in ascending `sortOrder`. The first active option is the default. Every organization must retain at least one active option in each collection.

Site Admin may manage any target organization supplied by route context. Org Admin may manage only their own organization. User and Read Only callers receive `403 Forbidden`.

For both option types, labels are trimmed before persistence and active labels are unique case-insensitively within the same organization and option type. Missing resources return `404 Not Found`; cross-organization access returns `403 Forbidden`.

> **Conflict — needs a decision (7): a Site Admin acting directly.** Applies to every mutation
> below, for both option types.
> - Text (copy A; copy B's "Site Admin and in-scope Org Admin only" says the same): "Site Admin may manage any target organization supplied by route context."
> - Code today: a Site Admin acting as themselves is refused with `403` on create, update,
>   reorder and delete (`ensureNotDirectSiteAdmin`, called from `ensureAdminScope` in
>   `IdeaTypeService` and `BusinessImpactService`); the way in is View As. Listing is unaffected.

> **Conflict — needs a decision (8): an Org Admin in another organization.** Applies to every
> mutation below, for both option types.
> - Text (copy A): "Org Admin may manage only their own organization." and "cross-organization access returns `403 Forbidden`."
> - Code today: an Org Admin acting on another organization's options gets `404` "Organization
>   not found." (`ensureAdminScope`); a member reading another organization's list gets `404`
>   too (`ensureReadScope`). User and Read Only callers in their own organization get `403`, as
>   the text says.

### `GET /api/v1/organizations/{organizationId}/idea-types`

> **Conflict — needs a decision (1): which options the list returns.** The same conflict applies to
> the Business Impact list below.
> - Copy A: "Idea Type and Business Impact collections include active and archived options ordered by `sortOrder`, then `name`." and "Purpose: List all Idea Type options for an organization, including archived options."
> - Copy B: "Purpose: List active Idea Type options. Authorized admins may pass `includeDeleted=true` to include archived options."
> - Code today: **copy B** on what is included — active options only, archived ones added when
>   `includeDeleted=true` (`apps/api/src/idea-types/idea-types.controller.ts`, `list`). Unlike
>   copy B's wording, any caller who may read the list may pass it, not only admins: the list is
>   open to every member of the organization and to a Site Admin (`IdeaTypeService.ensureReadScope`).
>   Ordering follows **copy A**: `sortOrder`, then `name` (`idea-type.repository.ts`).

Success response `200` item shape:
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

`effectiveFields` was added 2026-09-27 so the idea form stops re-deriving the rule in the browser,
where it could drift from the validator (`SPEC/decisions.md` 2026-09-27, "The API sends the custom
field list").

> **Conflict — needs a decision (2): the item shape.** Copy A lists `ideaTypeId`, `organizationId`,
> `name`, `sortOrder` and `isDeleted` with no types and no `effectiveFields`; copy B gives the
> types above and adds `effectiveFields`. Code today: **copy B** — every item carries
> `effectiveFields` (`IdeaTypeService.list`). Copy A reads as older text that predates
> 2026-09-27 rather than a deliberate difference.

### `POST /api/v1/organizations/{organizationId}/idea-types`
Purpose: Create an Idea Type option. Site Admin and in-scope Org Admin only.

Request body:
- `name` required string, max 100 characters

Success response `201`: Idea Type item shape.

> **Conflict — needs a decision (3): `sortOrder` on create.** Applies to the Business Impact
> create below as well.
> - Copy A: "Purpose: Create an active Idea Type at the end of the organization's current option order." Its request body has `name` only.
> - Copy B: "- `sortOrder` required integer, zero or greater"
> - Code today: **neither exactly.** `sortOrder` is optional. Absent, the option goes at the end
>   (the highest existing `sortOrder` plus 10), as copy A says; present, it is used as given, as
>   copy B allows. Nothing refuses a missing or negative value (`idea-types.controller.ts`
>   `create`, `IdeaTypeService.create`).

### `PUT /api/v1/idea-types/{ideaTypeId}`
Purpose: Rename an active Idea Type.

Request body:
- `name` required string, max 100 characters

Success response `200`: updated Idea Type item shape.

> **Conflict — needs a decision (4): `sortOrder` on update.** Applies to the Business Impact
> update below as well.
> - Copy A: rename only, as above; no `sortOrder`.
> - Copy B: "Purpose: Rename or reorder an Idea Type option. Site Admin and in-scope Org Admin only." with "- `sortOrder` required integer, zero or greater"
> - Code today: **neither exactly.** `sortOrder` is optional; absent, the option keeps its
>   current `sortOrder`. An archived option answers `404` (`IdeaTypeService.update`), which fits
>   copy A's "an active Idea Type".

### `POST /api/v1/organizations/{organizationId}/idea-types/reorder`
Purpose: Replace the complete Idea Type order atomically.

Success response:
- `204 No Content`

> **Conflict — needs a decision (5): the reorder method.** Applies to the Business Impact reorder
> as well.
> - Copy A: `POST /api/v1/organizations/{organizationId}/idea-types/reorder`
> - Copy B: `PUT /api/v1/organizations/{organizationId}/idea-types/reorder`
> - Code today: **copy A** — `POST`, answering `204` (`idea-types.controller.ts`, `reorder`).

> **Conflict — needs a decision (6): which options the reorder must list.** Applies to the
> Business Impact reorder as well.
> - Copy A: "- `orderedIdeaTypeIds` required array containing every organization Idea Type ID exactly once, including archived options"
> - Copy B: "Purpose: Atomically set the complete active Idea Type order. The first identifier becomes the default for future ideas." with "- `orderedIdeaTypeIds` required non-empty array of all active Idea Type GUIDs in the organization"
> - Code today: **copy B** — every active option exactly once, archived ones not listed
>   (`ensureReorderCoversActive`: "The reorder must list every active option exactly once.").
>   The server does not pick a default for a new idea: idea create requires an active
>   `ideaTypeId` (`IdeaService.getActiveIdeaType`).

### `DELETE /api/v1/idea-types/{ideaTypeId}`
Purpose: Soft-delete an Idea Type while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Idea Type.

### `GET /api/v1/organizations/{organizationId}/business-impacts`

> Conflict (1) applies here. Copy A: "Purpose: List all Business Impact options for an organization, including archived options." Copy B: "Purpose: List active Business Impact options. Authorized admins may pass `includeDeleted=true` to include archived options." Code today: copy B, with the same notes as the Idea Type list (`business-impacts.controller.ts`, `BusinessImpactService.list`).

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

Success response `201`: Business Impact item shape.

> Conflict (3) applies here. Copy A: "Purpose: Create an active Business Impact at the end of the organization's current option order." Copy B adds "- `sortOrder` required integer, zero or greater". Code today: optional, as for Idea Types.

### `PUT /api/v1/business-impacts/{businessImpactId}`
Purpose: Rename or recolor an active Business Impact.

Request body:
- `name` required string, max 100 characters
- `color` required string in `#RRGGBB` format

Success response `200`: updated Business Impact item shape.

> Conflict (4) applies here. Copy B: "Purpose: Rename, recolor, or reorder a Business Impact option. Site Admin and in-scope Org Admin only." with "- `sortOrder` required integer, zero or greater". Code today: optional, as for Idea Types; an archived option answers `404`.

### `POST /api/v1/organizations/{organizationId}/business-impacts/reorder`
Purpose: Replace the complete Business Impact order atomically.

Success response:
- `204 No Content`

> Conflicts (5) and (6) apply here.
> - Copy A: `POST`, with "- `orderedBusinessImpactIds` required array containing every organization Business Impact ID exactly once, including archived options"
> - Copy B: `PUT /api/v1/organizations/{organizationId}/business-impacts/reorder` — "Purpose: Atomically set the complete active Business Impact order. The first identifier becomes the default for future ideas." with "- `orderedBusinessImpactIds` required non-empty array of all active Business Impact GUIDs in the organization"
> - Code today: `POST` (copy A), active options only (copy B), `204`.

### `DELETE /api/v1/business-impacts/{businessImpactId}`
Purpose: Soft-delete a Business Impact while preserving existing idea references.

Success response:
- `204 No Content`

Deletion is rejected with `400 Bad Request` when the option is the organization's last active Business Impact.

Option deletion behavior:
- soft deletion preserves existing idea references and their prior labels
- archived options cannot be assigned on create or update
- existing ideas return archived option labels with an archived indicator

