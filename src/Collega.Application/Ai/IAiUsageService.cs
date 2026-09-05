using Collega.Application.Exceptions;
using Collega.Domain.Ai;

namespace Collega.Application.Ai;

/// <summary>
/// AI cost controls (SPEC/20-feature-ai-idea-assist.md rules 28a–28e). The idea-assist use case
/// depends on this interface for the budget gate and the meter; the API depends on it for the usage
/// reports.
/// </summary>
public interface IAiUsageService
{
    /// <summary>
    /// Whether another model call is allowed under today's ceiling. Check <b>before</b> calling the
    /// provider — a gate consulted afterwards has already spent the money it was meant to save.
    /// </summary>
    Task<bool> IsWithinDailyBudgetAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Enforces the per-user and per-organization request limits (rule 26). Also check <b>before</b>
    /// calling the provider, for the same reason.
    /// </summary>
    /// <exception cref="RateLimitedAppException">Either limit is exhausted for the current window.</exception>
    Task EnforceRateLimitAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Recent call outcomes for the current actor on one board, newest first — server-side truth
    /// about how a conversation has gone, for callers that must not trust the client's transcript.
    /// </summary>
    Task<IReadOnlyList<AiCallOutcome>> GetRecentOutcomesAsync(
        Guid organizationId,
        Guid boardId,
        int limit,
        DateTime fromUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Meters one model call, including refused and failed turns — they consumed tokens too, and a
    /// meter that counted only successes would not bound spend.
    /// </summary>
    Task RecordAsync(
        Guid organizationId,
        AiCallOutcome outcome,
        int inputTokens,
        int outputTokens,
        int cacheReadInputTokens = 0,
        int cacheCreationInputTokens = 0,
        Guid? boardId = null,
        CancellationToken cancellationToken = default);

    /// <summary>Platform-wide consumption by organization. Site Admin only.</summary>
    Task<AiUsageReport> GetPlatformUsageAsync(
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default);

    /// <summary>One organization's consumption. Site Admin any organization; Org Admin their own only.</summary>
    Task<AiUsageReport> GetOrganizationUsageAsync(
        Guid organizationId,
        DateTime? fromUtc = null,
        DateTime? toUtc = null,
        CancellationToken cancellationToken = default);
}
