# Feature: User-Defined Fields (UDFs) for Ideas

## Overview

Organizations can extend the `Idea` entity with custom fields (User-Defined Fields / UDFs) to capture domain-specific data not covered by the core idea schema. Field definitions are owned at the organization level and are shared across all boards. Admins manage the schema; all org members can fill in UDF values on idea forms.

---

## Design Decisions (Interview-Resolved)

| Decision | Resolution |
|---|---|
| Scope | Organization-level — all boards share one field schema |
| Supported types | Text, Number, Date, Boolean, Dropdown (single-select), Multi-select, URL |
| Required fields | Hard validation — missing required UDF field blocks idea save |
| Field ordering | Admin-configurable display order; drag-and-drop reorder |
| Visibility / access | All org users see and fill UDF fields on idea forms; only Admins can manage field definitions |
| Templates integration | UDF design must be forward-compatible with a future idea-template feature |
| CSV export / import | UDF values are included as columns in CSV export and CSV import |
| Filtering / search | UDF values are filterable and full-text searchable in the ideas list |
| History / audit | UDF value changes are tracked in the audit log |
| New-field migration | Existing ideas receive `null`/empty value for new fields; no backfill |
| Field deletion | Soft delete — definition is archived; values are preserved but hidden from the UI |

---

## Domain Model

### New Entities

#### `FieldDefinition` (extends `AuditableEntityBase`)

```csharp
public sealed class FieldDefinition : AuditableEntityBase
{
    public Guid OrganizationId { get; set; }
    public Organization Organization { get; set; } = null!;

    public string Name { get; set; } = string.Empty;           // max 100
    public string? Description { get; set; }                    // max 500

    public FieldType FieldType { get; set; }

    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }

    // Soft delete
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAtUtc { get; set; }
    public Guid? DeletedByUserId { get; set; }

    public ICollection<FieldDefinitionOption> Options { get; set; } = new List<FieldDefinitionOption>();
    public ICollection<IdeaFieldValue> IdeaFieldValues { get; set; } = new List<IdeaFieldValue>();
}
```

#### `FieldDefinitionOption` (extends `EntityBase`)

Applies only to `Dropdown` and `MultiSelect` field types.

```csharp
public sealed class FieldDefinitionOption : EntityBase
{
    public Guid FieldDefinitionId { get; set; }
    public FieldDefinition FieldDefinition { get; set; } = null!;

    public string Label { get; set; } = string.Empty;  // max 200
    public int DisplayOrder { get; set; }
}
```

#### `IdeaFieldValue` (extends `AuditableEntityBase`)

Stores the value of one UDF for one idea. Values are serialized as strings and interpreted per `FieldType`.

```csharp
public sealed class IdeaFieldValue : AuditableEntityBase
{
    public Guid IdeaId { get; set; }
    public Idea Idea { get; set; } = null!;

    public Guid FieldDefinitionId { get; set; }
    public FieldDefinition FieldDefinition { get; set; } = null!;

    // Serialization format per type:
    // Text / Url   → raw string (max 2000 / 2048)
    // Number       → invariant decimal string (e.g. "50000.00")
    // Date         → ISO-8601 date (yyyy-MM-dd)
    // Boolean      → "true" / "false"
    // Dropdown     → single FieldDefinitionOption.Id (GUID string)
    // MultiSelect  → comma-separated FieldDefinitionOption.Id GUIDs, no duplicates
    public string? Value { get; set; }
}
```

#### `FieldType` enum

```csharp
public enum FieldType
{
    Text       = 1,
    Number     = 2,
    Date       = 3,
    Boolean    = 4,
    Dropdown   = 5,
    MultiSelect = 6,
    Url        = 7,
}
```

### Modified Entities

`Idea` gains a navigation property:

```csharp
public ICollection<IdeaFieldValue> FieldValues { get; set; } = new List<IdeaFieldValue>();
```

### Database Indices

| Table | Index | Notes |
|---|---|---|
| `FieldDefinitions` | Unique on `(OrganizationId, Name)` filtered where `IsDeleted = 0` | Prevents duplicate active names per org |
| `IdeaFieldValues` | Unique on `(IdeaId, FieldDefinitionId)` | One value row per field per idea |
| `IdeaFieldValues` | Non-unique on `(FieldDefinitionId, Value)` | Supports filter/sort queries |

---

## EF Core Configuration

