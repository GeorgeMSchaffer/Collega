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
