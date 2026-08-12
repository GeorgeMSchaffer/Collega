using Collega.Application.Abstractions;
using Collega.Application.Common;
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

    public async Task<PagedResult<Organization>> ListAsync(OrganizationListFilter filter, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Organizations.AsNoTracking().AsQueryable();

        // Archived organizations are excluded by default (SPEC/30-Contracts.md "Collection Conventions").
        if (!filter.IncludeArchived)
        {
            query = query.Where(o => !o.IsArchived);
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var pattern = LikePattern.Contains(filter.Search.Trim());
            query = query.Where(o =>
                EF.Functions.Like(o.Title, pattern, LikePattern.EscapeCharacter) ||
                EF.Functions.Like(o.Description, pattern, LikePattern.EscapeCharacter));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var descending = SortDirection.IsDescending(filter.SortDirection);
        query = (filter.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "createdat" => descending ? query.OrderByDescending(o => o.CreatedAtUtc) : query.OrderBy(o => o.CreatedAtUtc),
            // Contract sort field is `companyName`; the stored column is Title.
            _ => descending ? query.OrderByDescending(o => o.Title) : query.OrderBy(o => o.Title)
        };

        var items = await query
            .Skip(filter.Page.Skip)
            .Take(filter.Page.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<Organization>(
            items,
            filter.Page.Page,
            filter.Page.PageSize,
            totalCount,
            filter.SortBy,
            SortDirection.Normalize(filter.SortDirection));
    }

    public Task<bool> InviteCodeExistsAsync(string inviteCode, CancellationToken cancellationToken = default) =>
        _dbContext.Organizations.AnyAsync(o => o.InviteCode == inviteCode, cancellationToken);

    public async Task AddAsync(Organization organization, CancellationToken cancellationToken = default) =>
        await _dbContext.Organizations.AddAsync(organization, cancellationToken);
}
