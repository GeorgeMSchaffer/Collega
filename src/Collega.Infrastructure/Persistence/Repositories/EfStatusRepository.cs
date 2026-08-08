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

    public async Task AddAsync(Status status, CancellationToken cancellationToken = default) =>
        await _dbContext.Statuses.AddAsync(status, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<Status> statuses, CancellationToken cancellationToken = default) =>
        await _dbContext.Statuses.AddRangeAsync(statuses, cancellationToken);

    // Tracked (no AsNoTracking) so callers can mutate and persist through the unit of work.
    public Task<Status?> GetByIdAsync(Guid statusId, CancellationToken cancellationToken = default) =>
        _dbContext.Statuses.FirstOrDefaultAsync(s => s.Id == statusId, cancellationToken);

    public async Task<IReadOnlyList<Status>> ListActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        await _dbContext.Statuses
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<Status>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Statuses
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId);

        if (!includeDeleted)
        {
            query = query.Where(s => !s.IsDeleted);
        }

        return await query
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        _dbContext.Statuses.CountAsync(s => s.OrganizationId == organizationId && !s.IsDeleted, cancellationToken);
}
