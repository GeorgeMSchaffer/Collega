using Collega.Domain.Common;
using Collega.Domain.Enums;

namespace Collega.Domain.Ideas;

/// <summary>
/// An idea on a board (SPEC/20-feature-ideas-and-engagement.md "Idea Rules"). Aggregate root that
/// owns its assignee, tag, and mention associations. Status is derived from the swimlane the idea
/// sits in; the default on create is the board's left-most swimlane (rule #7, #27). Ideas in the
/// Complete status remain fully editable (rule #6). Deletion is a soft delete that preserves the row
/// and its audit history (rule #11).
/// </summary>
/// <remarks>
/// Idea Type and Business Impact (idea rules #2) are dedicated required organization-configurable
/// fields belonging to the "Organization-Managed Idea Fields" feature, which no current backlog
/// slice owns and which was not provisioned by the Tenant Administration slice. They are therefore
/// deliberately not modelled here yet; see the Collaboration slice notes in the implementation
/// tracker. The spec's own "Existing idea migration" decision (assign defaults to pre-existing
/// ideas) anticipates ideas existing before those fields are introduced.
/// </remarks>
public sealed class Idea : AuditableEntityBase
{
    public const int TitleMaxLength = 150;
    public const int DescriptionMaxLength = 4000;
    public const int MaxAssignees = 5;
    public const int MaxTags = 10;

    private readonly List<IdeaAssignee> _assignees = new();
    private readonly List<IdeaTag> _tags = new();
    private readonly List<IdeaMention> _mentions = new();

    public Guid OrganizationId { get; private set; }
    public Guid BoardId { get; private set; }
    public Guid StatusId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Priority Priority { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public Guid AuthorUserId { get; private set; }
    public bool IsDeleted { get; private set; }

    public IReadOnlyList<IdeaAssignee> Assignees => _assignees;
    public IReadOnlyList<IdeaTag> Tags => _tags;
    public IReadOnlyList<IdeaMention> Mentions => _mentions;

    private Idea()
    {
    }

    public static Idea Create(
        Guid organizationId,
        Guid boardId,
        Guid statusId,
        string title,
        string description,
        Priority priority,
        DateOnly? dueDate,
        Guid authorUserId,
        IReadOnlyCollection<Guid> assigneeUserIds,
        IReadOnlyCollection<Guid> tagIds,
        IReadOnlyCollection<Guid> mentionUserIds,
        DateTime nowUtc)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (boardId == Guid.Empty)
        {
            throw new ArgumentException("Board id is required.", nameof(boardId));
        }

        if (statusId == Guid.Empty)
        {
            throw new ArgumentException("Status id is required.", nameof(statusId));
        }

        if (authorUserId == Guid.Empty)
        {
            throw new ArgumentException("Author id is required.", nameof(authorUserId));
        }

        var idea = new Idea
        {
            OrganizationId = organizationId,
            BoardId = boardId,
            StatusId = statusId,
            AuthorUserId = authorUserId
        };

        idea.SetTitle(title);
        idea.SetDescription(description);
        idea.Priority = priority;
        idea.DueDate = dueDate;
        idea.SetAssignees(assigneeUserIds);
        idea.SetTags(tagIds);
        idea.SetMentions(mentionUserIds);

        idea.MarkCreated(nowUtc, authorUserId);
        return idea;
    }

    /// <summary>
    /// Updates the core editable fields (rule #6 keeps this available in the Complete status).
    /// Assignees, tags, and mentions are replaced through their own methods.
    /// </summary>
    public void UpdateContent(
        string title,
        string description,
        Priority priority,
        DateOnly? dueDate,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        SetTitle(title);
        SetDescription(description);
        Priority = priority;
        DueDate = dueDate;
        MarkUpdated(nowUtc, actorUserId);
    }

    public void ChangeStatus(Guid statusId, DateTime nowUtc, Guid? actorUserId)
    {
        if (statusId == Guid.Empty)
        {
            throw new ArgumentException("Status id is required.", nameof(statusId));
        }

        StatusId = statusId;
        MarkUpdated(nowUtc, actorUserId);
    }

    public void ReplaceAssignees(IReadOnlyCollection<Guid> assigneeUserIds, DateTime nowUtc, Guid? actorUserId)
    {
        SetAssignees(assigneeUserIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    public void ReplaceTags(IReadOnlyCollection<Guid> tagIds, DateTime nowUtc, Guid? actorUserId)
    {
        SetTags(tagIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    public void ReplaceMentions(IReadOnlyCollection<Guid> mentionUserIds, DateTime nowUtc, Guid? actorUserId)
    {
        SetMentions(mentionUserIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    public void SoftDelete(DateTime nowUtc, Guid? actorUserId)
    {
        IsDeleted = true;
        MarkUpdated(nowUtc, actorUserId);
    }

    private void SetTitle(string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        var trimmed = title.Trim();
        if (trimmed.Length > TitleMaxLength)
        {
            throw new ArgumentException($"Title must be {TitleMaxLength} characters or fewer.", nameof(title));
        }

        Title = trimmed;
    }

    private void SetDescription(string description)
    {
        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description is required.", nameof(description));
        }

        var trimmed = description.Trim();
        if (trimmed.Length > DescriptionMaxLength)
        {
            throw new ArgumentException($"Description must be {DescriptionMaxLength} characters or fewer.", nameof(description));
        }

        Description = trimmed;
    }

    private void SetAssignees(IReadOnlyCollection<Guid> assigneeUserIds)
    {
        var distinct = Distinct(assigneeUserIds);
        if (distinct.Count > MaxAssignees)
        {
            throw new ArgumentException($"An idea can have at most {MaxAssignees} assignees.", nameof(assigneeUserIds));
        }

        _assignees.Clear();
        foreach (var userId in distinct)
        {
            _assignees.Add(new IdeaAssignee(Id, userId));
        }
    }

    private void SetTags(IReadOnlyCollection<Guid> tagIds)
    {
        var distinct = Distinct(tagIds);
        if (distinct.Count > MaxTags)
        {
            throw new ArgumentException($"An idea can have at most {MaxTags} tags.", nameof(tagIds));
        }

        _tags.Clear();
        foreach (var tagId in distinct)
        {
            _tags.Add(new IdeaTag(Id, tagId));
        }
    }

    private void SetMentions(IReadOnlyCollection<Guid> mentionUserIds)
    {
        _mentions.Clear();
        foreach (var userId in Distinct(mentionUserIds))
        {
            _mentions.Add(new IdeaMention(Id, userId));
        }
    }

    private static List<Guid> Distinct(IReadOnlyCollection<Guid>? ids) =>
        ids is null ? new List<Guid>() : ids.Where(id => id != Guid.Empty).Distinct().ToList();
}
