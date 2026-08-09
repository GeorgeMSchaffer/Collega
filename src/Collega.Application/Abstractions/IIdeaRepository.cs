using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;

namespace Collega.Application.Abstractions;

public interface IIdeaRepository
{
    /// <summary>
    /// Loads a single idea with its assignee, tag, and mention collections tracked for update.
    /// Soft-deleted ideas are excluded unless <paramref name="includeDeleted"/> is set
    /// (SPEC/20-feature-ideas-and-engagement.md rule #11).
    /// </summary>
    Task<Idea?> GetByIdAsync(Guid ideaId, bool includeDeleted = false, CancellationToken cancellationToken = default);

    Task AddAsync(Idea idea, CancellationToken cancellationToken = default);

    /// <summary>Paged, filtered idea list for one board, excluding soft-deleted ideas.</summary>
    Task<PagedResult<Idea>> ListByBoardAsync(IdeaListFilter filter, CancellationToken cancellationToken = default);

    /// <summary>Paged, filtered idea list across every board in one organization, excluding
    /// soft-deleted ideas (SPEC/20-feature-client-ui-revisions.md "Ideas Page").</summary>
    Task<PagedResult<Idea>> ListByOrganizationAsync(OrganizationIdeaListFilter filter, CancellationToken cancellationToken = default);

    /// <summary>True when an active idea with the given normalized title already exists on the board.</summary>
    Task<bool> ExistsByTitleOnBoardAsync(Guid boardId, string normalizedTitle, CancellationToken cancellationToken = default);

    /// <summary>User-Defined Field values for a set of ideas, for bulk projection such as CSV export
    /// (T060). Empty when no ids are given.</summary>
    Task<IReadOnlyList<IdeaFieldValueSnapshot>> GetFieldValuesByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default);
}

/// <summary>A flat (idea, field, value) tuple used to project UDF values across many ideas at once.</summary>
public sealed record IdeaFieldValueSnapshot(Guid IdeaId, Guid FieldDefinitionId, string? Value);

/// <summary>Store-facing filter for the board idea list (SPEC/30-Contracts.md board ideas list).</summary>
public sealed record IdeaListFilter(
    Guid BoardId,
    PageRequest Page,
    string? Search,
    Guid? StatusId,
    string? Tag,
    Priority? Priority,
    DateOnly? DueBefore,
    string? SortBy,
    string? SortDirection);

/// <summary>Store-facing filter for the organization-wide idea list. When set, <see cref="CreatedByUserId"/>
/// restricts to ideas the user authored and <see cref="AssignedToUserId"/> to ideas assigned to them;
/// both null means all ideas in the organization. <see cref="FieldFilters"/> are typed User-Defined
/// Field predicates (already validated/translated by the Application layer, T059); <see cref="SearchTextFieldIds"/>
/// are the active Text/Url field-definition ids whose values the global <see cref="Search"/> also scans.</summary>
public sealed record OrganizationIdeaListFilter(
    Guid OrganizationId,
    Guid? CreatedByUserId,
    Guid? AssignedToUserId,
    PageRequest Page,
    string? Search,
    string? SortBy,
    string? SortDirection,
    IReadOnlyList<IdeaFieldValueFilter>? FieldFilters = null,
    IReadOnlyList<Guid>? SearchTextFieldIds = null);

/// <summary>How a single User-Defined Field value predicate matches (T059 filter semantics,
/// SPEC/20-feature-user-defined-fields.md).</summary>
public enum IdeaFieldFilterKind
{
    /// <summary>Text/Url: <c>LIKE '%value%'</c> contains match.</summary>
    Contains,
    /// <summary>Boolean/Dropdown: exact string equality.</summary>
    Equals,
    /// <summary>Number: numeric range; <see cref="Min"/>/<see cref="Max"/> bounds (either may be null).</summary>
    NumberRange,
    /// <summary>Date: ISO-8601 range; <see cref="Min"/>/<see cref="Max"/> bounds (either may be null).</summary>
    DateRange,
    /// <summary>MultiSelect: the stored comma-separated option ids include <see cref="Value"/> (any-of).</summary>
    MultiSelectContains,
}

/// <summary>One typed predicate over an idea's value for a given field definition. Built by the
/// Application layer from the raw <c>fieldFilters[&lt;id&gt;]=&lt;value&gt;</c> query per the field's type;
/// the repository translates it to SQL against <c>IdeaFieldValues</c>.</summary>
public sealed record IdeaFieldValueFilter(
    Guid FieldDefinitionId,
    IdeaFieldFilterKind Kind,
    string? Value = null,
    decimal? Min = null,
    decimal? Max = null,
    string? MinText = null,
    string? MaxText = null);
