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

    /// <summary>Required; must reference an active Idea Type in the idea's organization.</summary>
    public Guid IdeaTypeId { get; set; }

    /// <summary>Required; must reference an active Business Impact in the idea's organization.</summary>
    public Guid BusinessImpactId { get; set; }

    public string? DueDate { get; set; }

    public List<Guid>? AssigneeUserIds { get; set; }

    public List<string>? TagNames { get; set; }

    public List<string>? MentionEmails { get; set; }

    /// <summary>Optional User-Defined Field values; validated against the organization's field schema.</summary>
    public List<IdeaFieldValueRequest>? FieldValues { get; set; }
}
