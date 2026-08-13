using Collega.Application.Abstractions;
using Collega.Domain.Enums;
using Collega.Domain.Impersonation;
using Collega.Domain.Users;

namespace Collega.Application.Auth;

public sealed class TokenAuthenticationService : ITokenAuthenticationService
{
    private readonly IAccessTokenValidator _tokenValidator;
    private readonly IUserRepository _userRepository;
    private readonly IImpersonationSessionRepository _impersonationSessions;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public TokenAuthenticationService(
        IAccessTokenValidator tokenValidator,
        IUserRepository userRepository,
        IImpersonationSessionRepository impersonationSessions,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _tokenValidator = tokenValidator;
        _userRepository = userRepository;
        _impersonationSessions = impersonationSessions;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public async Task<AuthenticatedPrincipal?> AuthenticateAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || !_tokenValidator.TryValidate(token, _clock.UtcNow, out var userId, out var securityStamp))
        {
            return null;
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);

        // Re-checked against live state on every request (not cached in the token) so a
        // deactivation mid-session takes effect immediately (auth requirement #15 for tokens too,
        // not just fresh logins).
        if (user is null || user.Status != UserStatus.Active)
        {
            return null;
        }

        // SPEC/20-feature-auth.md #35-36: a token whose embedded SecurityStamp no longer matches
        // the user's current value was issued before the most recent password
        // change/administrative reset and is treated as invalid, exactly like an expired token.
        if (!string.Equals(user.SecurityStamp, securityStamp, StringComparison.Ordinal))
        {
            return null;
        }

        // The token always names the real user; impersonation is never carried in it
        // (SPEC/20-feature-view-as.md rule 1). Resolving the session here — the one place identity
        // is already established — is what lets every downstream authorization check work unchanged.
        var impersonated = await ResolveImpersonationAsync(user, cancellationToken);
        if (impersonated is not null)
        {
            return impersonated;
        }

        return Principal(user);
    }

    private async Task<AuthenticatedPrincipal?> ResolveImpersonationAsync(User realUser, CancellationToken cancellationToken)
    {
        var session = await _impersonationSessions.GetOpenForRealUserAsync(realUser.Id, cancellationToken);
        if (session is null)
        {
            return null;
        }

        var now = _clock.UtcNow;

        // Expiry is decided here, server-side (rule 18). An expired-but-open row is closed with the
        // reason recorded rather than merely ignored, so the audit trail shows why it ended.
        if (!session.IsActiveAt(now))
        {
            session.End(now, now >= session.AbsoluteExpiresAtUtc
                ? ImpersonationEndReason.AbsoluteTimeout
                : ImpersonationEndReason.IdleTimeout);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return null;
        }

        var target = await _userRepository.GetByIdAsync(session.TargetUserId, cancellationToken);

        // Rule 12: a target who has been deactivated stops being a valid subject at the next
        // request. The admin is not signed out — they simply revert to acting as themselves.
        if (target is null || target.Status != UserStatus.Active)
        {
            session.End(now, ImpersonationEndReason.TargetNoLongerValid);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return null;
        }

        session.Touch(now);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Every identity field is the target's: this is what makes org-scoping and role checks
        // downstream apply to the impersonated user with no per-service special-casing (rule 4).
        // MustChangePassword is deliberately the real user's own — an admin acting as someone must
        // not inherit that user's rotation gate, and cannot have their own suppressed by it.
        return new AuthenticatedPrincipal(
            target.Id,
            target.OrganizationId,
            target.Role,
            target.FirstName,
            target.LastName,
            target.Email,
            target.Status,
            realUser.MustChangePassword,
            new ImpersonationContext(
                realUser.Id,
                realUser.FirstName,
                realUser.LastName,
                session.StartedAtUtc,
                session.AbsoluteExpiresAtUtc));
    }

    private static AuthenticatedPrincipal Principal(User user) => new(
        user.Id, user.OrganizationId, user.Role, user.FirstName, user.LastName, user.Email, user.Status, user.MustChangePassword);
}
