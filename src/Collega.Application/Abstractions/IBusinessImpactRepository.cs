using Collega.Domain.IdeaFields;

namespace Collega.Application.Abstractions;

public interface IBusinessImpactRepository
{
    Task AddAsync(BusinessImpact option, CancellationToken cancellationToken = default);

    Task AddRangeAsync(IEnumerable<BusinessImpact> options, CancellationToken cancellationToken = default);

    Task<BusinessImpact?> GetByIdAsync(Guid businessImpactId, CancellationToken cancellationToken = default);

    /// <summary>Organization options in catalog order; active only unless <paramref name="includeDeleted"/>.</summary>
    Task<IReadOnlyList<BusinessImpact>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
}
