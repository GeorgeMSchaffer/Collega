using Collega.Domain.Boards;

namespace Collega.Application.Abstractions;

public interface IBoardRepository
{
    Task AddAsync(Board board, CancellationToken cancellationToken = default);

    /// <summary>Loads a board with its swimlanes, tracked so mutations can be persisted.</summary>
    Task<Board?> GetByIdAsync(Guid boardId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Board>> ListByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>
    /// True when the status is used as a swimlane on any board. Status deletion is rejected while a
    /// reference exists (SPEC/20-feature-boards-and-statuses.md "Status Rules" #6).
    /// </summary>
    Task<bool> IsStatusReferencedAsync(Guid statusId, CancellationToken cancellationToken = default);
}
