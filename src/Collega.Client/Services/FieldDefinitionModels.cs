namespace Collega.Client.Services;

// Wire DTOs for the organization User-Defined Field definition API
// (SPEC/20-feature-user-defined-fields.md "API Endpoints"). Guids travel as JSON strings, so they map
// to `string` here, matching the client's DTO convention. FieldType is the serialized enum name
// (Text, Number, Date, Boolean, Dropdown, MultiSelect, Url) — the same token the server round-trips.

/// <summary>One selectable option on a Dropdown/MultiSelect field definition.</summary>
public sealed record FieldOptionDto(string OptionId, string Label, int DisplayOrder);

/// <summary>
/// A field definition as returned by <c>GET .../field-definitions</c> (array) and the single-item
/// GET/POST/PUT endpoints. <c>IsDeleted</c> flags a soft-archived definition (hidden from idea forms).
/// </summary>
public sealed record FieldDefinitionDto(
    string FieldDefinitionId,
    string OrganizationId,
    string Name,
    string? Description,
    string FieldType,
    bool IsRequired,
    int DisplayOrder,
    bool IsDeleted,
    IReadOnlyList<FieldOptionDto> Options);

/// <summary>
/// One option in a create/update request. Supply <c>OptionId</c> to preserve an existing option's
/// identity (and any idea values referencing it) across an edit; leave it null to create a new one.
/// </summary>
public sealed record SaveFieldOptionDto(string? OptionId, string Label, int DisplayOrder);

/// <summary>
/// Body for both <c>POST .../field-definitions</c> and <c>PUT .../field-definitions/{id}</c>.
/// <c>FieldType</c> is immutable on update (a differing value is rejected server-side); <c>Options</c>
/// is required for Dropdown/MultiSelect and rejected for the other types.
/// </summary>
public sealed record SaveFieldDefinitionRequestDto(
    string Name,
    string? Description,
    string FieldType,
    bool IsRequired,
    int? DisplayOrder,
    IReadOnlyList<SaveFieldOptionDto> Options);

/// <summary>Body for <c>PUT .../field-definitions/reorder</c> — the new display order (by id) for the
/// organization's active field definitions.</summary>
public sealed record ReorderFieldDefinitionsRequestDto(IReadOnlyList<string> OrderedIds);
