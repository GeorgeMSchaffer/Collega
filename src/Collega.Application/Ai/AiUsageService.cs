using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Ai;
using Collega.Domain.Enums;

namespace Collega.Application.Ai;

/// <summary>
/// The AI cost controls: the daily token budget gate and the per-organization usage reports
/// (SPEC/20-feature-ai-idea-assist.md rules 28a–28e).
/// </summary>
/// <remarks>
/// Deliberately separate from the idea-assist use case. The gate and the meter are about what the
/// deployment key may spend and who spent it; they are not part of drafting an idea, and keeping
/// them apart means the usage surface has no dependency on the model provider at all.
/// </remarks>
public sealed class AiUsageService : IAiUsageService
{
    private readonly IAiUsageRepository _usageRepository;
    private readonly ICurrentUserContext _currentUser;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;
    private readonly AiUsageLimits _limits;

    public AiUsageService(
        IAiUsageRepository usageRepository,
        ICurrentUserContext currentUser,
        IUnitOfWork unitOfWork,
        IClock clock,
        AiUsageLimits limits)
    {
        _usageRepository = usageRepository;
        _currentUser = currentUser;
        _unitOfWork = unitOfWork;
        _clock = clock;
        _limits = limits;
    }

    /// <summary>
    /// Whether another model call is allowed under today's ceiling (rule 28a). Callers must check
    /// this <b>before</b> invoking the provider — the point of the gate is to not spend.
    /// </summary>
    /// <remarks>
    /// Consumption is only known after a call returns, so this compares the day's committed total
    /// against the ceiling rather than predicting the next call's cost. Overshoot is therefore
    /// bounded by one in-flight turn, which is immaterial against a ceiling in the hundreds of
    /// thousands of tokens.
    /// </remarks>
    public async Task<bool> IsWithinDailyBudgetAsync(CancellationToken cancellationToken = default)
    {
        if (!_limits.IsEnforced)
        {
            return true;
        }

        var used = await _usageRepository.GetTotalTokensSinceAsync(StartOfUtcToday(), cancellationToken);
        return used < _limits.DailyTokenLimit;
    }

    /// <summary>
    /// Meters one model call. Called after every turn — including refused and failed ones, which
    /// consumed tokens too (rule 28c).
    /// </summary>
    /// <param name="organizationId">
    /// The organization the work belongs to. Callers pass <c>ICurrentUserContext.OrganizationId</c>,
    /// which during a View As session is the <b>impersonated</b> user's organization (view-as rule
    /// 15) — so a Site Admin drafting on behalf of Acme spends Acme's budget, not nobody's.
    /// </param>
    public async Task RecordAsync(
        Guid organizationId,
        AiCallOutcome outcome,
        int inputTokens,
        int outputTokens,
        int cacheReadInputTokens = 0,
        int cacheCreationInputTokens = 0,
        Guid? boardId = null,
        CancellationToken cancellationToken = default)
    {
        // Same actor/on-behalf-of split the audit trail uses: the actor stays the real
        // administrator so a row can never read as though the impersonated user did it themselves.
        var attribution = _currentUser.AttributeAudit(_currentUser.UserId);

        var record = AiUsageRecord.Create(
            organizationId,
            _limits.Model,
            _clock.UtcNow,
            inputTokens,
            outputTokens,
            _limits.InputRatePerMillion,
            _limits.OutputRatePerMillion,
            outcome,
            attribution.ActorUserId,
            attribution.OnBehalfOfUserId,
            boardId,
            cacheReadInputTokens,
            cacheCreationInputTokens);

        await _usageRepository.AddAsync(record, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Platform-wide consumption, one entry per organization. Site Admin only.</summary>
    public async Task<AiUsageReport> GetPlatformUsageAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        if (RequireAuthenticatedRole() != Role.SiteAdmin)
        {
            throw new ForbiddenAppException("Only a Site Admin can view platform-wide AI usage.");
        }

        var (from, to) = ResolveWindow(fromUtc, toUtc);
        var organizations = await _usageRepository.GetUsageByOrganizationAsync(from, to, null, cancellationToken);
        var usedToday = await _usageRepository.GetTotalTokensSinceAsync(StartOfUtcToday(), cancellationToken);

        return new AiUsageReport(from, to, organizations, _limits.DailyTokenLimit, usedToday);
    }

    /// <summary>
    /// One organization's consumption. Site Admin may read any; Org Admin only their own. The
    /// ceiling is omitted — it is platform-wide and not an organization's business.
    /// </summary>
    public async Task<AiUsageReport> GetOrganizationUsageAsync(
        Guid organizationId,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        var role = RequireAuthenticatedRole();

        if (role != Role.SiteAdmin && role != Role.OrgAdmin)
        {
            throw new ForbiddenAppException("You are not allowed to view AI usage.");
        }

        // 404 rather than 403 for an out-of-scope organization, matching OrganizationService: a
        // wrong-org request must not confirm that the organization exists.
        if (role == Role.OrgAdmin && _currentUser.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Organization not found.");
        }

        var (from, to) = ResolveWindow(fromUtc, toUtc);
        var organizations = await _usageRepository.GetUsageByOrganizationAsync(from, to, organizationId, cancellationToken);

        return new AiUsageReport(from, to, organizations);
    }

    /// <summary>
    /// Defaults to the current UTC month, per the contract. An inverted range is a caller error
    /// rather than an empty result — silently returning nothing would read as "no usage".
    /// </summary>
    private (DateTime FromUtc, DateTime ToUtc) ResolveWindow(DateTime? fromUtc, DateTime? toUtc)
    {
        var now = _clock.UtcNow;
        var from = fromUtc ?? new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = toUtc ?? now;

        if (to < from)
        {
            throw new ValidationAppException("toUtc", new[] { "The end of the range cannot be before the start." });
        }

        return (DateTime.SpecifyKind(from, DateTimeKind.Utc), DateTime.SpecifyKind(to, DateTimeKind.Utc));
    }

    /// <summary>
    /// Midnight UTC. The day boundary is UTC because there is no per-organization timezone in the
    /// model and the ceiling is one shared pool — a per-org local midnight would have no single
    /// meaning to reset on.
    /// </summary>
    private DateTime StartOfUtcToday() => _clock.UtcNow.Date;

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }
}
