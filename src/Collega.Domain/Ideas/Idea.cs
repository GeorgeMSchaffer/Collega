using Collega.Domain.Common;
using Collega.Domain.Enums;
using Collega.Domain.Fields;

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
/// fields belonging to the "Organization-Managed Idea Fields" feature. Each idea references exactly
/// one active option of each; the Application layer validates the references against the
/// organization's active options before they are set. Soft-deleting an option preserves existing idea
/// references, so a stored id may point at an archived option that clients render with an archived
/// indicator (SPEC/30-Contracts.md "Idea Field Option Contracts").
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
    private readonly List<IdeaFieldValue> _fieldValues = new();

    public Guid OrganizationId { get; private set; }
    public Guid BoardId { get; private set; }
    public Guid StatusId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Priority Priority { get; private set; }
    public Guid IdeaTypeId { get; private set; }
    public Guid BusinessImpactId { get; private set; }
    public DateOnly? DueDate { get; private set; }
    public Guid AuthorUserId { get; private set; }
    public bool IsDeleted { get; private set; }

    public IReadOnlyList<IdeaAssignee> Assignees => _assignees;
    public IReadOnlyList<IdeaTag> Tags => _tags;
    public IReadOnlyList<IdeaMention> Mentions => _mentions;

    /// <summary>
    /// User-Defined Field values on this idea (SPEC/20-feature-user-defined-fields.md), one row per
    /// field definition. Managed through <see cref="ReplaceFieldValues"/>; values are validated and
    /// serialized by the Application layer before they are set.
    /// </summary>
    public IReadOnlyList<IdeaFieldValue> FieldValues => _fieldValues;

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
        Guid ideaTypeId,
        Guid businessImpactId,
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
        idea.SetClassification(ideaTypeId, businessImpactId);
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
    /// <remarks>
    /// Idea Type is immutable on the edit path (SPEC/20-feature-idea-type-fields.md): it is set once at
    /// creation and only the admin reassign hatch (<see cref="ReassignIdeaType"/>) may change it later.
    /// Business Impact stays mutable here.
    /// </remarks>
    public void UpdateContent(
        string title,
        string description,
        Priority priority,
        Guid businessImpactId,
        DateOnly? dueDate,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        SetTitle(title);
        SetDescription(description);
        Priority = priority;
        SetBusinessImpact(businessImpactId);
        DueDate = dueDate;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Admin-only reassignment of the idea's type — the only path that mutates <see cref="IdeaTypeId"/>
    /// after creation (SPEC/20-feature-idea-type-fields.md). Field-value reconciliation against the new
    /// type's resolved set is the caller's responsibility.
    /// </summary>
    public void ReassignIdeaType(Guid ideaTypeId, DateTime nowUtc, Guid? actorUserId)
    {
        if (ideaTypeId == Guid.Empty)
        {
            throw new ArgumentException("Idea Type is required.", nameof(ideaTypeId));
        }

        IdeaTypeId = ideaTypeId;
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

    /// <summary>
    /// Reconciles this idea's field values to the submitted set (authoritative): a field with a null
    /// or empty value is cleared (its row removed), a changed value updates the existing row in place
    /// (preserving its identity and created stamp), a new value adds a row, and unchanged values are
    /// left untouched. Values must already be validated/serialized by the Application layer.
    /// </summary>
    /// <param name="reconciledFieldDefinitionIds">
    /// The field definitions this reconcile is authoritative over — the caller's active-definition set.
    /// Only values for these fields may be cleared; values for out-of-scope definitions (e.g. ones that
    /// were soft-deleted after they were filled in) are preserved untouched so historical data is not
    /// lost (SPEC/20-feature-user-defined-fields.md: archived-definition values are retained).
    /// </param>
    public void ReplaceFieldValues(
        IReadOnlyCollection<IdeaFieldValueInput> fieldValues,
        IReadOnlyCollection<Guid> reconciledFieldDefinitionIds,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        var scoped = reconciledFieldDefinitionIds as ISet<Guid> ?? reconciledFieldDefinitionIds.ToHashSet();

        var desired = new Dictionary<Guid, string?>();
        foreach (var input in fieldValues ?? Array.Empty<IdeaFieldValueInput>())
        {
            if (input.FieldDefinitionId == Guid.Empty)
            {
                continue;
            }

            // Last submission wins if a field id is repeated.
            desired[input.FieldDefinitionId] = string.IsNullOrWhiteSpace(input.Value) ? null : input.Value;
        }

        // Only clear values for in-scope definitions; leave out-of-scope (archived) values in place.
        _fieldValues.RemoveAll(v => scoped.Contains(v.FieldDefinitionId)
            && (!desired.TryGetValue(v.FieldDefinitionId, out var value) || value is null));

        foreach (var (fieldDefinitionId, value) in desired)
        {
            if (value is null)
            {
                continue;
            }

            var existing = _fieldValues.FirstOrDefault(v => v.FieldDefinitionId == fieldDefinitionId);
            if (existing is null)
            {
                _fieldValues.Add(new IdeaFieldValue(Id, fieldDefinitionId, value, nowUtc, actorUserId));
            }
            else if (existing.Value != value)
            {
                existing.SetValue(value, nowUtc, actorUserId);
            }
        }
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

    private void SetClassification(Guid ideaTypeId, Guid businessImpactId)
    {
        if (ideaTypeId == Guid.Empty)
        {
            throw new ArgumentException("Idea Type is required.", nameof(ideaTypeId));
        }

        if (businessImpactId == Guid.Empty)
        {
            throw new ArgumentException("Business Impact is required.", nameof(businessImpactId));
        }

        IdeaTypeId = ideaTypeId;
        BusinessImpactId = businessImpactId;
    }

    private void SetBusinessImpact(Guid businessImpactId)
    {
        if (businessImpactId == Guid.Empty)
        {
            throw new ArgumentException("Business Impact is required.", nameof(businessImpactId));
        }

        BusinessImpactId = businessImpactId;
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
