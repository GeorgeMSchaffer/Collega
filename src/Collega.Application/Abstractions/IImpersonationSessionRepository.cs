using Collega.Domain.Impersonation;

namespace Collega.Application.Abstractions;

public interface IImpersonationSessionRepository
{
    /// <summary>
    /// The session this user started and has not ended, if any — including one that has run past an
    /// expiry bound but has not yet been observed and closed. Callers decide liveness with
    /// <see cref="ImpersonationSession.IsActiveAt"/>; returning expired-but-open rows is what lets
    /// the resolver close them and record why (SPEC/20-feature-view-as.md rules 17-19).
    /// </summary>
    Task<ImpersonationSession?> GetOpenForRealUserAsync(Guid realUserId, CancellationToken cancellationToken = default);

    Task AddAsync(ImpersonationSession session, CancellationToken cancellationToken = default);
}
