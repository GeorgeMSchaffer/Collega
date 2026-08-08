using Collega.API.Validation;
using Collega.Domain.Fields;

namespace Collega.API.Contracts.FieldDefinitions;

/// <summary>
/// One selectable option for a Dropdown/MultiSelect field. <c>OptionId</c> is optional: supply the
/// existing option's id when editing so its identity (and any idea values referencing it) is kept.
/// </summary>
public sealed class FieldOptionRequest
{
    public Guid? OptionId { get; set; }

    [RequiredField]
    [MaxLengthField(FieldDefinitionOption.LabelMaxLength)]
    public string Label { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }
}
