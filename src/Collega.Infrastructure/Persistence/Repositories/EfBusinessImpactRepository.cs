using Collega.Application.Abstractions;
using Collega.Domain.IdeaFields;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfBusinessImpactRepository : IBusinessImpactRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfBusinessImpactRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(BusinessImpact option, CancellationToken cancellationToken = default) =>
        await _dbContext.BusinessImpacts.AddAsync(option, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<BusinessImpact> options, CancellationToken cancellationToken = default) =>
        await _dbContext.BusinessImpacts.AddRangeAsync(options, cancellationToken);

    // Tracked so callers can mutate and persist through the unit of work.
    public Task<BusinessImpact?> GetByIdAsync(Guid businessImpactId, CancellationToken cancellationToken = default) =>
        _dbContext.BusinessImpacts.FirstOrDefaultAsync(b => b.Id == businessImpactId, cancellationToken);

    public async Task<IReadOnlyList<BusinessImpact>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.BusinessImpacts.Where(b => b.OrganizationId == organizationId);
        if (!includeDeleted)
        {
            query = query.Where(b => !b.IsDeleted);
        }

        return await query.OrderBy(b => b.SortOrder).ThenBy(b => b.Name).ToListAsync(cancellationToken);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        _dbContext.BusinessImpacts.CountAsync(b => b.OrganizationId == organizationId && !b.IsDeleted, cancellationToken);
}