```csharp
// FieldDefinition
modelBuilder.Entity<FieldDefinition>()
    .HasIndex(f => new { f.OrganizationId, f.Name })
    .HasFilter("[IsDeleted] = 0")
    .IsUnique();

modelBuilder.Entity<FieldDefinition>()
    .Property(f => f.Name).HasMaxLength(100);

modelBuilder.Entity<FieldDefinition>()
    .Property(f => f.Description).HasMaxLength(500);

// FieldDefinitionOption
modelBuilder.Entity<FieldDefinitionOption>()
    .Property(o => o.Label).HasMaxLength(200);

// IdeaFieldValue
modelBuilder.Entity<IdeaFieldValue>()
    .HasIndex(v => new { v.IdeaId, v.FieldDefinitionId })
    .IsUnique();

modelBuilder.Entity<IdeaFieldValue>()
    .HasIndex(v => new { v.FieldDefinitionId, v.Value });

modelBuilder.Entity<IdeaFieldValue>()
    .Property(v => v.Value).HasMaxLength(4000);
```

---

## Migration Strategy

### EF Core Migration: `AddUserDefinedFields`

Creates three new tables; no backfill required because null/empty is the correct default for existing ideas.

```sql
-- FieldDefinitions
CREATE TABLE FieldDefinitions (
    Id               UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    OrganizationId   UNIQUEIDENTIFIER NOT NULL,
    Name             NVARCHAR(100)    NOT NULL,
    Description      NVARCHAR(500)    NULL,
    FieldType        INT              NOT NULL,
    IsRequired       BIT              NOT NULL DEFAULT 0,
    DisplayOrder     INT              NOT NULL DEFAULT 0,
    IsDeleted        BIT              NOT NULL DEFAULT 0,
    DeletedAtUtc     DATETIME2        NULL,
    DeletedByUserId  UNIQUEIDENTIFIER NULL,
    CreatedAtUtc     DATETIME2        NOT NULL,
    UpdatedAtUtc     DATETIME2        NULL,
    CONSTRAINT FK_FieldDefinitions_Organizations FOREIGN KEY (OrganizationId) REFERENCES Organizations(Id)
);

CREATE UNIQUE INDEX UIX_FieldDefinitions_OrgName
    ON FieldDefinitions (OrganizationId, Name)
    WHERE IsDeleted = 0;

-- FieldDefinitionOptions
CREATE TABLE FieldDefinitionOptions (
    Id                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    FieldDefinitionId UNIQUEIDENTIFIER NOT NULL,
    Label             NVARCHAR(200)    NOT NULL,
    DisplayOrder      INT              NOT NULL DEFAULT 0,
    CONSTRAINT FK_FieldDefinitionOptions_FieldDefinitions
        FOREIGN KEY (FieldDefinitionId) REFERENCES FieldDefinitions(Id) ON DELETE CASCADE
);

-- IdeaFieldValues
CREATE TABLE IdeaFieldValues (
    Id                UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
    IdeaId            UNIQUEIDENTIFIER NOT NULL,
    FieldDefinitionId UNIQUEIDENTIFIER NOT NULL,
    Value             NVARCHAR(4000)   NULL,
    CreatedAtUtc      DATETIME2        NOT NULL,
    UpdatedAtUtc      DATETIME2        NULL,
    CONSTRAINT FK_IdeaFieldValues_Ideas
        FOREIGN KEY (IdeaId) REFERENCES Ideas(Id) ON DELETE CASCADE,
    CONSTRAINT FK_IdeaFieldValues_FieldDefinitions
        FOREIGN KEY (FieldDefinitionId) REFERENCES FieldDefinitions(Id)
);

CREATE UNIQUE INDEX UIX_IdeaFieldValues_IdeaField
    ON IdeaFieldValues (IdeaId, FieldDefinitionId);

CREATE INDEX IX_IdeaFieldValues_Filter
    ON IdeaFieldValues (FieldDefinitionId, Value);
```

---

## API Endpoints

All routes follow existing conventions: path versioning under `/api/v1`, plural nouns, org-scoped.

### Field Definitions (Admin only: `OrgAdmin` or `SiteAdmin`)

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/v1/organizations/{orgId}/field-definitions` | List all field definitions (`?includeDeleted=true` for archived) |
| `POST` | `/api/v1/organizations/{orgId}/field-definitions` | Create a new field definition |
| `GET` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Get a single field definition |
| `PUT` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Update name, description, required, order, or options |
| `DELETE` | `/api/v1/organizations/{orgId}/field-definitions/{id}` | Soft-delete a field definition |
| `PUT` | `/api/v1/organizations/{orgId}/field-definitions/reorder` | Set display order for all definitions |

### UDF Values on Ideas

Field values are embedded inside existing idea create/update payloads and returned in `IdeaDetailModel`. No additional endpoints are required.

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

### Filtering Extension to `IdeaListQueryModel`

```
GET /api/v1/boards/{boardId}/ideas?fieldFilters[<fieldDefinitionId>]=<value>
```

Added property on `IdeaListQueryModel`:

```csharp
public Dictionary<Guid, string> FieldFilters { get; set; } = new();
```

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

### New Interface: `IFieldDefinitionService`

Located in `Collega.Application/FieldDefinitions/`

```csharp
public interface IFieldDefinitionService
{
    Task<ServiceResult<IReadOnlyList<FieldDefinitionModel>>> ListAsync(
        WorkflowActorContext actor, Guid organizationId, bool includeDeleted, CancellationToken ct);

