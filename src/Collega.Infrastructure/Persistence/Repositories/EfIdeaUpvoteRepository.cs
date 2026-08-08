using Collega.Application.Abstractions;
using Collega.Domain.Upvotes;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfIdeaUpvoteRepository : IIdeaUpvoteRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfIdeaUpvoteRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<IdeaUpvote?> GetAsync(Guid ideaId, Guid userId, CancellationToken cancellationToken = default) =>
        _dbContext.IdeaUpvotes.FirstOrDefaultAsync(u => u.IdeaId == ideaId && u.UserId == userId, cancellationToken);

    public async Task AddAsync(IdeaUpvote upvote, CancellationToken cancellationToken = default) =>
        await _dbContext.IdeaUpvotes.AddAsync(upvote, cancellationToken);

    public void Remove(IdeaUpvote upvote) => _dbContext.IdeaUpvotes.Remove(upvote);

    public Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default) =>
        _dbContext.IdeaUpvotes.CountAsync(u => u.IdeaId == ideaId, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        if (ideaIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        var ids = ideaIds.ToList();
        var counts = await _dbContext.IdeaUpvotes
            .AsNoTracking()
            .Where(u => ids.Contains(u.IdeaId))
            .GroupBy(u => u.IdeaId)
            .Select(g => new { IdeaId = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        return counts.ToDictionary(x => x.IdeaId, x => x.Count);
    }

    public async Task<IReadOnlySet<Guid>> GetUpvotedIdeaIdsAsync(Guid userId, IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default)
    {
        if (ideaIds.Count == 0)
        {
            return new HashSet<Guid>();
        }

        var ids = ideaIds.ToList();
        var upvoted = await _dbContext.IdeaUpvotes
            .AsNoTracking()
            .Where(u => u.UserId == userId && ids.Contains(u.IdeaId))
            .Select(u => u.IdeaId)
            .ToListAsync(cancellationToken);

        return upvoted.ToHashSet();
    }
}
