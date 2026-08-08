using Collega.Application.Common;
using Collega.Domain.Comments;

namespace Collega.Application.Abstractions;

public interface ICommentRepository
{
    Task<Comment?> GetByIdAsync(Guid commentId, CancellationToken cancellationToken = default);

    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    void Remove(Comment comment);

    /// <summary>Paged chronological comment list for an idea (SPEC/30-Contracts.md comments list).</summary>
    Task<PagedResult<Comment>> ListByIdeaAsync(CommentListFilter filter, CancellationToken cancellationToken = default);

    Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default);

    /// <summary>Comment counts keyed by idea id, for enriching the board idea list.</summary>
    Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default);
}

public sealed record CommentListFilter(Guid IdeaId, PageRequest Page, string? SortDirection);
