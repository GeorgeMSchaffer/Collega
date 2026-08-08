using Collega.API.Validation;
using Collega.Domain.Fields;

namespace Collega.API.Contracts.FieldDefinitions;

/// <summary>
/// Request shape for `POST /api/v1/organizations/{organizationId}/field-definitions`
/// (SPEC/20-feature-user-defined-fields.md). <c>Options</c> is required for Dropdown/MultiSelect types
/// and rejected for others; <c>DisplayOrder</c> is optional and appends to the end when omitted.
/// </summary>
public sealed class CreateFieldDefinitionRequest
{
    [RequiredField]
    [MaxLengthField(FieldDefinition.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    [MaxLengthField(FieldDefinition.DescriptionMaxLength)]
    public string? Description { get; set; }

    [RequiredField]
    public string FieldType { get; set; } = string.Empty;

    public bool IsRequired { get; set; }

    public int? DisplayOrder { get; set; }

    public List<FieldOptionRequest> Options { get; set; } = new();
}
