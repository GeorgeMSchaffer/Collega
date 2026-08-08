using Collega.Application.Abstractions;
using Collega.Domain.Tags;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

/// <summary>
/// Tag persistence. <see cref="GetOrCreateAsync"/> deliberately owns its own <c>SaveChanges</c> and
/// a retry (rather than deferring to <see cref="IUnitOfWork"/>) so it can catch the unique-index
/// violation raised when two requests create the same normalized tag concurrently and converge both
/// on the single persisted row (SPEC/20-feature-ideas-and-engagement.md "Tags" #7). Tags are
/// independent reusable entities, so committing them ahead of the referencing idea is safe.
/// </summary>
public sealed class EfTagRepository : ITagRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfTagRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Tag>> ListByIdsAsync(IReadOnlyCollection<Guid> tagIds, CancellationToken cancellationToken = default)
    {
        if (tagIds.Count == 0)
        {
            return Array.Empty<Tag>();
        }

        var ids = tagIds.ToList();
        return await _dbContext.Tags
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Tag>> GetOrCreateAsync(
        Guid organizationId,
        IReadOnlyCollection<string> requestedNames,
        DateTime nowUtc,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var byNormalized = requestedNames
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .GroupBy(Tag.Normalize)
            .ToDictionary(g => g.Key, g => g.First().Trim());

        if (byNormalized.Count == 0)
        {
            return Array.Empty<Tag>();
        }

        var normalizedKeys = byNormalized.Keys.ToList();

        var existing = await _dbContext.Tags
            .Where(t => t.OrganizationId == organizationId && normalizedKeys.Contains(t.NormalizedName))
            .ToListAsync(cancellationToken);
        var existingByNormalized = existing.ToDictionary(t => t.NormalizedName);

        var toCreate = byNormalized
            .Where(kvp => !existingByNormalized.ContainsKey(kvp.Key))
            .Select(kvp => Tag.Create(organizationId, kvp.Value, nowUtc, actorUserId))
            .ToList();

        if (toCreate.Count == 0)
        {
            return existing;
        }

        await _dbContext.Tags.AddRangeAsync(toCreate, cancellationToken);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // A concurrent request persisted one or more of the same normalized tags first. Detach
            // the rejected inserts and re-read so both callers converge on the single stored tag.
            foreach (var tag in toCreate)
            {
                _dbContext.Entry(tag).State = EntityState.Detached;
            }

            return await _dbContext.Tags
                .Where(t => t.OrganizationId == organizationId && normalizedKeys.Contains(t.NormalizedName))
                .ToListAsync(cancellationToken);
        }

        return existing.Concat(toCreate).ToList();
    }

    public async Task<IReadOnlyList<string>> SearchByPrefixAsync(
        Guid organizationId,
        string normalizedPrefix,
        int limit,
        CancellationToken cancellationToken = default) =>
        await _dbContext.Tags
            .AsNoTracking()
            .Where(t => t.OrganizationId == organizationId && t.NormalizedName.StartsWith(normalizedPrefix))
            .OrderBy(t => t.NormalizedName)
            .Take(limit)
            .Select(t => t.Name)
            .ToListAsync(cancellationToken);
}
