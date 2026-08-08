using Collega.Domain.Statuses;

namespace Collega.Application.Abstractions;

public interface IStatusRepository
{
    Task AddRangeAsync(IEnumerable<Status> statuses, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Status>> ListActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
}
