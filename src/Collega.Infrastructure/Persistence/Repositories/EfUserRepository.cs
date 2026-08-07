using Collega.Application.Abstractions;
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

    public async Task AddAsync(User user, CancellationToken cancellationToken = default) =>
        await _dbContext.Users.AddAsync(user, cancellationToken);
}
