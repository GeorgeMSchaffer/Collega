namespace Collega.Client.Services;

// Wire DTOs for the Idea, Comment, and Upvote API contracts (SPEC/30-Contracts.md
// "Idea Contracts" / "Comment Contracts" / "Upvote Contracts"). Kept in their own file per the
// client's per-area DTO convention. Guids travel as JSON strings, so they map to `string` here.

/// <summary>An assignee persona attached to an idea (mirrors the API's IdeaAssigneeDto).</summary>
public sealed record IdeaAssigneeDto(
    string UserId,
    string FirstName,
    string LastName,
    string DisplayName,
    bool IsActive);

/// <summary>A resolved @mention on an idea (mirrors the API's MentionDto).</summary>
public sealed record IdeaMentionDto(
    string UserId,
    string FirstName,
    string LastName,
    string DisplayName,
    string Email);

/// <summary>A comment as embedded on an idea detail or returned by the comments endpoint.</summary>
public sealed record IdeaCommentDto(
    string CommentId,
    string IdeaId,
    string AuthorUserId,
    string Body,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

/// <summary>Detail for <c>GET /ideas/{ideaId}</c> (and the body echoed by <c>PUT /ideas/{ideaId}</c>).</summary>
public sealed record IdeaDetailDto(
    string IdeaId,
    string BoardId,
    string Title,
    string Description,
    string Priority,
    string? DueDate,
    IReadOnlyList<IdeaAssigneeDto> Assignees,
    string StatusId,
    string StatusName,
    IReadOnlyList<string> TagNames,
    IReadOnlyList<IdeaMentionDto> Mentions,
    IReadOnlyList<IdeaCommentDto> Comments,
    int UpvoteCount,
    bool HasUpvoted,
    int CommentCount);

/// <summary>Body for <c>PUT /ideas/{ideaId}</c>. Sends the full editable field set, so unchanged
/// fields (priority, due date, assignees, tags) must be echoed back to avoid clearing them.</summary>
public sealed record UpdateIdeaRequestDto(
    string Title,
    string Description,
    string Priority,
    string? DueDate,
    IReadOnlyList<string>? AssigneeUserIds,
    IReadOnlyList<string>? TagNames,
    IReadOnlyList<string>? MentionEmails);

/// <summary>Body for <c>POST /ideas/{ideaId}/status</c>.</summary>
public sealed record ChangeIdeaStatusRequestDto(string StatusId);

/// <summary>Response of <c>POST /ideas/{ideaId}/upvote/toggle</c>.</summary>
public sealed record UpvoteToggleResultDto(string IdeaId, bool HasUpvoted, int UpvoteCount);

/// <summary>A row of <c>GET /ideas/{ideaId}/comments</c> (paged envelope).</summary>
public sealed record CommentListItemDto(
    string CommentId,
    string IdeaId,
    string AuthorUserId,
    string Body,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

/// <summary>Body for <c>POST /ideas/{ideaId}/comments</c>. <c>MentionEmails</c> carries the same
/// email-based mention behavior ideas use (SPEC/20-feature-ideas-and-engagement.md "Comments" #5).</summary>
public sealed record CreateCommentRequestDto(string Body, IReadOnlyList<string>? MentionEmails);

/// <summary>Response of <c>POST /ideas/{ideaId}/comments</c>.</summary>
public sealed record CreateCommentResultDto(string CommentId, string IdeaId);
