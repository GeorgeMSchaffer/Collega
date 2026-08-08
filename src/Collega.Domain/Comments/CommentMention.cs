using Collega.Domain.Common;

namespace Collega.Domain.Comments;

/// <summary>
/// A resolved @-mention of a same-organization user on a comment
/// (SPEC/20-feature-ideas-and-engagement.md "Comments" #5, "Mentions"). Comments support the same
/// email-based mention behavior as ideas.
/// </summary>
public sealed class CommentMention : EntityBase
{
    public Guid CommentId { get; private set; }
    public Guid MentionedUserId { get; private set; }

    private CommentMention()
    {
    }

    internal CommentMention(Guid commentId, Guid mentionedUserId)
    {
        CommentId = commentId;
        MentionedUserId = mentionedUserId;
    }
}
