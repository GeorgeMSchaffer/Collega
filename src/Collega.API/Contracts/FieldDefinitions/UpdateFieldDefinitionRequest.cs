using Collega.API.Validation;
using Collega.Domain.Fields;

namespace Collega.API.Contracts.FieldDefinitions;

/// <summary>
/// Request shape for `PUT /api/v1/organizations/{organizationId}/field-definitions/{id}`. <c>FieldType</c>
/// must match the definition's existing type (type is immutable). For Dropdown/MultiSelect, supply each
/// option's <c>OptionId</c> to preserve it across the edit.
/// </summary>
public sealed class UpdateFieldDefinitionRequest
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
