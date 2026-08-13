using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Enums;
using Collega.Domain.Impersonation;
using Collega.Domain.Auditing;
using Collega.Domain.Users;

namespace Collega.Application.Impersonation;

/// <summary>
/// Starting, ending and listing targets for View As (SPEC/20-feature-view-as.md). Every rule here is
/// enforced server-side; the UI control is a convenience and carries no authority (rule 8).
/// </summary>
/// <remarks>
/// This service deliberately authorizes against the caller's <b>real</b> identity, not the acting
/// one. Everywhere else in the application <see cref="ICurrentUserContext.UserId"/> is the right
/// answer — here it is not, because while a session is live that property already reports the
/// impersonated user, and asking them whether they may impersonate is the wrong question. Using
/// <see cref="ICurrentUserContext.RealUserId"/> is what makes rule 5 (non-nestable) enforceable at
/// all.
/// </remarks>
public sealed class ViewAsService : IViewAsService
{
    private readonly ICurrentUserContext _currentUser;
    private readonly IUserRepository _userRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IImpersonationSessionRepository _sessions;
    private readonly IAuditEventWriter _audit;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public ViewAsService(
        ICurrentUserContext currentUser,
        IUserRepository userRepository,
        IOrganizationRepository organizationRepository,
        IImpersonationSessionRepository sessions,
        IAuditEventWriter audit,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _currentUser = currentUser;
        _userRepository = userRepository;
        _organizationRepository = organizationRepository;
        _sessions = sessions;
        _audit = audit;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public async Task<ViewAsSessionResult> StartAsync(Guid targetUserId, CancellationToken cancellationToken = default)
    {
        var (realUser, realRole) = await RequireRealActorAsync(cancellationToken);

        if (realRole is not (Role.SiteAdmin or Role.OrgAdmin))
        {
            throw new ForbiddenAppException(NotAllowed);
        }

        // Rule 5: never silently replaced. A caller already acting as someone must exit first.
        var existing = await _sessions.GetOpenForRealUserAsync(realUser.Id, cancellationToken);
        if (existing is not null && existing.IsActiveAt(_clock.UtcNow))
        {
            throw new ConflictAppException("You are already viewing as another user. Exit that session first.");
        }

        var target = await _userRepository.GetByIdAsync(targetUserId, cancellationToken)
            ?? throw new NotFoundAppException("User not found.");

        EnsureMayActAs(realUser, realRole, target);

        var now = _clock.UtcNow;
        var session = ImpersonationSession.Start(realUser.Id, target.Id, now);
        await _sessions.AddAsync(session, cancellationToken);

        // Rule 13: start and exit are audited unconditionally. Attributed to the real administrator,
        // naming the target — never the reverse.
        await AuditAsync("ViewAsStarted", $"{Describe(realUser)} started viewing as {Describe(target)}.",
            now, target.OrganizationId, realUser.Id, target.Id, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new ViewAsSessionResult(target.Id, session.StartedAtUtc, session.AbsoluteExpiresAtUtc);
    }

    /// <summary>Idempotent (contract): ending with no active session is a success, not an error.</summary>
    public async Task EndAsync(CancellationToken cancellationToken = default)
    {
        var (realUser, _) = await RequireRealActorAsync(cancellationToken);

        var session = await _sessions.GetOpenForRealUserAsync(realUser.Id, cancellationToken);
        if (session is null)
        {
            return;
        }

        var now = _clock.UtcNow;
        var wasActive = session.IsActiveAt(now);
        session.End(now, ImpersonationEndReason.ExitedByUser);

        // Only audited when a live session actually ended. Closing an already-expired row is
        // bookkeeping, and auditing it would imply the admin was still acting when they were not.
        if (wasActive)
        {
            var target = await _userRepository.GetByIdAsync(session.TargetUserId, cancellationToken);
            await AuditAsync("ViewAsEnded", $"{Describe(realUser)} stopped viewing as {(target is null ? "a removed user" : Describe(target))}.",
                now, target?.OrganizationId, realUser.Id, session.TargetUserId, cancellationToken);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ViewAsCandidate>> ListCandidatesAsync(string? search, CancellationToken cancellationToken = default)
    {
        var (realUser, realRole) = await RequireRealActorAsync(cancellationToken);

        if (realRole is not (Role.SiteAdmin or Role.OrgAdmin))
        {
            throw new ForbiddenAppException(NotAllowed);
        }

        // Scoped at the source: an Org Admin's query never reaches beyond their own organization,
        // so the list cannot leak users they may not target even before selectability is applied.
        var organizationId = realRole == Role.SiteAdmin ? (Guid?)null : realUser.OrganizationId;
        var users = await _userRepository.SearchForImpersonationAsync(organizationId, search, cancellationToken);

        var candidates = new List<ViewAsCandidate>();
        foreach (var user in users)
        {
            // D-SCOPE: Site Admins are never targets. They own no org content, so acting as a peer
            // grants nothing — and it would be a lateral move between equally-privileged accounts.
            if (user.Role == Role.SiteAdmin || user.Id == realUser.Id || user.OrganizationId is null)
            {
                continue;
            }

            var organization = await _organizationRepository.GetByIdAsync(user.OrganizationId.Value, cancellationToken);

            // Inactive users are returned so the picker can show them greyed out (rule 21), but
            // `Selectable` is false and StartAsync refuses them regardless of what the list showed.
            candidates.Add(new ViewAsCandidate(
                user.Id, user.FirstName, user.LastName, user.Email, user.Role, user.Status,
                user.OrganizationId.Value, organization?.Title ?? string.Empty,
                Selectable: user.Status == UserStatus.Active && organization is { IsArchived: false }));
        }

        return candidates;
    }

    /// <summary>
    /// The authorization matrix (rule 8). Every refusal returns the same message so the endpoint
    /// cannot be used to probe whether a user exists, what role they hold, or which organization
    /// they belong to.
    /// </summary>
    private void EnsureMayActAs(User realUser, Role realRole, User target)
    {
        // The SiteAdmin clause is currently redundant: the domain forbids a Site Admin from having
        // an OrganizationId at all (User.cs:84 and :225), so the null-organization clause below
        // already rejects every one of them. It is kept deliberately — it states D-SCOPE at the point
        // of enforcement rather than leaving the decision resting on an invariant declared elsewhere,
        // and it keeps holding if org-scoped Site Admins ever become representable.
        if (target.Id == realUser.Id
            || target.Role == Role.SiteAdmin          // D-SCOPE (see note above)
            || target.OrganizationId is null          // not organization-scoped
            || target.Status != UserStatus.Active)    // rule 10 — Inactive, never "suspended"
        {
            throw new ForbiddenAppException(NotAllowed);
        }

        // Rule 11: checked against the caller's REAL role and organization. An Org Admin can never
        // reach outside their own organization by any path, including via an earlier session.
        if (realRole == Role.OrgAdmin && realUser.OrganizationId != target.OrganizationId)
        {
            throw new ForbiddenAppException(NotAllowed);
        }
    }

    private async Task<(User RealUser, Role RealRole)> RequireRealActorAsync(CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.RealUserId is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        // Read from live state rather than from the acting context: while a session is live,
        // _currentUser.Role is the target's role, which must never decide impersonation rights.
        var realUser = await _userRepository.GetByIdAsync(_currentUser.RealUserId.Value, cancellationToken)
            ?? throw new UnauthorizedAppException("Caller identity could not be resolved.");

        return (realUser, realUser.Role);
    }

    /// <summary>
    /// Attribution for View As lifecycle events: the actor is always the <b>real</b> administrator
    /// and the impersonated user is carried in its own column (rule 14), so the trail can never be
    /// read as the target having done this to themselves.
    /// </summary>
    private Task AuditAsync(
        string eventType, string message, DateTime nowUtc,
        Guid? organizationId, Guid realUserId, Guid targetUserId, CancellationToken cancellationToken)
    {
        var auditEvent = AuditEvent.Create(
            eventType, "User", message, nowUtc,
            organizationId: organizationId, actorUserId: realUserId, entityId: targetUserId,
            metadataJson: null, onBehalfOfUserId: targetUserId);
        return _audit.WriteAsync(auditEvent, cancellationToken);
    }

    private static string Describe(User user) => $"{user.FirstName} {user.LastName}".Trim();

    private const string NotAllowed = "You are not allowed to view as that user.";
}
