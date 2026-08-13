using Collega.Application.Abstractions;
using Collega.Domain.Impersonation;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfImpersonationSessionRepository : IImpersonationSessionRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfImpersonationSessionRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <summary>
    /// Returns the open row regardless of whether it has run past an expiry bound — liveness is the
    /// caller's decision via <see cref="ImpersonationSession.IsActiveAt"/>. Filtering expired rows
    /// out here would leave them open forever, with no chance to close them and record why.
    /// </summary>
    /// <remarks>Tracked, not <c>AsNoTracking</c>: callers touch or end the session and save.</remarks>
    public Task<ImpersonationSession?> GetOpenForRealUserAsync(Guid realUserId, CancellationToken cancellationToken = default) =>
        _dbContext.ImpersonationSessions
            .Where(s => s.RealUserId == realUserId && s.EndedAtUtc == null)
            .OrderByDescending(s => s.StartedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);

    public async Task AddAsync(ImpersonationSession session, CancellationToken cancellationToken = default) =>
        await _dbContext.ImpersonationSessions.AddAsync(session, cancellationToken);
}
