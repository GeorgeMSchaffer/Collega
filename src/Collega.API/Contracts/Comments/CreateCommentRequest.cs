using Collega.API.Validation;

namespace Collega.API.Contracts.Comments;

/// <summary>Request shape for `POST /api/v1/ideas/{ideaId}/comments`.</summary>
public sealed class CreateCommentRequest
{
    [RequiredField]
    [MaxLengthField(2000)]
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Optional same-organization mention email addresses. Additive to SPEC/30-Contracts.md's
    /// body-only comment shape so comments honor the spec's email-based mention behavior.
    /// </summary>
    public List<string>? MentionEmails { get; set; }
}
