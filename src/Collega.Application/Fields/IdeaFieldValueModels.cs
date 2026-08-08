namespace Collega.Application.Fields;

/// <summary>A raw User-Defined Field value submitted with an idea create/update payload.</summary>
public sealed record IdeaFieldValueWrite(Guid FieldDefinitionId, string? Value);

/// <summary>
/// A resolved User-Defined Field value returned on the idea detail
/// (SPEC/20-feature-user-defined-fields.md "IdeaDetailModel extension"). Only values for active
/// (non-archived) field definitions are surfaced.
/// </summary>
public sealed record IdeaFieldValueDto(Guid FieldDefinitionId, string FieldName, string FieldType, string? Value);
