using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfUserRepository : IUserRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfUserRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default) =>
        _dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

    public Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        _dbContext.Users.FirstOrDefaultAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

    public Task<bool> ExistsByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default) =>
        _dbContext.Users.AnyAsync(u => u.NormalizedEmail == normalizedEmail, cancellationToken);

    public Task<bool> AnySiteAdminAsync(CancellationToken cancellationToken = default) =>
        _dbContext.Users.AnyAsync(u => u.Role == Role.SiteAdmin, cancellationToken);

    public async Task<PagedResult<User>> ListByOrganizationAsync(UserListFilter filter, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Users
            .AsNoTracking()
            .Where(u => u.OrganizationId == filter.OrganizationId);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            query = ApplySearch(query, filter.Search);
        }

        if (filter.Role is not null)
        {
            query = query.Where(u => u.Role == filter.Role);
        }

        if (filter.Status is not null)
        {
            query = query.Where(u => u.Status == filter.Status);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var descending = SortDirection.IsDescending(filter.SortDirection);
        query = (filter.SortBy?.Trim().ToLowerInvariant()) switch
        {
            "email" => descending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "createdat" => descending ? query.OrderByDescending(u => u.CreatedAtUtc) : query.OrderBy(u => u.CreatedAtUtc),
            _ => descending
                ? query.OrderByDescending(u => u.LastName).ThenByDescending(u => u.FirstName)
                : query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
        };

        var items = await query
            .Skip(filter.Page.Skip)
            .Take(filter.Page.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<User>(
            items,
            filter.Page.Page,
            filter.Page.PageSize,
            totalCount,
            filter.SortBy,
            SortDirection.Normalize(filter.SortDirection));
    }

    // Internal so a test can assert on the SQL this produces; see LikePattern's remarks for why the
    // match is spelled lower()/LIKE rather than ILIKE.
    internal static IQueryable<User> ApplySearch(IQueryable<User> query, string search)
    {
        var pattern = LikePattern.ContainsCaseInsensitive(search.Trim());
        return query.Where(u =>
            EF.Functions.Like(u.FirstName.ToLower(), pattern, LikePattern.EscapeCharacter) ||
            EF.Functions.Like(u.LastName.ToLower(), pattern, LikePattern.EscapeCharacter) ||
            EF.Functions.Like(u.Email.ToLower(), pattern, LikePattern.EscapeCharacter));
    }

    public async Task<IReadOnlyList<User>> ListByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default)
    {
        if (userIds.Count == 0)
        {
            return Array.Empty<User>();
        }

        var ids = userIds.ToList();
        return await _dbContext.Users
            .AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .ToListAsync(cancellationToken);
    }

    public Task<int> CountActiveOrgAdminsAsync(Guid organizationId, Guid? excludingUserId = null, CancellationToken cancellationToken = default) =>
        _dbContext.Users.CountAsync(
            u => u.OrganizationId == organizationId
                && u.Role == Role.OrgAdmin
                && u.Status == UserStatus.Active
                && (excludingUserId == null || u.Id != excludingUserId),
            cancellationToken);

    public async Task AddAsync(User user, CancellationToken cancellationToken = default) =>
        await _dbContext.Users.AddAsync(user, cancellationToken);
}
