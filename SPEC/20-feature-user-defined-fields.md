# Feature: User-Defined Fields (UDFs) for Ideas

> **At a glance** (added 2026-09-28; the text below wins where they differ)
> - **Scope:** org-level custom fields on ideas (7 types). Behaviour canonical; the .NET implementation
>   sections are history. Build status not stated here.
> - **Key rules:** one field schema per org, shared by all boards; only Site/Org Admin manage definitions.
> - Required UDFs block save; per-type required-ness now comes from `20-feature-idea-type-fields.md`.
> - Active names unique per org, case-insensitively; delete is soft — values kept but hidden.
> - Value changes emit `IdeaFieldValueChanged`; values flow into CSV export/import and list filters.
> - **Contracts:** contracts/ideas.md, contracts/idea-type-fields.md
> - **Decisions:** 2026-09-27 "The API sends the custom field list"; 2026-09-06 "The .NET stack is frozen;
>   its code and instructions are no longer applicable"

> **Implementation sections below were written for the .NET stack**, deleted in slice F6
> (`SPEC/decisions.md` 2026-09-13). On 2026-09-29 its C# listings, EF Core configuration, Blazor
> component names and paths were replaced by field lists and pointers into the TypeScript code; the
> `AddUserDefinedFields` migration listing and the Effort Sizing table are kept as history. The
> **behaviour** they specify is canonical and ports as-is. The schema now lives in
> `packages/infrastructure/prisma/`, and the field components in `apps/web`.

## Overview

Organizations extend the `Idea` entity with custom fields (User-Defined Fields / UDFs) for domain-specific data the core idea schema lacks.
- Field definitions are owned at the organization level and shared across all boards.
- Admins manage the schema; all org members fill in UDF values on idea forms.

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Scope | Organization-level — all boards share one field schema |
| Supported types | Text, Number, Date, Boolean, Dropdown (single-select), Multi-select, URL |
| Required fields | Hard validation — missing required UDF field blocks idea save. **As of Idea-Type Fields (`SPEC/20-feature-idea-type-fields.md`): required-ness is a per-type override on the `IdeaTypeField` link when the idea's type is `Curated`; `FieldDefinition.IsRequired` remains the default for `AllActiveFields` types and the seed when a field is first mapped onto a type.** |
| Field ordering | Admin-configurable display order; drag-and-drop reorder |
| Visibility / access | All org users see and fill UDF fields on idea forms; only Admins can manage field definitions |
| Templates integration | **Realized as Idea-Type Fields (`SPEC/20-feature-idea-type-fields.md`).** A "template" is a per-type **field selection** (which UDFs show per idea type, each required-or-optional for that type, mapped directly onto the type), *not* a default-value injector. Default values are deferred to P2 there. See the reinterpretation note in "Template Integration" below. |
| CSV export / import | UDF values are columns in CSV export and CSV import |
| Filtering / search | UDF values are filterable and full-text searchable in the ideas list |
| History / audit | UDF value changes are tracked in the audit log |
| New-field migration | Existing ideas get a `null`/empty value for new fields; no backfill |
| Field deletion | Soft delete — definition is archived; values are preserved but hidden from the UI |

---

## Domain Model

### New Entities

#### `FieldDefinition` (auditable)

`packages/domain/src/fields/`:
- `organizationId` — the owning organization
- `name` — max 100 characters
- `description` — optional, max 500 characters
- `fieldType` — a `FieldType`
- `isRequired` — boolean
- `displayOrder` — integer
- soft delete: `isDeleted`, `deletedAtUtc` (nullable), `deletedByUserId` (nullable)
- its options (`FieldDefinitionOption`) and the ideas' values for it (`IdeaFieldValue`)

#### `FieldDefinitionOption`

Only for `Dropdown` and `MultiSelect` field types.
- `fieldDefinitionId` — the owning field
- `label` — max 200 characters
- `displayOrder` — integer

#### `IdeaFieldValue` (auditable)

