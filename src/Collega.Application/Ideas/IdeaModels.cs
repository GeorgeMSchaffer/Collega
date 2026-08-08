namespace Collega.Application.Ideas;

// Commands / queries -----------------------------------------------------------------------------

public sealed record CreateIdeaCommand(
    string Title,
    string Description,
    string Priority,
    string? DueDate,
    IReadOnlyList<Guid>? AssigneeUserIds,
    Guid? StatusId,
    IReadOnlyList<string>? TagNames,
    IReadOnlyList<string>? MentionEmails);

public sealed record UpdateIdeaCommand(
    string Title,
    string Description,
    string Priority,
    string? DueDate,
    IReadOnlyList<Guid>? AssigneeUserIds,
    IReadOnlyList<string>? TagNames,
    IReadOnlyList<string>? MentionEmails);

public sealed record ChangeIdeaStatusCommand(Guid StatusId);

public sealed record IdeaListQuery(
    int? Page,
    int? PageSize,
    string? Search,
    Guid? StatusId,
    string? Tag,
    string? Priority,
    string? DueBefore,
    string? SortBy,
    string? SortDirection);

// Results / DTOs ---------------------------------------------------------------------------------

/// <summary>Assignee persona shape shared by the idea list and detail (SPEC/30-Contracts.md).</summary>
public sealed record IdeaAssigneeDto(
    Guid UserId,
    string FirstName,
    string LastName,
    string DisplayName,
    bool IsActive);

public sealed record MentionDto(
    Guid UserId,
    string FirstName,
    string LastName,
    string DisplayName,
    string Email);

public sealed record IdeaCommentDto(
    Guid CommentId,
    Guid IdeaId,
    Guid AuthorUserId,
    string Body,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

public sealed record IdeaListItem(
    Guid IdeaId,
    Guid BoardId,
    string Title,
    string Priority,
    string? DueDate,
    IReadOnlyList<IdeaAssigneeDto> Assignees,
    IReadOnlyList<string> TagNames,
    Guid StatusId,
    string StatusName,
    int UpvoteCount,
    bool HasUpvoted,
    int CommentCount,
    Guid AuthorUserId,
    DateTime CreatedAtUtc);

public sealed record IdeaDetail(
    Guid IdeaId,
    Guid BoardId,
    string Title,
    string Description,
    string Priority,
    string? DueDate,
    IReadOnlyList<IdeaAssigneeDto> Assignees,
    Guid StatusId,
    string StatusName,
    IReadOnlyList<string> TagNames,
    IReadOnlyList<MentionDto> Mentions,
    IReadOnlyList<IdeaCommentDto> Comments,
    int UpvoteCount,
    bool HasUpvoted,
    int CommentCount);

public sealed record CreateIdeaResult(
    Guid IdeaId,
    Guid BoardId,
    Guid StatusId,
    string Title,
    string Priority,
    string? DueDate);

public sealed record UpvoteToggleResult(Guid IdeaId, bool HasUpvoted, int UpvoteCount);
