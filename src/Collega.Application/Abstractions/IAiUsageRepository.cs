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

    /// <summary>
    /// Call counts in the rate-limit window (rule 26) — the organization's total and, within it, the
    /// given actor's. Both come back from one round trip because the gate needs both on every call.
    /// </summary>
    /// <param name="actorUserId">
    /// The <b>real</b> caller. During a View As session that is the administrator, not the
    /// impersonated user — otherwise an administrator could reset their own allowance by switching
    /// who they are acting as.
    /// </param>
    Task<AiCallCounts> CountCallsSinceAsync(
        Guid organizationId,
        Guid? actorUserId,
        DateTime fromUtc,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The most recent call outcomes for one actor on one board, newest first — the server-side
    /// record of how a conversation has been going.
    /// </summary>
    /// <remarks>
    /// Exists because the three-strikes close of rule 10 must not be computed from the transcript the
    /// client sends. The client owns that transcript, so a caller probing the scope boundary could
    /// simply omit the evidence of its own refusals and never be cut off. These rows are written by
    /// the server for every turn and cannot be edited by the caller.
    /// </remarks>
    Task<IReadOnlyList<AiCallOutcome>> GetRecentOutcomesAsync(
        Guid organizationId,
        Guid? actorUserId,
        Guid boardId,
        int limit,
        DateTime fromUtc,
        CancellationToken cancellationToken = default);
}
