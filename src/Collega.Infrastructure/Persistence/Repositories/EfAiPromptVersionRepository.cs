using Collega.Application.Abstractions;
using Collega.Domain.Ai;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

/// <summary>
/// Published versions of the idea-assist prompt (SPEC/20-feature-ai-idea-assist.md rules 34–36).
/// </summary>
/// <remarks>
/// The active read runs on the drafting hot path — once per turn, alongside the seven reads
/// <c>IdeaAssistContextBuilder</c> already makes. It is a single-row lookup on a filtered unique index,
/// so it is deliberately left uncached: a cache here would need invalidating on every publish, and
/// getting that wrong means a deployment silently running a prompt nobody can see in the UI.
/// </remarks>
public sealed class EfAiPromptVersionRepository : IAiPromptVersionRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfAiPromptVersionRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public Task<AiPromptVersion?> GetActiveAsync(CancellationToken cancellationToken = default) =>
        _dbContext.AiPromptVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.IsActive, cancellationToken);

    public async Task<IReadOnlyList<AiPromptVersion>> ListAsync(CancellationToken cancellationToken = default) =>
        await _dbContext.AiPromptVersions
            .AsNoTracking()
            .OrderByDescending(v => v.Version)
            .ToListAsync(cancellationToken);

    public Task<AiPromptVersion?> GetByVersionAsync(int version, CancellationToken cancellationToken = default) =>
        _dbContext.AiPromptVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.Version == version, cancellationToken);

    public async Task<int> GetMaxVersionAsync(CancellationToken cancellationToken = default) =>
        await _dbContext.AiPromptVersions.AnyAsync(cancellationToken)
            ? await _dbContext.AiPromptVersions.MaxAsync(v => v.Version, cancellationToken)
            : 0;

    public async Task AddAsync(AiPromptVersion version, CancellationToken cancellationToken = default) =>
        await _dbContext.AiPromptVersions.AddAsync(version, cancellationToken);

    /// <summary>
    /// Tracked, not <c>ExecuteUpdate</c>: the caller stages this alongside the insert and commits both
    /// through <c>IUnitOfWork</c>, so a failed publish cannot leave the deployment with no active prompt.
    /// </summary>
    public async Task DeactivateAllAsync(CancellationToken cancellationToken = default)
    {
        var active = await _dbContext.AiPromptVersions
            .Where(v => v.IsActive)
            .ToListAsync(cancellationToken);

        foreach (var version in active)
        {
            version.Deactivate();
        }
    }
}
