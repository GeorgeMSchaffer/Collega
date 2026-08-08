using Collega.Domain.IdeaFields;

namespace Collega.Application.Abstractions;

public interface IIdeaTypeRepository
{
    Task AddAsync(IdeaType option, CancellationToken cancellationToken = default);

    Task AddRangeAsync(IEnumerable<IdeaType> options, CancellationToken cancellationToken = default);

    Task<IdeaType?> GetByIdAsync(Guid ideaTypeId, CancellationToken cancellationToken = default);

    /// <summary>Organization options in catalog order; active only unless <paramref name="includeDeleted"/>.</summary>
    Task<IReadOnlyList<IdeaType>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
}
