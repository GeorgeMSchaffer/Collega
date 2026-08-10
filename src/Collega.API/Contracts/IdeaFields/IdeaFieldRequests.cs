using Collega.API.Validation;
using Collega.Domain.IdeaFields;

namespace Collega.API.Contracts.IdeaFields;

public sealed class CreateIdeaTypeRequest
{
    [RequiredField]
    [MaxLengthField(IdeaType.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Optional; appended to the end of the current order when omitted.</summary>
    public int? SortOrder { get; set; }
}

public sealed class UpdateIdeaTypeRequest
{
    [RequiredField]
    [MaxLengthField(IdeaType.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    public int? SortOrder { get; set; }
}

public sealed class ReorderIdeaTypesRequest
{
    [RequiredField]
    public List<Guid> OrderedIdeaTypeIds { get; set; } = new();
}

/// <summary>
/// Body for `PUT /organizations/{organizationId}/idea-types/{ideaTypeId}/fields`. The list is
/// authoritative: a non-empty selection switches the type to <c>Curated</c>; an empty (or omitted) list
/// clears it back to <c>AllActiveFields</c>.
/// </summary>
public sealed class SetIdeaTypeFieldsRequest
{
    public List<IdeaTypeFieldSelectionItem> Fields { get; set; } = new();
}

public sealed class IdeaTypeFieldSelectionItem
{
    [RequiredField]
    public Guid FieldDefinitionId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsRequired { get; set; }
}

/// <summary>Body for `PUT /organizations/{organizationId}/idea-types/{ideaTypeId}/appearance`. Either
/// field may be null to clear it; <c>ColorHex</c> must be <c>#RRGGBB</c> when present.</summary>
public sealed class SetIdeaTypeAppearanceRequest
{
    [MaxLengthField(IdeaType.ColorHexLength)]
    public string? ColorHex { get; set; }

    [MaxLengthField(IdeaType.IconMaxLength)]
    public string? Icon { get; set; }
}

public sealed class CreateBusinessImpactRequest
{
    [RequiredField]
    [MaxLengthField(BusinessImpact.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(BusinessImpact.ColorMaxLength)]
    public string Color { get; set; } = string.Empty;

    public int? SortOrder { get; set; }
}

public sealed class UpdateBusinessImpactRequest
{
    [RequiredField]
    [MaxLengthField(BusinessImpact.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(BusinessImpact.ColorMaxLength)]
    public string Color { get; set; } = string.Empty;

    public int? SortOrder { get; set; }
}

public sealed class ReorderBusinessImpactsRequest
{
    [RequiredField]
    public List<Guid> OrderedBusinessImpactIds { get; set; } = new();
}
