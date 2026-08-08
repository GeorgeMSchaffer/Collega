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