    Task<ServiceResult<FieldDefinitionModel>> GetAsync(
        WorkflowActorContext actor, Guid organizationId, Guid id, CancellationToken ct);

    Task<ServiceResult<FieldDefinitionModel>> CreateAsync(
        WorkflowActorContext actor, Guid organizationId, CreateFieldDefinitionRequest request, CancellationToken ct);

    Task<ServiceResult<FieldDefinitionModel>> UpdateAsync(
        WorkflowActorContext actor, Guid organizationId, Guid id, UpdateFieldDefinitionRequest request, CancellationToken ct);

    Task<ServiceResult> DeleteAsync(
        WorkflowActorContext actor, Guid organizationId, Guid id, CancellationToken ct);

    Task<ServiceResult> ReorderAsync(
        WorkflowActorContext actor, Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken ct);
}
```

### `IWorkflowManagementService` Extensions

Existing `CreateIdeaAsync` and `UpdateIdeaAsync` are extended to accept `IReadOnlyList<FieldValueWriteModel>` and run UDF validation before persistence.

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

**Audit Emission**

After each idea save, the service compares new vs. previous `IdeaFieldValue` rows and emits `IdeaFieldValueChanged` audit events for each changed, added, or cleared value:

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

```csharp
// Read model returned by the service
public sealed class FieldDefinitionModel
{
    public Guid FieldDefinitionId { get; init; }
    public Guid OrganizationId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public string FieldType { get; init; } = string.Empty;  // serialized enum string
    public bool IsRequired { get; init; }
    public int DisplayOrder { get; init; }
    public bool IsDeleted { get; init; }
    public IReadOnlyList<FieldOptionModel> Options { get; init; } = Array.Empty<FieldOptionModel>();
}

public sealed class FieldOptionModel
{
    public Guid OptionId { get; init; }
    public string Label { get; init; } = string.Empty;
    public int DisplayOrder { get; init; }
}