One UDF's value for one idea, serialized as a string and interpreted per `FieldType`.
- `ideaId`, `fieldDefinitionId`
- `value` — nullable string. Serialization format per type:
  - `Text` / `Url` → raw string (max 2000 / 2048)
  - `Number` → invariant decimal string (e.g. `"50000.00"`)
  - `Date` → ISO-8601 date (`yyyy-MM-dd`)
  - `Boolean` → `"true"` / `"false"`
  - `Dropdown` → a single `FieldDefinitionOption` id (GUID string)
  - `MultiSelect` → comma-separated `FieldDefinitionOption` ids, no duplicates

#### `FieldType` enum

`Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url` — stored as names; the .NET stack's integers (1–7, in that order) are history.

### Modified Entities

An `Idea` has zero or more `IdeaFieldValue` rows — at most one per field.

### Database Indices

| Table | Index | Notes |
|---|---|---|
| `FieldDefinitions` | Unique on `(OrganizationId, NormalizedName)` filtered where `IsDeleted = false` | No duplicate active names per org, **case-insensitively** |
| `IdeaFieldValues` | Unique on `(IdeaId, FieldDefinitionId)` | One value row per field per idea |
| `IdeaFieldValues` | Non-unique on `(FieldDefinitionId, Value)` | Supports filter/sort queries |

---

## Persistence Configuration

The .NET EF Core configuration that stood here is gone with that stack. `packages/infrastructure/prisma/schema.prisma` declares the same limits (name 100, description 500, option label 200, value 4000) and the `(idea_id, field_definition_id)` unique index. Two indexes in the table above differ:

- The **partial** unique index on `(organization_id, normalized_name) WHERE is_deleted = false` is raw SQL in the baseline migration, `packages/infrastructure/prisma/migrations/00000000000000_baseline/migration.sql`, because Prisma's schema cannot express a partial index.
- The non-unique `(field_definition_id, value)` index was **not carried over**: only `ix_idea_field_values_field_definition_id`, on `field_definition_id` alone, exists.

---

## Migration Strategy

### Migration: `AddUserDefinedFields` (.NET, history)

Creates three new tables; no backfill, because null/empty is the correct default for existing ideas.

```sql
-- field_definitions
CREATE TABLE field_definitions (
    id                  uuid                     NOT NULL PRIMARY KEY,
    organization_id     uuid                     NOT NULL,
    name                character varying(100)   NOT NULL,
    normalized_name     character varying(100)   NOT NULL,
    description         character varying(500)   NULL,
    field_type          integer                  NOT NULL,
    is_required         boolean                  NOT NULL DEFAULT false,
    display_order       integer                  NOT NULL DEFAULT 0,
    is_deleted          boolean                  NOT NULL DEFAULT false,
    deleted_at_utc      timestamp with time zone NULL,
    deleted_by_user_id  uuid                     NULL,
    created_at_utc      timestamp with time zone NOT NULL,
    updated_at_utc      timestamp with time zone NOT NULL,
    created_by_user_id  uuid                     NULL,
    updated_by_user_id  uuid                     NULL,
    CONSTRAINT fk_field_definitions_organizations_organization_id
        FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT
);

CREATE INDEX ix_field_definitions_organization_id_display_order
    ON field_definitions (organization_id, display_order);

CREATE UNIQUE INDEX ux_field_definitions_organization_id_normalized_name
    ON field_definitions (organization_id, normalized_name)
    WHERE is_deleted = false;

-- field_definition_options
CREATE TABLE field_definition_options (
    id                   uuid                   NOT NULL PRIMARY KEY,
    field_definition_id  uuid                   NOT NULL,
    label                character varying(200) NOT NULL,
    display_order        integer                NOT NULL DEFAULT 0,
    CONSTRAINT fk_field_definition_options_field_definitions_field_definit
        FOREIGN KEY (field_definition_id) REFERENCES field_definitions (id) ON DELETE CASCADE
);

CREATE INDEX ix_field_definition_options_field_definition_id_display_order
    ON field_definition_options (field_definition_id, display_order);

-- idea_field_values
CREATE TABLE idea_field_values (
    id                   uuid                     NOT NULL PRIMARY KEY,
    idea_id              uuid                     NOT NULL,
    field_definition_id  uuid                     NOT NULL,
    value                character varying(4000)  NULL,
    created_at_utc       timestamp with time zone NOT NULL,
    updated_at_utc       timestamp with time zone NOT NULL,
    created_by_user_id   uuid                     NULL,
    updated_by_user_id   uuid                     NULL,
    CONSTRAINT fk_idea_field_values_ideas_idea_id
        FOREIGN KEY (idea_id) REFERENCES ideas (id) ON DELETE CASCADE,
    CONSTRAINT fk_idea_field_values_field_definitions_field_definition_id
        FOREIGN KEY (field_definition_id) REFERENCES field_definitions (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ux_idea_field_values_idea_id_field_definition_id
    ON idea_field_values (idea_id, field_definition_id);
```

