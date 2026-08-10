namespace Collega.Client.Services;

// Wire DTOs for the organization-managed Idea Type / Business Impact option lists
// (SPEC/30-Contracts.md "Idea Field Option Contracts"). These are the required classification fields
// on every idea; the idea create/edit forms populate their selectors from these. Guids travel as
// JSON strings. Kept in their own file per the client's per-area DTO convention.

/// <summary>An Idea Type option row from <c>GET /organizations/{orgId}/idea-types</c>.
/// The Idea-Type Fields feature (SPEC/20-feature-idea-type-fields.md) adds the type's appearance
/// (<c>ColorHex</c>/<c>Icon</c>), its <c>FieldMode</c> (<c>AllActiveFields</c> | <c>Curated</c>), and its
/// direct-mapped field selection (<c>Fields</c>). These are appended and nullable so an older server that
/// doesn't yet return them deserializes cleanly (falls back to a neutral badge + all-active-fields).</summary>
public sealed record IdeaTypeOptionDto(
    string IdeaTypeId,
    string OrganizationId,
    string Name,
    int SortOrder,
    bool IsDeleted,
    string? ColorHex = null,
    string? Icon = null,
    string? FieldMode = null,
    IReadOnlyList<IdeaTypeFieldLinkDto>? Fields = null);

/// <summary>One type↔field mapping as returned on <see cref="IdeaTypeOptionDto"/> when a type is
/// <c>Curated</c>. Per-type order and required-ness live here (SPEC/20-feature-idea-type-fields.md
/// "New link entity: IdeaTypeField").</summary>
public sealed record IdeaTypeFieldLinkDto(string FieldDefinitionId, int DisplayOrder, bool IsRequired);

/// <summary>Body for creating/updating an Idea Type (<c>POST/PUT .../idea-types</c>). <c>SortOrder</c> is
/// optional on create (appended to the end when omitted).</summary>
public sealed record SaveIdeaTypeRequestDto(string Name, int? SortOrder);

/// <summary>Body for <c>POST .../idea-types/reorder</c> — the new catalog order by id.</summary>
public sealed record ReorderIdeaTypesRequestDto(List<string> OrderedIdeaTypeIds);

/// <summary>One field in a type's selection for
/// <c>PUT /organizations/{orgId}/idea-types/{id}/fields</c>.</summary>
public sealed record IdeaTypeFieldInputDto(string FieldDefinitionId, int DisplayOrder, bool IsRequired);

/// <summary>Body for <c>PUT /organizations/{orgId}/idea-types/{id}/fields</c>. A non-empty list switches
/// the type to <c>Curated</c>; an empty list clears it back to <c>AllActiveFields</c>.</summary>
public sealed record SetIdeaTypeFieldsRequestDto(IReadOnlyList<IdeaTypeFieldInputDto> Fields);

/// <summary>Body for <c>PUT /organizations/{orgId}/idea-types/{id}/appearance</c>. Either value may be
/// null to clear it (neutral badge / no icon).</summary>
public sealed record SetIdeaTypeAppearanceRequestDto(string? ColorHex, string? Icon);

/// <summary>Body for <c>PUT /organizations/{orgId}/ideas/{ideaId}/idea-type</c> (admin-only reassign).</summary>
public sealed record ReassignIdeaTypeRequestDto(string IdeaTypeId);

/// <summary>A Business Impact option row from <c>GET /organizations/{orgId}/business-impacts</c>.</summary>
public sealed record BusinessImpactOptionDto(
    string BusinessImpactId,
    string Name,
    string Color,
    int SortOrder,
    bool IsDeleted);
