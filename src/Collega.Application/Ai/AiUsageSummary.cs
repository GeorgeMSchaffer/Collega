namespace Collega.Application.Ai;

/// <summary>
/// One organization's AI consumption over a window (SPEC/30-Contracts.md → "AI Idea Assist Contracts").
/// </summary>
/// <param name="EstimatedCost">
/// USD, summed from the rates stored on each usage record rather than from current configuration —
/// this data supports cost pass-through, so changing configured pricing must never restate what an
/// organization already owes (rule 28c).
/// </param>
public sealed record AiUsageSummary(
    Guid OrganizationId,
    string OrganizationName,
    int Calls,
    long InputTokens,
    long OutputTokens,
    long CacheReadInputTokens,
    long CacheCreationInputTokens,
    decimal EstimatedCost)
{
    public long TotalTokens => InputTokens + OutputTokens + CacheReadInputTokens + CacheCreationInputTokens;
}

/// <summary>
/// The platform-wide usage report. <paramref name="DailyTokenLimit"/> and
/// <paramref name="TokensUsedToday"/> are null on the single-organization report — the ceiling is
/// platform-wide and is not an organization's business.
/// </summary>
public sealed record AiUsageReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<AiUsageSummary> Organizations,
    long? DailyTokenLimit = null,
    long? TokensUsedToday = null)
{
    public int TotalCalls => Organizations.Sum(o => o.Calls);
    public long TotalTokens => Organizations.Sum(o => o.TotalTokens);
    public decimal TotalEstimatedCost => Organizations.Sum(o => o.EstimatedCost);
}
