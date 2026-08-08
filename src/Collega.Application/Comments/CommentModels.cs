namespace Collega.Application.Comments;

/// <remarks>
/// <see cref="MentionEmails"/> is an additive optional field beyond SPEC/30-Contracts.md's comment
/// request shape (which lists only <c>body</c>). It is included so comments can honor the spec's
/// requirement that "comments support the same email-based mention behavior as ideas"
/// (SPEC/20-feature-ideas-and-engagement.md "Comments" #5). Flagged as a contract gap for review.
/// </remarks>
public sealed record CreateCommentCommand(string Body, IReadOnlyList<string>? MentionEmails);

public sealed record UpdateCommentCommand(string Body, IReadOnlyList<string>? MentionEmails);

public sealed record CommentListQuery(int? Page, int? PageSize, string? SortDirection);

public sealed record CommentListItem(
    Guid CommentId,
    Guid IdeaId,
    Guid AuthorUserId,
    string Body,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record CreateCommentResult(Guid CommentId, Guid IdeaId);
