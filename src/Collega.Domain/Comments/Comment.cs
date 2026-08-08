using Collega.Domain.Common;

namespace Collega.Domain.Comments;

/// <summary>
/// A plain-text comment on an idea (SPEC/20-feature-ideas-and-engagement.md "Comments"). All
/// authenticated users, including Read Only, can comment. Bodies allow line breaks and are limited
/// to <see cref="BodyMaxLength"/> characters. Authors may edit and delete their own comments;
/// in-scope admins may delete any. Comments carry the same email-based mentions as ideas.
/// </summary>
public sealed class Comment : AuditableEntityBase
{
    public const int BodyMaxLength = 2000;

    private readonly List<CommentMention> _mentions = new();

    public Guid IdeaId { get; private set; }
    public Guid AuthorUserId { get; private set; }
    public string Body { get; private set; } = string.Empty;

    public IReadOnlyList<CommentMention> Mentions => _mentions;

    private Comment()
    {
    }

    public static Comment Create(
        Guid ideaId,
        Guid authorUserId,
        string body,
        IReadOnlyCollection<Guid> mentionUserIds,
        DateTime nowUtc)
    {
        if (ideaId == Guid.Empty)
        {
            throw new ArgumentException("Idea id is required.", nameof(ideaId));
        }

        if (authorUserId == Guid.Empty)
        {
            throw new ArgumentException("Author id is required.", nameof(authorUserId));
        }

        var comment = new Comment
        {
            IdeaId = ideaId,
            AuthorUserId = authorUserId
        };

        comment.SetBody(body);
        comment.SetMentions(mentionUserIds);
        comment.MarkCreated(nowUtc, authorUserId);
        return comment;
    }

    public void Edit(string body, IReadOnlyCollection<Guid> mentionUserIds, DateTime nowUtc, Guid? actorUserId)
    {
        SetBody(body);
        SetMentions(mentionUserIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    private void SetBody(string body)
    {
        if (string.IsNullOrWhiteSpace(body))
        {
            throw new ArgumentException("Comment is required.", nameof(body));
        }

        var trimmed = body.Trim();
        if (trimmed.Length > BodyMaxLength)
        {
            throw new ArgumentException($"Comment must be {BodyMaxLength} characters or fewer.", nameof(body));
        }

        Body = trimmed;
    }

    private void SetMentions(IReadOnlyCollection<Guid>? mentionUserIds)
    {
        _mentions.Clear();
        if (mentionUserIds is null)
        {
            return;
        }

        foreach (var userId in mentionUserIds.Where(id => id != Guid.Empty).Distinct())
        {
            _mentions.Add(new CommentMention(Id, userId));
        }
    }
}
