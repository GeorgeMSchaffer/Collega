using Collega.Application.Fields;

namespace Collega.Application.Ideas;

// Commands / queries -----------------------------------------------------------------------------

public sealed record CreateIdeaCommand(
    string Title,
    string Description,
    string Priority,
    Guid IdeaTypeId,
    Guid BusinessImpactId,
    string? DueDate,
    IReadOnlyList<Guid>? AssigneeUserIds,
    Guid? StatusId,
    IReadOnlyList<string>? TagNames,
    IReadOnlyList<string>? MentionEmails,
    IReadOnlyList<IdeaFieldValueWrite>? FieldValues = null);

public sealed record UpdateIdeaCommand(
    string Title,
    string Description,
    string Priority,
    Guid IdeaTypeId,
    Guid BusinessImpactId,
    string? DueDate,
    IReadOnlyList<Guid>? AssigneeUserIds,
    IReadOnlyList<string>? TagNames,
    IReadOnlyList<string>? MentionEmails,
    IReadOnlyList<IdeaFieldValueWrite>? FieldValues = null);

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

/// <summary>
/// Cross-board, organization-scoped idea list for the global <c>/ideas</c> page. <c>Scope</c> is one
/// of <c>all</c> / <c>created</c> (authored by the current user) / <c>assigned</c> (assigned to the
/// current user); anything else is treated as <c>all</c>.
/// </summary>
public sealed record OrganizationIdeaListQuery(
    int? Page,
    int? PageSize,
    string? Search,
    string? Scope,
    string? SortBy,
    string? SortDirection,
    IReadOnlyDictionary<Guid, string>? FieldFilters = null);

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
    Guid IdeaTypeId,
    string IdeaTypeName,
    Guid BusinessImpactId,
    string BusinessImpactName,
    string BusinessImpactColor,
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
    Guid IdeaTypeId,
    string IdeaTypeName,
    Guid BusinessImpactId,
    string BusinessImpactName,
    string BusinessImpactColor,
    string? DueDate,
    IReadOnlyList<IdeaAssigneeDto> Assignees,
    Guid StatusId,
    string StatusName,
    IReadOnlyList<string> TagNames,
    IReadOnlyList<MentionDto> Mentions,
    IReadOnlyList<IdeaCommentDto> Comments,
    int UpvoteCount,
    bool HasUpvoted,
    int CommentCount,
    IReadOnlyList<IdeaFieldValueDto> FieldValues);

public sealed record CreateIdeaResult(
    Guid IdeaId,
    Guid BoardId,
    Guid StatusId,
    string Title,
    string Priority,
    Guid IdeaTypeId,
    Guid BusinessImpactId,
    string? DueDate);

public sealed record UpvoteToggleResult(Guid IdeaId, bool HasUpvoted, int UpvoteCount);

// CSV import / export (T059/T060) -----------------------------------------------------------------

/// <summary>One parsed CSV row for idea import: the raw cell values keyed by lowercased header name,
/// plus the 1-based data-row number for error reporting. The service interprets the core columns and
/// (T060) any per-UDF-field columns from the same map.</summary>
public sealed record IdeaImportRow(int RowNumber, IReadOnlyDictionary<string, string?> Cells);

/// <summary>Outcome for a single import row.</summary>
public sealed record IdeaImportRowResult(int RowNumber, string? Title, string Outcome, string? Error);

/// <summary>Result of an idea CSV import (create-only): counts plus per-row outcomes.</summary>
public sealed record IdeaImportResult(int CreatedCount, int RejectedCount, IReadOnlyList<IdeaImportRowResult> Rows);

/// <summary>A CSV export as ordered headers plus rows of ordered cell strings, ready for the boundary
/// to serialize. Kept header/row-generic so UDF columns (T060) append without a shape change.</summary>
public sealed record IdeaCsvExport(IReadOnlyList<string> Headers, IReadOnlyList<IReadOnlyList<string>> Rows);

/// <summary>Canonical idea-CSV column keys (lowercased header names) shared by the import parser and
/// the export builder so both agree on the schema. UDF field columns (T060) are appended by name.</summary>
public static class IdeaCsvColumns
{
    public const string Title = "title";
    public const string Description = "description";
    public const string Priority = "priority";
    public const string IdeaType = "idea type";
    public const string BusinessImpact = "business impact";
    public const string Status = "status";
    public const string DueDate = "due date";
    public const string Tags = "tags";

    /// <summary>Core columns in export order: (lowercased key, display header).</summary>
    public static readonly IReadOnlyList<(string Key, string Header)> Core = new[]
    {
        (Title, "Title"),
        (Description, "Description"),
        (Priority, "Priority"),
        (IdeaType, "Idea Type"),
        (BusinessImpact, "Business Impact"),
        (Status, "Status"),
        (DueDate, "Due Date"),
        (Tags, "Tags"),
    };

    /// <summary>Columns a valid import file must contain.</summary>
    public static readonly IReadOnlyList<string> RequiredKeys = new[]
    {
        Title, Description, Priority, IdeaType, BusinessImpact,
    };
}
