using Collega.Application.Abstractions;
using Collega.Domain.Statuses;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfStatusRepository : IStatusRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfStatusRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddRangeAsync(IEnumerable<Status> statuses, CancellationToken cancellationToken = default) =>
        await _dbContext.Statuses.AddRangeAsync(statuses, cancellationToken);

    public async Task<IReadOnlyList<Status>> ListActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        await _dbContext.Statuses
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .ToListAsync(cancellationToken);
}
