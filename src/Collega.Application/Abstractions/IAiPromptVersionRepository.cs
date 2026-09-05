using Collega.Domain.Ai;

namespace Collega.Application.Abstractions;

/// <summary>
/// Reads and writes published versions of the idea-assist prompt
/// (SPEC/20-feature-ai-idea-assist.md rules 34–36).
/// </summary>
/// <remarks>
/// Not organization-scoped, unlike every other repository here: the prompt is one deployment-wide
/// setting, the same scope as the API key in rule 29.
/// </remarks>
public interface IAiPromptVersionRepository
{
    /// <summary>
    /// The version currently in force, or null when none is — in which case callers fall back to the
    /// built-in default. Null is the normal initial state, not a missing row.
    /// </summary>
    Task<AiPromptVersion?> GetActiveAsync(CancellationToken cancellationToken = default);

    /// <summary>Every version, newest first.</summary>
    Task<IReadOnlyList<AiPromptVersion>> ListAsync(CancellationToken cancellationToken = default);

    Task<AiPromptVersion?> GetByVersionAsync(int version, CancellationToken cancellationToken = default);

    /// <summary>The highest version number issued so far, or 0 when the table is empty.</summary>
    Task<int> GetMaxVersionAsync(CancellationToken cancellationToken = default);

    Task AddAsync(AiPromptVersion version, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stands down every active row. Called before publishing, and on its own when resetting to the
    /// built-in default — which is why it is a separate operation rather than folded into a publish.
    /// </summary>
    Task DeactivateAllAsync(CancellationToken cancellationToken = default);
}
