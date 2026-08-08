using Collega.API.Validation;

namespace Collega.API.Contracts.FieldDefinitions;

/// <summary>
/// Request shape for `PUT /api/v1/organizations/{organizationId}/field-definitions/reorder`. The list
/// is the new display order for the organization's active field definitions.
/// </summary>
public sealed class ReorderFieldDefinitionsRequest
{
    [RequiredField]
    public List<Guid> OrderedIds { get; set; } = new();
}
