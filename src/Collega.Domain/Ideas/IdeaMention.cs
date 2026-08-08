using Collega.Domain.Common;

namespace Collega.Domain.Ideas;

/// <summary>
/// A resolved @-mention of a same-organization user on an idea
/// (SPEC/20-feature-ideas-and-engagement.md "Mentions"). Mentions are resolved to concrete users by
/// the application layer when the idea is saved; unresolved mentions block the save.
/// </summary>
public sealed class IdeaMention : EntityBase
{
    public Guid IdeaId { get; private set; }
    public Guid MentionedUserId { get; private set; }

    private IdeaMention()
    {
    }

    internal IdeaMention(Guid ideaId, Guid mentionedUserId)
    {
        IdeaId = ideaId;
        MentionedUserId = mentionedUserId;
    }
}
