using Collega.API.Validation;

namespace Collega.API.Contracts.Ideas;

/// <summary>Body for `PUT /api/v1/organizations/{organizationId}/ideas/{ideaId}/idea-type` — admin-only
/// reassignment of an idea's type. Must name an active Idea Type in the same organization.</summary>
public sealed class ReassignIdeaTypeRequest
{
    [RequiredField]
    public Guid IdeaTypeId { get; set; }
}
