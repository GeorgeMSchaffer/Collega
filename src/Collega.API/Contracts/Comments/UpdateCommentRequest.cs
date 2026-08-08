using Collega.API.Validation;

namespace Collega.API.Contracts.Comments;

/// <summary>Request shape for `PUT /api/v1/comments/{commentId}`.</summary>
public sealed class UpdateCommentRequest
{
    [RequiredField]
    [MaxLengthField(2000)]
    public string Body { get; set; } = string.Empty;

    public List<string>? MentionEmails { get; set; }
}
