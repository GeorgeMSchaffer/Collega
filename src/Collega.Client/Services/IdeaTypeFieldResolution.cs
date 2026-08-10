namespace Collega.Client.Services;

// Client-side realization of the spec's ResolveEffectiveFields algorithm
// (SPEC/20-feature-idea-type-fields.md "Effective-field resolution"). The idea create form, the idea
// edit form, and the reassign preview all resolve the fields a type shows the same way, so the logic
// lives here once.
//
// RECONCILIATION RISK / TODO: this resolves client-side from the type's FieldMode + Fields selection
// (carried on IdeaTypeOptionDto) combined with the org's active field-definition pool. There is no
// dedicated "resolved fields for type X" server read in the contract this slice was built against. If
// the backend later exposes one — or embeds the resolved set on the idea detail — prefer that single
// server round-trip over re-deriving it here, and delete this helper.
public static class IdeaTypeFieldResolution
{
    private const string CuratedMode = "Curated";

    /// <summary>
    /// Effective fields for an idea of the given type, in display order, each carrying its effective
    /// required-ness (per-type override when Curated, global default otherwise). Returned as
    /// <see cref="FieldDefinitionDto"/> instances (with <c>IsRequired</c> overridden) so the existing
    /// <c>IdeaFieldInputs</c> component and read-only projections consume them unchanged.
    /// </summary>
    /// <param name="type">The idea's type; null falls back to all active fields.</param>
    /// <param name="activeOrgFields">The org's ACTIVE field definitions (already display-ordered).</param>
    public static IReadOnlyList<FieldDefinitionDto> Resolve(
        IdeaTypeOptionDto? type, IReadOnlyList<FieldDefinitionDto> activeOrgFields)
    {
        var curated = string.Equals(type?.FieldMode, CuratedMode, StringComparison.OrdinalIgnoreCase)
            && type?.Fields is { Count: > 0 };

        if (!curated)
        {
            // AllActiveFields: every active org field, ordered by global DisplayOrder then Name, with
            // the field's own global IsRequired.
            return activeOrgFields
                .OrderBy(f => f.DisplayOrder)
                .ThenBy(f => f.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        // Curated: only the type's mapped links whose field definition is still active, ordered by the
        // link's per-type DisplayOrder then the field Name, with the per-type IsRequired override. A
        // soft-deleted field is filtered out here even if a stale link still references it.
        var byId = activeOrgFields.ToDictionary(f => f.FieldDefinitionId);
        return type!.Fields!
            .Where(link => byId.ContainsKey(link.FieldDefinitionId))
            .OrderBy(link => link.DisplayOrder)
            .ThenBy(link => byId[link.FieldDefinitionId].Name, StringComparer.OrdinalIgnoreCase)
            .Select(link => byId[link.FieldDefinitionId] with { IsRequired = link.IsRequired })
            .ToList();
    }
}
