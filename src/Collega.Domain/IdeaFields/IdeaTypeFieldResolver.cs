using Collega.Domain.Fields;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// The single source of truth for which User-Defined Fields an idea of a given type resolves to, and
/// whether each is required (SPEC/20-feature-idea-type-fields.md "Effective-field resolution"). Consumed
/// by the idea form, the value validator, and the detail projection so all three agree.
/// </summary>
public static class IdeaTypeFieldResolver
{
    /// <summary>
    /// Resolves the effective fields for <paramref name="ideaType"/>. The type's set resolves even when the
    /// type itself is soft-deleted — archival of the type does not change an existing idea's schema.
    /// </summary>
    /// <param name="ideaType">The idea's type (with its <see cref="IdeaType.Fields"/> links loaded).</param>
    /// <param name="activeOrgFieldDefinitions">
    /// The organization's active (non-soft-deleted) field definitions. A soft-deleted definition never
    /// appears in either branch, even if a <see cref="IdeaTypeFieldMode.Curated"/> link still references it.
    /// </param>
    public static IReadOnlyList<EffectiveField> ResolveEffectiveFields(
        IdeaType ideaType,
        IReadOnlyList<FieldDefinition> activeOrgFieldDefinitions)
    {
        ArgumentNullException.ThrowIfNull(ideaType);
        ArgumentNullException.ThrowIfNull(activeOrgFieldDefinitions);

        // Guard against a caller that passed archived definitions in — resolution never surfaces them.
        var activeById = activeOrgFieldDefinitions
            .Where(d => !d.IsDeleted)
            .ToDictionary(d => d.Id);

        if (ideaType.FieldMode == IdeaTypeFieldMode.AllActiveFields)
        {
            return activeById.Values
                .OrderBy(d => d.DisplayOrder)
                .ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                .Select(d => new EffectiveField(d, d.IsRequired))
                .ToList();
        }

        return ideaType.Fields
            .Where(link => activeById.ContainsKey(link.FieldDefinitionId))
            .OrderBy(link => link.DisplayOrder)
            .ThenBy(link => activeById[link.FieldDefinitionId].Name, StringComparer.OrdinalIgnoreCase)
            .Select(link => new EffectiveField(activeById[link.FieldDefinitionId], link.IsRequired))
            .ToList();
    }
}
