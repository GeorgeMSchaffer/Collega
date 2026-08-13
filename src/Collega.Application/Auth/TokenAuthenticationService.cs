using Collega.Application.Abstractions;
using Collega.Domain.Enums;
using Collega.Domain.Impersonation;
using Collega.Domain.Organizations;
using Collega.Domain.Users;

namespace Collega.Application.Auth;

public sealed class TokenAuthenticationService : ITokenAuthenticationService
{
    private readonly IAccessTokenValidator _tokenValidator;
    private readonly IUserRepository _userRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IImpersonationSessionRepository _impersonationSessions;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public TokenAuthenticationService(
        IAccessTokenValidator tokenValidator,
        IUserRepository userRepository,
        IOrganizationRepository organizationRepository,
        IImpersonationSessionRepository impersonationSessions,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _tokenValidator = tokenValidator;
        _userRepository = userRepository;
        _organizationRepository = organizationRepository;
        _impersonationSessions = impersonationSessions;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    /// <summary>
    /// How stale <see cref="ImpersonationSession.LastSeenAtUtc"/> may get before it is rewritten.
    /// A quarter of the idle window: small enough that expiry stays accurate to within a few
    /// minutes, large enough that a burst of parallel requests writes at most once.
    /// </summary>
    private static readonly TimeSpan IdleRefreshInterval = TimeSpan.FromTicks(ImpersonationSession.IdleTimeout.Ticks / 4);

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

        // Rule 12 has two halves, and both have to be checked here. A deactivated target is the
        // obvious one; an archived organization is the one that is easy to miss, because the target
        // stays Active — archiving decommissions the organization without touching its users. Acting
        // inside an archived organization has to stop at the next request, not merely at expiry.
        var targetOrganization = target?.OrganizationId is null
            ? null
            : await _organizationRepository.GetByIdAsync(target.OrganizationId.Value, cancellationToken);

        if (target is null
            || target.Status != UserStatus.Active
            || targetOrganization is null
            || targetOrganization.IsArchived)
        {
            session.End(now, ImpersonationEndReason.TargetNoLongerValid);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return null;
        }

        // Rule 11 is a per-request guarantee, not a start-time one. Nothing rotates the security
        // stamp when an administrator is demoted (User.Administer changes Role and Status but leaves
        // the stamp alone), so their token stays valid — and without this check a demoted admin would
        // keep operating with the target's elevated identity until the 2-hour cap. The matrix is
        // re-applied against the real user's *current* role, exactly as ViewAsService applies it at
        // start.
        if (!MayStillActAs(realUser, target, targetOrganization))
        {
            session.End(now, ImpersonationEndReason.RealUserNoLongerAuthorized);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            return null;
        }

        // FIX (review): this used to Touch and save on every authenticated request, turning every
        // GET during a session into a database write and a committed transaction. Idle tracking does
        // not need per-request precision — refreshing once the recorded time is more than a quarter
        // of the idle window old keeps the same expiry behaviour while collapsing the writes.
        if (now - session.LastSeenAtUtc > IdleRefreshInterval)
        {
            session.Touch(now);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }

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

    /// <summary>
    /// The rule 8 matrix, re-applied mid-session. Deliberately mirrors ViewAsService.EnsureMayActAs —
    /// if the two ever disagree, a session could outlive the authority that created it.
    /// </summary>
    private static bool MayStillActAs(User realUser, User target, Organization? targetOrganization) =>
        realUser.Status == UserStatus.Active
        && realUser.Role switch
        {
            Role.SiteAdmin => true,
            Role.OrgAdmin => realUser.OrganizationId is not null
                             && realUser.OrganizationId == target.OrganizationId,
            _ => false,   // User and Read Only may never act as anyone
        };

    private static AuthenticatedPrincipal Principal(User user) => new(
        user.Id, user.OrganizationId, user.Role, user.FirstName, user.LastName, user.Email, user.Status, user.MustChangePassword);
}