> **This listing is illustrative; the Prisma schema and migrations are authoritative** — `packages/infrastructure/prisma/schema.prisma` for columns and limits, and the baseline `packages/infrastructure/prisma/migrations/00000000000000_baseline/migration.sql` for the partial unique index on `normalized_name`, which the schema cannot express (the .NET migration this named was deleted with that stack). The `(field_definition_id, value)` index above has no Prisma counterpart. Two details are easy to get wrong from the prose above: `normalized_name` (not `name`) carries the uniqueness guarantee, because PostgreSQL compares case-sensitively and the pre-Sprint-5 index relied on SQL Server's case-insensitive default collation; and the partial index `WHERE is_deleted = false` is what lets a soft-deleted definition's name be reused. Keys are generated by the application, not by a column default.

---

## API Endpoints

Existing conventions: path versioning under `/api/v1`, plural nouns, org-scoped.

### Field Definitions (writes: an in-scope `OrgAdmin`; reads: any member, or a `SiteAdmin`)

The contract is [`contracts/field-definitions.md`](contracts/field-definitions.md). *Corrected 2026-09-29 (slice 124, `SPEC/decisions.md` 2026-09-29 "Contracts and wording written from the code"): this heading said all six routes were admin only (`OrgAdmin` or `SiteAdmin`). The code, and the `fielddefinitions.*` fixtures, let any member of the organization list and get the active schema, since every idea form needs it (rule above: "all org members fill in UDF values"), and refuse a Site Admin acting directly on the four writes, as for all organization content.*

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/organizations/{orgId}/field-definitions` | List all field definitions (`?includeDeleted=true` for archived) |
| `POST` | `/api/v1/organizations/{orgId}/field-definitions` | Create a new field definition |
| `GET` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Get a single field definition |
| `PUT` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Update name, description, required, order, or options |
| `DELETE` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Soft-delete a field definition |
| `PUT` | `/api/v1/organizations/{orgId}/field-definitions/reorder` | Set display order for all definitions |

### UDF Values on Ideas

Field values ride inside the existing idea create/update payloads and come back in `IdeaDetailModel`; no additional endpoints.

#### `CreateIdeaRequest` / `UpdateIdeaRequest` extension

```json
{
  "title": "...",
  "fieldValues": [
    { "fieldDefinitionId": "3fa85f64-...", "value": "50000" }
  ]
}
```

#### `IdeaDetailModel` extension

```json
{
  "fieldValues": [
    {
      "fieldDefinitionId": "3fa85f64-...",
      "fieldName": "Budget",
      "fieldType": "Number",
      "value": "50000"
    }
  ]
}
```

### Filtering Extension to the idea list query

```
GET /api/v1/boards/{boardId}/ideas?fieldFilters[<fieldDefinitionId>]=<value>
```

The list query carries these as a map from field definition id to filter value.

Filter semantics per type:

| Type | Match semantics |
|---|---|
| `Text`, `Url` | `LIKE '%value%'` contains |
| `Number` | `min` and `max` encoded as `<value>:<value>` (e.g. `1000:50000`) |
| `Date` | `from` and `to` encoded as `<date>:<date>` (ISO-8601) |
| `Boolean` | exact match (`true` / `false`) |
| `Dropdown` | exact match on option ID |
| `MultiSelect` | any-of match — ideas where the stored comma-separated IDs include the filter value |

---

## Application Layer

### Service: `FieldDefinitionService`

`packages/application/src/fields/field-definition-service.ts`. Operations, each scoped to one organization and authorized for the calling user: list (optionally including archived definitions), get one, create, update, soft-delete, and reorder (a list of ordered definition ids).

### Idea create and update

Idea create and update (`IdeaService`) accept a list of field values (`FieldValueWriteModel` below) and run UDF validation before persistence.

**UDF Validation Rules**

| Type | Rule |
|---|---|
| Any | Referenced `FieldDefinitionId` must belong to the idea's org and not be soft-deleted |
| Any | Required field must have a non-null, non-empty value |
| `Text` | max 2000 characters |
| `Number` | parseable as `decimal` (invariant culture) |
| `Date` | parseable as `DateOnly` in `yyyy-MM-dd` format |
| `Boolean` | must be `"true"` or `"false"` (case-insensitive) |
| `Url` | parseable as absolute URI; scheme must be `http` or `https` |
| `Dropdown` | value must be a GUID matching one option in the field's `Options` list |
| `MultiSelect` | each comma-separated segment must be a valid option GUID; no duplicates |
| `Dropdown` / `MultiSelect` | at least one option must exist on the field definition at create time |
| `Dropdown` / `MultiSelect` | on an edit, an option id the idea already stores for that field is accepted even if the field no longer offers it (options are hard-deleted), so an unchanged save keeps it; an edit may not add such an id. Added 2026-09-27 |

**Audit Emission**

After each idea save, the service diffs new vs. previous `IdeaFieldValue` rows and emits one `IdeaFieldValueChanged` audit event per changed, added, or cleared value:

```json
{
  "eventType": "IdeaFieldValueChanged",
  "ideaId": "<guid>",
  "fieldDefinitionId": "<guid>",
  "fieldName": "Budget",
  "previousValue": null,
  "newValue": "50000",
  "changedByUserId": "<guid>",
  "changedAtUtc": "2026-01-01T00:00:00Z"
}
```

### Application Models

Read model returned by the service — `FieldDefinitionModel`:
- `fieldDefinitionId`, `organizationId`
- `name`
- `description` — nullable
- `fieldType` — the enum name as a string
- `isRequired`, `displayOrder`, `isDeleted`
- `options` — array of `FieldOptionModel`: `optionId`, `label`, `displayOrder`

Write models:
- `CreateFieldDefinitionRequest` — `name` required, max 100; `description` optional, max 500; `fieldType` required; `isRequired`; `displayOrder`; `options` array of `CreateFieldOptionRequest` (`label` required, max 200; `displayOrder`)
- `UpdateFieldDefinitionRequest` — the same shape as create
- `ReorderFieldDefinitionsRequest` — `orderedIds` required, an array of definition ids
- `FieldValueWriteModel` (embedded in the idea write request) — `fieldDefinitionId`, `value` nullable

Embedded in the idea detail — `IdeaFieldValueModel`: `fieldDefinitionId`, `fieldName`, `fieldType`, `value` nullable.

---

## New API Controller

`apps/api/src/field-definitions/` — delegates all logic to `FieldDefinitionService`, no business logic in the controller.

```
GET    /api/v1/organizations/{orgId}/field-definitions           → 200 array of FieldDefinitionModel
POST   /api/v1/organizations/{orgId}/field-definitions           → 201 FieldDefinitionModel
GET    /api/v1/organizations/{orgId}/field-definitions/{id}      → 200 FieldDefinitionModel
PUT    /api/v1/organizations/{orgId}/field-definitions/{id}      → 200 FieldDefinitionModel
DELETE /api/v1/organizations/{orgId}/field-definitions/{id}      → 204
PUT    /api/v1/organizations/{orgId}/field-definitions/reorder   → 204
```

---

## Client UI Design

### Admin: Field Definition Manager

- **Route**: `/settings/fields` in `apps/web` (the Blazor client used `/organizations/{orgId}/settings/fields`)
- **Access**: visible and navigable only for `OrgAdmin` and `SiteAdmin`.
- **Navigation**: a "Custom Fields" link in the Organization Settings navigation menu.

**Parts**:

| Part | Responsibility |
|---|---|
| Definition list | Scrollable list of active definitions; drag-handle for reorder; Edit / Archive buttons |
| Definition editor | Create/edit: name, description, type selector, required toggle, display order, options sub-editor |
| Option editor | Embedded in the editor; add/remove/reorder option labels for Dropdown and MultiSelect types |

**Behaviors**:
- Reorder via drag-and-drop; saves order immediately on drop (calls `PUT .../reorder`)
- Archiving a field shows a confirmation dialog; confirms that existing idea data will be hidden
- Archived fields can be viewed via a "Show archived" toggle; no restore feature in MVP

### Idea Form UDF Fields

- **Location**: the create modal and the Idea Detail drawer's edit form (addressable as `/ideas/{ideaId}`), below the standard fields in a collapsible "Custom Fields" section.
- **Validation**: required fields show inline error text on submit attempt, in the canonical format `<FieldName> is required.`
- **Field definition loading**: the form renders the idea type's `effectiveFields` on create and the idea's `formFields` on edit, both sent by the API, rather than fetching and resolving definitions itself (`SPEC/decisions.md` 2026-09-27, "The API sends the custom field list"). *(The Blazor client fetched `GET …/field-definitions` and cached it in a session-scoped service.)*

**Rendering per type**:

| Field Type | Control |
|---|---|
| `Text` | text field |
| `Number` | number field (decimal) |
| `Date` | date picker |
| `Boolean` | checkbox |
| `Dropdown` | single select |
| `MultiSelect` | multi-select list or tag-chip input |
| `Url` | text field with URL format |

### Ideas List Filter Panel

A "Custom Fields" accordion section in the filter panel; each active definition renders a type-appropriate control. Applied filters serialize to `fieldFilters[<id>]=<value>` in the query string.

| Type | Filter control |
|---|---|
| Text / Url | Text input (contains match) |
| Number | Dual numeric inputs (min / max) |
| Date | Two date pickers (from / to) |
| Boolean | checkbox or three-state toggle (any / true / false) |
| Dropdown | Checkbox list of option labels |
| MultiSelect | Checkbox list of option labels (any-of match) |

### Client data access

`apps/web` reads field definitions through `lib/data/admin.ts` and writes them through the Server Functions in `lib/server/catalog-actions.ts`, over the routes above. *(The Blazor client had a dedicated API client for them, deleted in F6.)*

---

## Template Integration — Realized as Idea-Type Field Selection

> **Reinterpreted (see `SPEC/20-feature-idea-type-fields.md`).** The original note imagined "templates" as *default field-value injectors*; that is **not** the v1 direction.
> - v1 is **per-type field selection (direct mapping)**: an Idea Type maps an ordered selection of existing org UDFs (each required-or-optional for that type), and the idea form/validator/detail resolve fields by the idea's type.
> - There is no separate reusable "field set" entity — fields attach straight to the type.
> - Idea type is **immutable after creation** (with an admin-only reassignment exception that archives out-of-scope values), so the normal edit path has no value reconciliation.
> - Default/prefilled values are a **P2 future consideration**, not part of v1.

How the two readings reconcile:

1. `FieldDefinition` and `FieldDefinitionOption` keep stable `Guid` PKs — the `IdeaTypeField` link references field definitions by ID (unchanged premise). The org field pool stays single and shared; a field may be mapped onto several types.
2. A type's field selection **selects and scopes** existing UDFs; it does **not** own new fields and does **not** inject default values in v1.
3. The validation pipeline **does** change: `FieldValueValidator` validates against the idea type's *resolved* fields (with per-type required-ness for `Curated` types, global required for `AllActiveFields` types), not the full active-definition list. See the linked spec's "Effective-field resolution."
4. Default-value injection (an `IdeaTemplate`-style stub) remains architecturally possible on top of the `IdeaType`/`IdeaTypeField` entities, deferred to P2.

---

## Permissions Summary

| Role | View field definitions (admin UI) | Manage field definitions | Fill UDF values on idea form | View UDF values on idea detail |
|---|---|---|---|---|
| `SiteAdmin` | ✅ | ✅ | ✅ | ✅ |
| `OrgAdmin` | ✅ | ✅ | ✅ | ✅ |
| `User` | ❌ (admin UI hidden) | ❌ | ✅ | ✅ |
| `ReadOnly` | ❌ | ❌ | ❌ | ✅ |

---

## Acceptance Criteria

### Field Definition Management
- [ ] Only `SiteAdmin` and `OrgAdmin` can create, edit, reorder, and soft-delete field definitions
- [ ] Field definitions are scoped to the organization; all boards in the org share the schema
- [ ] Field names are unique within an organization when active (duplicate name rejected with `400`)
- [ ] Supported field types: `Text`, `Number`, `Date`, `Boolean`, `Dropdown`, `MultiSelect`, `Url`
- [ ] `Dropdown` and `MultiSelect` fields require at least one option on create
- [ ] Display order is admin-configurable and persisted independently
- [ ] Deleting a field definition is a soft delete; the definition and its values are preserved
- [ ] Soft-deleted fields are hidden from idea forms and filter panels
- [ ] `GET .../field-definitions?includeDeleted=true` returns soft-deleted definitions to admins
- [ ] Archived fields' definitions still appear by name in audit records

### Field Values on Ideas
- [ ] UDF fields appear in the create modal and the Idea Detail drawer edit form, ordered by `DisplayOrder`
- [ ] Required UDF fields block idea save when empty (hard validation)
- [ ] Validation error messages use the format: `<FieldName> is required.`
- [ ] Type validation errors use the format: `<FieldName> must be a valid <FormatName>.`
- [ ] `Dropdown` and `MultiSelect` values must reference valid option IDs belonging to that field
- [ ] `MultiSelect` values must contain no duplicate option IDs
- [ ] UDF values are returned in `IdeaDetailModel.fieldValues`
- [ ] `IdeaListItemModel` does not include UDF values
- [ ] A newly created field definition has no value on existing ideas (null/empty — no backfill)
- [ ] Submitting a field value for a soft-deleted field definition returns `400`

### Audit
- [ ] Adding, changing, or clearing a UDF value emits an `IdeaFieldValueChanged` audit event
- [ ] Audit records include field definition ID, field name, previous value, new value, actor, and timestamp
- [ ] Soft-deleted field definition names are preserved in historical audit entries

### Filtering and Search
- [ ] Ideas list supports `fieldFilters[<id>]=<value>` query parameters
- [ ] Text and Url types use contains matching; Number and Date types use range matching; Boolean/Dropdown/MultiSelect use equality / any-of matching
- [ ] The global `search` parameter on the ideas list also scans Text and Url UDF values
- [ ] Unknown or invalid `fieldDefinitionId` keys in `fieldFilters` are silently ignored

### CSV Export / Import
- [ ] CSV export of ideas includes one column per active UDF field (column header = field name)
- [ ] Soft-deleted field definitions are excluded from export column headers but their values are omitted (not orphaned data exposed)
- [ ] CSV import accepts UDF columns matched by field name (case-insensitive); unrecognized column headers are ignored
- [ ] Import applies the same type validation as the API write contract for each UDF value
- [ ] Import treats missing or empty UDF columns as null; required-field violations are reported per-row in the import error summary
- [ ] CSV column order for UDF fields follows `DisplayOrder`

---

## Effort Sizing

| Layer | Work | Estimated Effort |
|---|---|---|
| **Domain** | 3 new entities, 1 enum, `Idea` nav property | S — 0.5 day |
| **Infrastructure / EF Core** | DbContext config, migration, index definitions | S — 0.5 day |
| **Application** | `IFieldDefinitionService` + impl, UDF validation, audit emission, filter query extension | M — 2–3 days |
| **API** | `FieldDefinitionsController` (6 endpoints), extend idea models, extend `IdeaListQueryModel` | S–M — 1–1.5 days |
| **Client — Admin UI** | Field definition list, editor, option sub-editor, settings navigation | M — 2 days |
| **Client — Idea Form** | Dynamic UDF field rendering (7 types), validation, form integration | M — 2–3 days |
| **Client — Filter Panel** | Dynamic filter controls per type, query-string serialization | S–M — 1–1.5 days |
| **Client — API Client** | `IFieldDefinitionApiClient` + impl, `FieldDefinitionCacheService` | XS — 0.5 day |
| **Tests** | Unit tests: validation rules, type parsing, soft-delete behavior, audit emission | M — 2 days |
| **Total** | | **~12–16 dev-days** |
