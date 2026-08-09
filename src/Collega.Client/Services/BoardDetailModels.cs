namespace Collega.Client.Services;

// Wire DTOs for the board detail view (B2): the board's idea list plus create/status-move payloads
// (SPEC/30-Contracts.md "Idea Contracts"). Kept in their own file per the client's per-area DTO
// convention. Board/swimlane shapes are reused from BoardModels.cs; paging from ApiModels.cs;
// IdeaAssigneeDto and ChangeIdeaStatusRequestDto are shared with the Idea Detail slice (IdeaModels.cs).

/// <summary>A row of <c>GET /boards/{id}/ideas</c> (canonical paged envelope).</summary>
public sealed record IdeaListItemDto(
    string IdeaId,
    string BoardId,
    string Title,
    string Priority,
    string? DueDate,
    IReadOnlyList<IdeaAssigneeDto> Assignees,
    IReadOnlyList<string> TagNames,
    string StatusId,
    string StatusName,
    int UpvoteCount,
    bool HasUpvoted,
    int CommentCount,
    string AuthorUserId,
    DateTime CreatedAtUtc);

/// <summary>Body for <c>POST /boards/{id}/ideas</c>. Minimal create wires title/description/priority
/// and an optional target status; the API defaults to the left-most swimlane when StatusId is null.</summary>
public sealed record CreateIdeaRequestDto(
    string Title,
    string Description,
    string Priority,
    string IdeaTypeId,
    string BusinessImpactId,
    string? StatusId = null,
    IReadOnlyList<IdeaFieldValueWriteDto>? FieldValues = null);

/// <summary>Response of <c>POST /boards/{id}/ideas</c>.</summary>
public sealed record CreateIdeaResultDto(
    string IdeaId,
    string BoardId,
    string StatusId,
    string Title,
    string Priority,
    string? DueDate);

/// <summary>Result of <c>POST /boards/{id}/ideas/import</c> (create-only CSV import, T059/T060).</summary>
public sealed record IdeaImportResultDto(
    int CreatedCount,
    int RejectedCount,
    IReadOnlyList<IdeaImportRowResultDto> Rows);

public sealed record IdeaImportRowResultDto(int RowNumber, string? Title, string Outcome, string? Error);
