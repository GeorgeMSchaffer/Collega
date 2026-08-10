namespace Collega.Application.Statuses;

/// <summary>
/// Organization-scoped status configuration (SPEC/20-feature-boards-and-statuses.md "Status Rules",
/// SPEC/30-Contracts.md "Status Contracts"). Authorization, the 2-active-status floor, and the
/// no-active-board-reference guard on delete are enforced here.
/// </summary>
public interface IStatusService
{
    Task<IReadOnlyList<StatusItem>> ListAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<CreateStatusResult> CreateAsync(Guid organizationId, CreateStatusCommand command, CancellationToken cancellationToken = default);

    Task<StatusItem> UpdateAsync(Guid statusId, UpdateStatusCommand command, CancellationToken cancellationToken = default);

    /// <summary>Replaces the complete active-status order atomically; the list must name every active status exactly once.</summary>
    Task ReorderAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid statusId, CancellationToken cancellationToken = default);
}
