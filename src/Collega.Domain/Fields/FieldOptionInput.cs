namespace Collega.Domain.Fields;

/// <summary>
/// Caller-supplied option state passed to <see cref="FieldDefinition.SetOptions"/>. A non-null
/// <see cref="Id"/> targets an existing <see cref="FieldDefinitionOption"/> so its identity (and any
/// idea values referencing it) is preserved across an edit; a null <see cref="Id"/> creates a new one.
/// </summary>
public sealed record FieldOptionInput(Guid? Id, string Label, int DisplayOrder);
