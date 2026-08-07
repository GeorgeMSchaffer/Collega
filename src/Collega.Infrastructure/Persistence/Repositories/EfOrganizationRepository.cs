using Collega.Application.Abstractions;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfOrganizationRepository : IOrganizationRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfOrganizationRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<Organization?> GetByIdAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        _dbContext.Organizations.FirstOrDefaultAsync(o => o.Id == organizationId, cancellationToken);

    public Task<Organization?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default) =>
        _dbContext.Organizations.FirstOrDefaultAsync(o => o.InviteCode == inviteCode, cancellationToken);

    public async Task AddAsync(Organization organization, CancellationToken cancellationToken = default) =>
        await _dbContext.Organizations.AddAsync(organization, cancellationToken);
}
