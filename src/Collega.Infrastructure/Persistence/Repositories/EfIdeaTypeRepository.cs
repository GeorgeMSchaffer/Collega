using Collega.Application.Abstractions;
using Collega.Domain.IdeaFields;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfIdeaTypeRepository : IIdeaTypeRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfIdeaTypeRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(IdeaType option, CancellationToken cancellationToken = default) =>
        await _dbContext.IdeaTypes.AddAsync(option, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<IdeaType> options, CancellationToken cancellationToken = default) =>
        await _dbContext.IdeaTypes.AddRangeAsync(options, cancellationToken);

    // Tracked so callers can mutate and persist through the unit of work.
    public Task<IdeaType?> GetByIdAsync(Guid ideaTypeId, CancellationToken cancellationToken = default) =>
        _dbContext.IdeaTypes.FirstOrDefaultAsync(t => t.Id == ideaTypeId, cancellationToken);

    public async Task<IReadOnlyList<IdeaType>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.IdeaTypes.Where(t => t.OrganizationId == organizationId);
        if (!includeDeleted)
        {
            query = query.Where(t => !t.IsDeleted);
        }

        return await query.OrderBy(t => t.SortOrder).ThenBy(t => t.Name).ToListAsync(cancellationToken);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        _dbContext.IdeaTypes.CountAsync(t => t.OrganizationId == organizationId && !t.IsDeleted, cancellationToken);
}
