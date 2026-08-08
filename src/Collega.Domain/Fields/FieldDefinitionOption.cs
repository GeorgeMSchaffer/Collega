using Collega.Domain.Common;

namespace Collega.Domain.Fields;

/// <summary>
/// A selectable choice belonging to a <see cref="FieldDefinition"/> of type
/// <see cref="FieldType.Dropdown"/> or <see cref="FieldType.MultiSelect"/>
/// (SPEC/20-feature-user-defined-fields.md). An <c>IdeaFieldValue</c> for those types stores the
/// option's <see cref="EntityBase.Id"/> (a GUID), so option identity must be preserved across edits
/// — <see cref="FieldDefinition.SetOptions"/> matches on <c>Id</c> to keep existing option rows.
/// </summary>
public sealed class FieldDefinitionOption : EntityBase
{
    public const int LabelMaxLength = 200;

    public Guid FieldDefinitionId { get; private set; }
    public string Label { get; private set; } = string.Empty;
    public int DisplayOrder { get; private set; }

    private FieldDefinitionOption()
    {
    }

    internal FieldDefinitionOption(Guid fieldDefinitionId, string label, int displayOrder)
    {
        FieldDefinitionId = fieldDefinitionId;
        Label = NormalizeLabel(label);
        DisplayOrder = displayOrder;
    }

    internal void Update(string label, int displayOrder)
    {
        Label = NormalizeLabel(label);
        DisplayOrder = displayOrder;
    }

    private static string NormalizeLabel(string label)
    {
        if (string.IsNullOrWhiteSpace(label))
        {
            throw new ArgumentException("Option label is required.", nameof(label));
        }

        var trimmed = label.Trim();
        if (trimmed.Length > LabelMaxLength)
        {
            throw new ArgumentException($"Option label must be {LabelMaxLength} characters or fewer.", nameof(label));
        }

        return trimmed;
    }
}
