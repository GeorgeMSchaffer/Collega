namespace Collega.Domain.Fields;

/// <summary>
/// A single validated field value submitted for an idea, passed to
/// <see cref="Collega.Domain.Ideas.Idea.ReplaceFieldValues"/>. A null or empty <see cref="Value"/>
/// means the field is cleared (no row is kept). The Application layer is responsible for validating
/// the value against the field's <c>FieldType</c> before constructing this.
/// </summary>
public sealed record IdeaFieldValueInput(Guid FieldDefinitionId, string? Value);
