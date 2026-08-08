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

    /// <summary>True when an active idea with the given normalized title already exists on the board.</summary>
    Task<bool> ExistsByTitleOnBoardAsync(Guid boardId, string normalizedTitle, CancellationToken cancellationToken = default);
}

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
