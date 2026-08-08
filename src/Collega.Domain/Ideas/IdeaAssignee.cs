using Collega.Domain.Common;

namespace Collega.Domain.Ideas;

/// <summary>
/// Assignment of a user to an idea (SPEC/20-feature-ideas-and-engagement.md "Assignment cardinality":
/// zero to five distinct users). Active-user and same-organization validation happens in the
/// application layer before the assignee is added.
/// </summary>
public sealed class IdeaAssignee : EntityBase
{
    public Guid IdeaId { get; private set; }
    public Guid UserId { get; private set; }

    private IdeaAssignee()
    {
    }

    internal IdeaAssignee(Guid ideaId, Guid userId)
    {
        IdeaId = ideaId;
        UserId = userId;
    }
}
