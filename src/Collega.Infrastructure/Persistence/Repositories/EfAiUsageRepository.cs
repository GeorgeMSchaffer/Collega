using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Collega.Domain.Ai;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

/// <summary>
/// The AI consumption meter (SPEC/20-feature-ai-idea-assist.md rules 28a–28d).
/// </summary>
/// <remarks>
/// Both reads aggregate in the database rather than materializing rows. The budget total is summed
/// on every model call, and a month of usage is a lot of rows to pull back only to add up — this is
/// the one place in the AI feature where query shape has a running cost.
/// </remarks>
public sealed class EfAiUsageRepository : IAiUsageRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfAiUsageRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(AiUsageRecord record, CancellationToken cancellationToken = default)
    {
        await _dbContext.AiUsageRecords.AddAsync(record, cancellationToken);
    }

    /// <summary>
    /// Platform-wide token total since <paramref name="fromUtc"/>. No organization predicate — the
    /// ceiling is one shared pool across every organization (rule 28a).
    /// </summary>
    public async Task<long> GetTotalTokensSinceAsync(DateTime fromUtc, CancellationToken cancellationToken = default)
    {
        // Summed as long: an int sum would overflow at ~2.1 billion tokens, which a busy month of a
        // large deployment could reach.
        return await _dbContext.AiUsageRecords
            .AsNoTracking()
            .Where(r => r.OccurredAtUtc >= fromUtc)
            .SumAsync(
                r => (long)r.InputTokens + r.OutputTokens + r.CacheReadInputTokens + r.CacheCreationInputTokens,
                cancellationToken);
    }

    public async Task<IReadOnlyList<AiUsageSummary>> GetUsageByOrganizationAsync(
        DateTime fromUtc,
        DateTime toUtc,
        Guid? organizationId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.AiUsageRecords
            .AsNoTracking()
            .Where(r => r.OccurredAtUtc >= fromUtc && r.OccurredAtUtc <= toUtc);

        if (organizationId is Guid scopedOrganizationId)
        {
            query = query.Where(r => r.OrganizationId == scopedOrganizationId);
        }

        // Cost is computed from the rates stored on each row, not from current configuration, so a
        // pricing change never restates what an organization already owes (rule 28c). Cache reads
        // and writes are priced off the input rate at the provider's published multipliers.
        var grouped = await query
            .GroupBy(r => r.OrganizationId)
            .Select(g => new
            {
                OrganizationId = g.Key,
                Calls = g.Count(),
                InputTokens = g.Sum(r => (long)r.InputTokens),
                OutputTokens = g.Sum(r => (long)r.OutputTokens),
                CacheReadInputTokens = g.Sum(r => (long)r.CacheReadInputTokens),
                CacheCreationInputTokens = g.Sum(r => (long)r.CacheCreationInputTokens),
                EstimatedCost = g.Sum(r =>
                    (r.InputTokens * r.InputRatePerMillion
                     + r.CacheReadInputTokens * r.InputRatePerMillion * 0.1m
                     + r.CacheCreationInputTokens * r.InputRatePerMillion * 1.25m
                     + r.OutputTokens * r.OutputRatePerMillion) / 1_000_000m),
            })
            .ToListAsync(cancellationToken);

        if (grouped.Count == 0)
        {
            return Array.Empty<AiUsageSummary>();
        }

        // Names resolved in a second pass rather than joined: usage rows keep no foreign key to
        // Organization on purpose, so that deleting an organization can never take its spend
        // history with it. An org that has since been removed still shows its consumption.
        var ids = grouped.Select(g => g.OrganizationId).ToList();
        var names = await _dbContext.Organizations
            .AsNoTracking()
            .Where(o => ids.Contains(o.Id))
            .ToDictionaryAsync(o => o.Id, o => o.Title, cancellationToken);

        return grouped
            .Select(g => new AiUsageSummary(
                g.OrganizationId,
                names.TryGetValue(g.OrganizationId, out var title) ? title : "(deleted organization)",
                g.Calls,
                g.InputTokens,
                g.OutputTokens,
                g.CacheReadInputTokens,
                g.CacheCreationInputTokens,
                g.EstimatedCost))
            .OrderByDescending(s => s.TotalTokens)
            .ToList();
    }
}
