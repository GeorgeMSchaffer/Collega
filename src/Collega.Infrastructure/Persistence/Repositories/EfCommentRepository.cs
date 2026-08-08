using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Comments;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfCommentRepository : ICommentRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfCommentRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Comment?> GetByIdAsync(Guid commentId, CancellationToken cancellationToken = default) =>
        _dbContext.Comments
            .Include(c => c.Mentions)
            .FirstOrDefaultAsync(c => c.Id == commentId, cancellationToken);

    public async Task AddAsync(Comment comment, CancellationToken cancellationToken = default) =>
        await _dbContext.Comments.AddAsync(comment, cancellationToken);

    public void Remove(Comment comment) => _dbContext.Comments.Remove(comment);

    public async Task<PagedResult<Comment>> ListByIdeaAsync(CommentListFilter filter, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Comments
            .AsNoTracking()
            .Where(c => c.IdeaId == filter.IdeaId);

        var totalCount = await query.CountAsync(cancellationToken);

        // Comments are displayed chronologically (SPEC/20-feature-ideas-and-engagement.md #2).
        var descending = SortDirection.IsDescending(filter.SortDirection);
        query = descending
            ? query.OrderByDescending(c => c.CreatedAtUtc).ThenByDescending(c => c.Id)
            : query.OrderBy(c => c.CreatedAtUtc).ThenBy(c => c.Id);

        var items = await query
            .Skip(filter.Page.Skip)
            .Take(filter.Page.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Comment>(
            items,
            filter.Page.Page,
            filter.Page.PageSize,
            totalCount,
            "createdAtUtc",
            SortDirection.Normalize(filter.SortDirection));
    }

    public Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default) =>
        _dbContext.Comments.CountAsync(c => c.IdeaId == ideaId, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        if (ideaIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        var ids = ideaIds.ToList();
        var counts = await _dbContext.Comments
            .AsNoTracking()
            .Where(c => ids.Contains(c.IdeaId))
            .GroupBy(c => c.IdeaId)
            .Select(g => new { IdeaId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return counts.ToDictionary(x => x.IdeaId, x => x.Count);
    }
}
