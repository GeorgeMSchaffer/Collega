using Collega.Domain.Upvotes;

namespace Collega.Application.Abstractions;

public interface IIdeaUpvoteRepository
{
    Task<IdeaUpvote?> GetAsync(Guid ideaId, Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(IdeaUpvote upvote, CancellationToken cancellationToken = default);

    void Remove(IdeaUpvote upvote);

    Task<int> CountByIdeaAsync(Guid ideaId, CancellationToken cancellationToken = default);

    /// <summary>Upvote counts keyed by idea id, for enriching the board idea list.</summary>
    Task<IReadOnlyDictionary<Guid, int>> CountByIdeaIdsAsync(IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default);

    /// <summary>The subset of <paramref name="ideaIds"/> the given user has an active upvote on.</summary>
    Task<IReadOnlySet<Guid>> GetUpvotedIdeaIdsAsync(Guid userId, IReadOnlyCollection<Guid> ideaIds, CancellationToken cancellationToken = default);
}
