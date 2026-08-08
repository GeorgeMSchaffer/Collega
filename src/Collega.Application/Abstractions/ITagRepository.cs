using Collega.Domain.Tags;

namespace Collega.Application.Abstractions;

public interface ITagRepository
{
    /// <summary>Loads tags by their ids (used to project idea tag names).</summary>
    Task<IReadOnlyList<Tag>> ListByIdsAsync(IReadOnlyCollection<Guid> tagIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves the requested tag display names to persisted <see cref="Tag"/> rows within the
    /// organization, creating any that do not yet exist and reusing those that do. Normalized names
    /// are trimmed and compared case-insensitively; the unique (organization, normalized name) index
    /// guarantees concurrent creation of the same name merges to a single tag
    /// (SPEC/20-feature-ideas-and-engagement.md "Tags" #6-7).
    /// </summary>
    Task<IReadOnlyList<Tag>> GetOrCreateAsync(
        Guid organizationId,
        IReadOnlyCollection<string> requestedNames,
        DateTime nowUtc,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Autocomplete: active tag display names in the organization whose normalized form starts with
    /// the given normalized prefix, ordered alphabetically (SPEC/30-Contracts.md tag autocomplete).
    /// </summary>
    Task<IReadOnlyList<string>> SearchByPrefixAsync(
        Guid organizationId,
        string normalizedPrefix,
        int limit,
        CancellationToken cancellationToken = default);
}