// Write models
public sealed class CreateFieldDefinitionRequest
{
    [Required][StringLength(100)] public string Name { get; set; } = string.Empty;
    [StringLength(500)] public string? Description { get; set; }
    [Required] public string FieldType { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public int DisplayOrder { get; set; }
    public IReadOnlyList<CreateFieldOptionRequest> Options { get; set; } = Array.Empty<CreateFieldOptionRequest>();
}

public sealed class CreateFieldOptionRequest
{
    [Required][StringLength(200)] public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

public sealed class UpdateFieldDefinitionRequest : CreateFieldDefinitionRequest { }

public sealed class ReorderFieldDefinitionsRequest
{
    [Required] public IReadOnlyList<Guid> OrderedIds { get; set; } = Array.Empty<Guid>();
}

// Embedded in idea write request
public sealed class FieldValueWriteModel
{
    public Guid FieldDefinitionId { get; set; }
    public string? Value { get; set; }
}

// Embedded in IdeaDetailModel
public sealed class IdeaFieldValueModel
{
    public Guid FieldDefinitionId { get; init; }
    public string FieldName { get; init; } = string.Empty;
    public string FieldType { get; init; } = string.Empty;
    public string? Value { get; init; }
}
```

---

## New API Controller

`Collega.API/Controllers/FieldDefinitionsController.cs`

Follows the same `ApiControllerBase` pattern. Delegates all logic to `IFieldDefinitionService`. No business logic in the controller.

```
GET    /api/v1/organizations/{orgId}/field-definitions           → 200 IReadOnlyList<FieldDefinitionModel>
POST   /api/v1/organizations/{orgId}/field-definitions           → 201 FieldDefinitionModel
GET    /api/v1/organizations/{orgId}/field-definitions/{id}      → 200 FieldDefinitionModel
PUT    /api/v1/organizations/{orgId}/field-definitions/{id}      → 200 FieldDefinitionModel
DELETE /api/v1/organizations/{orgId}/field-definitions/{id}      → 204
PUT    /api/v1/organizations/{orgId}/field-definitions/reorder   → 204
```

---

## Client UI Design

### Admin: Field Definition Manager

**Route**: `/organizations/{orgId}/settings/fields`

**Access**: Visible and navigable only for `OrgAdmin` and `SiteAdmin`.

**Components**:

| Component | Responsibility |
|---|---|
| `FieldDefinitionList.razor` | Scrollable list of active definitions; drag-handle for reorder; Edit / Archive buttons |
| `FieldDefinitionEditor.razor` | Create/edit dialog: name, description, type selector, required toggle, display order, options sub-editor |
| `FieldOptionEditor.razor` | Embedded in editor; add/remove/reorder option labels for Dropdown and MultiSelect types |

**Navigation**: Add "Custom Fields" link to the Organization Settings navigation menu.

**Behaviors**:
- Reorder via drag-and-drop; saves order immediately on drop (calls `PUT .../reorder`)
- Archiving a field shows a confirmation dialog; confirms that existing idea data will be hidden
- Archived fields can be viewed via a "Show archived" toggle; no restore feature in MVP

### Idea Form UDF Fields

**Location**: Idea create dialog and detail overlay, rendered below the standard fields in a collapsible "Custom Fields" section.

**Rendering per type**:

| Field Type | Blazor Component |
|---|---|
| `Text` | `FluentTextField` |
| `Number` | `FluentNumberField<decimal?>` |
| `Date` | `FluentDatePicker` |
| `Boolean` | `FluentCheckbox` |
| `Dropdown` | `FluentSelect` |
| `MultiSelect` | `FluentListbox` (multi) or tag-chip input |
| `Url` | `FluentTextField` with URI format annotation |

**Validation**: Required fields show inline error text on submit attempt using the canonical format `<FieldName> is required.`

**Field definition loading**: On component init, fetch from `GET /api/v1/organizations/{orgId}/field-definitions`. Cache in a scoped `FieldDefinitionCacheService` to avoid redundant fetches within the same session.

### Ideas List Filter Panel

A "Custom Fields" accordion section is added to the filter panel. Each active definition renders a type-appropriate filter control:

| Type | Filter control |
|---|---|
| Text / Url | Text input (contains match) |
| Number | Dual numeric inputs (min / max) |
| Date | Two date pickers (from / to) |
| Boolean | `FluentCheckbox` or three-state toggle (any / true / false) |
| Dropdown | Checkbox list of option labels |
| MultiSelect | Checkbox list of option labels (any-of match) |

Applied filters serialize to `fieldFilters[<id>]=<value>` in the query string.

### New Client API Client

`Collega.Client/FieldDefinitions/FieldDefinitionApiClient.cs`

```csharp
public interface IFieldDefinitionApiClient
{
    Task<IReadOnlyList<FieldDefinitionModel>> ListAsync(Guid organizationId, bool includeDeleted = false);
    Task<FieldDefinitionModel> CreateAsync(Guid organizationId, CreateFieldDefinitionRequest request);
    Task<FieldDefinitionModel> UpdateAsync(Guid organizationId, Guid id, UpdateFieldDefinitionRequest request);
    Task DeleteAsync(Guid organizationId, Guid id);
    Task ReorderAsync(Guid organizationId, ReorderFieldDefinitionsRequest request);
}
```

---

## Template Integration — Forward Compatibility

To ensure UDFs integrate cleanly with a future idea-template feature:

1. `FieldDefinition` and `FieldDefinitionOption` entities use stable `Guid` PKs — templates reference them by ID
2. When templates are introduced, an `IdeaTemplate` entity will supply default `FieldValueWriteModel` stubs, which are injected as the initial `fieldValues` on idea create
3. No changes to the UDF schema or validation pipeline will be required

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
- [ ] Deleting a field definition performs a soft delete; the definition and its values are preserved
- [ ] Soft-deleted fields are hidden from idea forms and filter panels
- [ ] `GET .../field-definitions?includeDeleted=true` returns soft-deleted definitions to admins
- [ ] Field definitions for archived fields continue to appear by name in audit records

### Field Values on Ideas
- [ ] UDF fields appear on the idea create and detail overlays, ordered by `DisplayOrder`
- [ ] Required UDF fields block idea save when empty (hard validation)
- [ ] Validation error messages use the format: `<FieldName> is required.`
- [ ] Type validation errors use the format: `<FieldName> must be a valid <FormatName>.`
- [ ] `Dropdown` and `MultiSelect` values must reference valid option IDs belonging to that field
- [ ] `MultiSelect` values must contain no duplicate option IDs
- [ ] UDF values are returned in `IdeaDetailModel.fieldValues`
- [ ] `IdeaListItemModel` does not include UDF values
- [ ] When a new field definition is created, existing ideas have no value for it (null/empty — no backfill)
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
