using Collega.Domain.Common;

namespace Collega.Domain.Fields;

/// <summary>
/// The value of one <see cref="FieldDefinition"/> for one idea (SPEC/20-feature-user-defined-fields.md).
/// Values are stored as strings and interpreted per the definition's <see cref="FieldType"/>; the
/// Application layer validates and serializes them before they reach here (Number → invariant decimal
/// string, Date → yyyy-MM-dd, Boolean → "true"/"false", Dropdown → option GUID, MultiSelect →
/// comma-separated option GUIDs). One row per (idea, field definition).
/// </summary>
public sealed class IdeaFieldValue : AuditableEntityBase
{
    public const int ValueMaxLength = 4000;

    public Guid IdeaId { get; private set; }
    public Guid FieldDefinitionId { get; private set; }
    public string? Value { get; private set; }

    private IdeaFieldValue()
    {
    }

    internal IdeaFieldValue(Guid ideaId, Guid fieldDefinitionId, string? value, DateTime nowUtc, Guid? actorUserId)
    {
        if (ideaId == Guid.Empty)
        {
            throw new ArgumentException("Idea id is required.", nameof(ideaId));
        }

        if (fieldDefinitionId == Guid.Empty)
        {
            throw new ArgumentException("Field definition id is required.", nameof(fieldDefinitionId));
        }

        IdeaId = ideaId;
        FieldDefinitionId = fieldDefinitionId;
        Value = NormalizeValue(value);
        MarkCreated(nowUtc, actorUserId);
    }

    internal void SetValue(string? value, DateTime nowUtc, Guid? actorUserId)
    {
        Value = NormalizeValue(value);
        MarkUpdated(nowUtc, actorUserId);
    }

    private static string? NormalizeValue(string? value)
    {
        if (value is null)
        {
            return null;
        }

        if (value.Length > ValueMaxLength)
        {
            throw new ArgumentException($"Field value must be {ValueMaxLength} characters or fewer.", nameof(value));
        }

        return value;
    }
}
