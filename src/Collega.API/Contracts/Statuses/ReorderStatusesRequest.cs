using Collega.API.Validation;

namespace Collega.API.Contracts.Statuses;

/// <summary>Request shape for `POST /api/v1/organizations/{organizationId}/statuses/reorder` — the new
/// catalog order (by id) for the organization's active statuses. Must name every active status exactly once.</summary>
public sealed class ReorderStatusesRequest
{
    [RequiredField]
    public List<Guid> OrderedStatusIds { get; set; } = new();
}
