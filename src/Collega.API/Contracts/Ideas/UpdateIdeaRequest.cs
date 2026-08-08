using Collega.API.Validation;

namespace Collega.API.Contracts.Ideas;

/// <summary>Request shape for `PUT /api/v1/ideas/{ideaId}`.</summary>
public sealed class UpdateIdeaRequest
{
    [RequiredField]
    [MaxLengthField(150)]
    public string Title { get; set; } = string.Empty;

    [RequiredField]
    [MaxLengthField(4000)]
    public string Description { get; set; } = string.Empty;

    [RequiredField]
    public string Priority { get; set; } = string.Empty;

    public string? DueDate { get; set; }

    public List<Guid>? AssigneeUserIds { get; set; }

    public List<string>? TagNames { get; set; }

    public List<string>? MentionEmails { get; set; }
}
