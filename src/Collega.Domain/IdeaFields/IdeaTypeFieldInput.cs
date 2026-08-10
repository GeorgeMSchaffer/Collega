namespace Collega.Domain.IdeaFields;

/// <summary>
/// One entry in a replace-the-selection request passed to <see cref="IdeaType.SetFieldSelection"/>.
/// The Application layer validates that <see cref="FieldDefinitionId"/> is an active field in the
/// type's organization before constructing this.
/// </summary>
public sealed record IdeaTypeFieldInput(Guid FieldDefinitionId, int DisplayOrder, bool IsRequired);
