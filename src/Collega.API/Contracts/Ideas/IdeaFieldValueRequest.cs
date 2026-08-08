using Collega.API.Validation;

namespace Collega.API.Contracts.Ideas;

/// <summary>
/// One User-Defined Field value on an idea create/update payload
/// (SPEC/20-feature-user-defined-fields.md). <c>Value</c> is the raw string interpreted per the field's
/// type; null or empty clears the value. Validation against the field schema happens in the Application
/// layer.
/// </summary>
public sealed class IdeaFieldValueRequest
{
    [RequiredField]
    public Guid FieldDefinitionId { get; set; }

    public string? Value { get; set; }
}
