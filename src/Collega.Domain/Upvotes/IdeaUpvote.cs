using Collega.Domain.Common;

namespace Collega.Domain.Upvotes;

/// <summary>
/// A single user's active upvote on an idea (SPEC/20-feature-ideas-and-engagement.md "Upvotes").
/// Upvoting is a toggle: a user has at most one active upvote per idea (enforced by a unique
/// (idea, user) index), and only the user who cast an upvote can remove it.
/// </summary>
public sealed class IdeaUpvote : EntityBase
{
    public Guid IdeaId { get; private set; }
    public Guid UserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }

    private IdeaUpvote()
    {
    }

    public static IdeaUpvote Create(Guid ideaId, Guid userId, DateTime nowUtc)
    {
        if (ideaId == Guid.Empty)
        {
            throw new ArgumentException("Idea id is required.", nameof(ideaId));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        return new IdeaUpvote
        {
            IdeaId = ideaId,
            UserId = userId,
            CreatedAtUtc = nowUtc
        };
    }
}
