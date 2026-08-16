using Collega.Application.Ai;
using Collega.Domain.Ai;

namespace Collega.Application.Abstractions;

/// <summary>
/// Reads and writes the AI consumption meter (SPEC/20-feature-ai-idea-assist.md rules 28a–28d).
/// </summary>
public interface IAiUsageRepository
{
    /// <summary>Records one model call's consumption.</summary>
    Task AddAsync(AiUsageRecord record, CancellationToken cancellationToken = default);

    /// <summary>
    /// Total tokens consumed across <b>every</b> organization at or after <paramref name="fromUtc"/> —
    /// the number the daily budget gate compares against. Deliberately not org-scoped: the ceiling
    /// is one shared pool.
    /// </summary>
    Task<long> GetTotalTokensSinceAsync(DateTime fromUtc, CancellationToken cancellationToken = default);

    /// <summary>
    /// Per-organization totals over a window, ordered by consumption descending. Aggregated in the
    /// database rather than by materializing rows — a busy month is a lot of rows and the caller
    /// only ever wants the sums.
    /// </summary>
    Task<IReadOnlyList<AiUsageSummary>> GetUsageByOrganizationAsync(
        DateTime fromUtc,
        DateTime toUtc,
        Guid? organizationId = null,
        CancellationToken cancellationToken = default);
}
