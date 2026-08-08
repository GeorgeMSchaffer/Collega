using Collega.API.Validation;

namespace Collega.API.Contracts.Ideas;

/// <summary>Request shape for `POST /api/v1/boards/{boardId}/ideas`.</summary>
public sealed class CreateIdeaRequest
{
    [RequiredField]
    [MaxLengthField(150)]
    public string Title { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(4000)]
    public string Description { get; set; } = string.Empty;

    [RequiredField]
    public string Priority { get; set; } = string.Empty;

    /// <summary>Optional ISO date (YYYY-MM-DD).</summary>
    public string? DueDate { get; set; }

    /// <summary>Optional zero-to-five distinct active users in the board's organization.</summary>
    public List<Guid>? AssigneeUserIds { get; set; }

    /// <summary>Optional; defaults to the left-most swimlane when omitted.</summary>
    public Guid? StatusId { get; set; }

    /// <summary>Optional up-to-ten distinct tag names; created on save if new.</summary>
    public List<string>? TagNames { get; set; }

    /// <summary>Optional same-organization mention email addresses.</summary>
    public List<string>? MentionEmails { get; set; }
}
