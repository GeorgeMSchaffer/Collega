using Collega.Domain.Common;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// The association between an <see cref="IdeaType"/> and one of the organization's User-Defined Field
/// definitions (SPEC/20-feature-idea-type-fields.md). Per-type ordering and required-ness live here so
/// a field can be mandatory on one type and absent from another while the field pool stays shared.
/// Unique on <c>(IdeaTypeId, FieldDefinitionId)</c> — a field appears at most once per type.
/// </summary>
public sealed class IdeaTypeField : EntityBase
{
    public Guid IdeaTypeId { get; private set; }
    public Guid FieldDefinitionId { get; private set; }

    /// <summary>Order of this field within its owning type (independent of the field's global order).</summary>
    public int DisplayOrder { get; private set; }

    /// <summary>Required within this type; overrides the field definition's global default.</summary>
    public bool IsRequired { get; private set; }

    private IdeaTypeField()
    {
    }

    internal IdeaTypeField(Guid ideaTypeId, Guid fieldDefinitionId, int displayOrder, bool isRequired)
    {
        if (fieldDefinitionId == Guid.Empty)
        {
            throw new ArgumentException("Field definition id is required.", nameof(fieldDefinitionId));
        }

        IdeaTypeId = ideaTypeId;
        FieldDefinitionId = fieldDefinitionId;
        DisplayOrder = displayOrder;
        IsRequired = isRequired;
    }
}
