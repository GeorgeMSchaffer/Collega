using Collega.Domain.Statuses;

namespace Collega.Application.Abstractions;

public interface IStatusRepository
{
    Task AddAsync(Status status, CancellationToken cancellationToken = default);

    Task AddRangeAsync(IEnumerable<Status> statuses, CancellationToken cancellationToken = default);

    Task<Status?> GetByIdAsync(Guid statusId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Status>> ListActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists an organization's statuses in catalog order. When <paramref name="includeDeleted"/> is
    /// false only active statuses are returned; when true soft-deleted statuses are included so
    /// historical views can surface their prior names with a deleted label (rule #8).
    /// </summary>
    Task<IReadOnlyList<Status>> ListByOrganizationAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    /// <summary>Counts the organization's active (non-deleted) statuses for the 2-active floor (rule #7).</summary>
    Task<int> CountActiveByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);
}
