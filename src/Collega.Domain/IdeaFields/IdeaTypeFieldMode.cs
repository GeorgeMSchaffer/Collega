namespace Collega.Domain.IdeaFields;

/// <summary>
/// Controls which User-Defined Fields an <see cref="IdeaType"/> resolves to
/// (SPEC/20-feature-idea-type-fields.md "Effective-field resolution").
/// </summary>
public enum IdeaTypeFieldMode
{
    /// <summary>Backward-compatible default: show every active org field, using each field's global <c>IsRequired</c>.</summary>
    AllActiveFields = 0,

    /// <summary>Show only the type's mapped <see cref="IdeaTypeField"/> links, using each link's per-type <c>IsRequired</c>.</summary>
    Curated = 1,
}
