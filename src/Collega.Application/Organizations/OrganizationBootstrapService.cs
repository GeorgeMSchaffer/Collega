using Collega.Application.Abstractions;
using Collega.Domain.Boards;
using Collega.Domain.Statuses;

namespace Collega.Application.Organizations;

public sealed class OrganizationBootstrapService : IOrganizationBootstrapService
{
    private readonly IStatusRepository _statusRepository;
    private readonly IBoardRepository _boardRepository;

    public OrganizationBootstrapService(IStatusRepository statusRepository, IBoardRepository boardRepository)
    {
        _statusRepository = statusRepository;
        _boardRepository = boardRepository;
    }

    public async Task<OrganizationBootstrapResult> ProvisionDefaultsAsync(
        Guid organizationId,
        DateTime nowUtc,
        Guid? actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statuses = OrganizationDefaults.Statuses
            .Select(s => Status.Create(organizationId, s.Name, s.Color, s.SortOrder, nowUtc, actorUserId))
            .ToList();

        await _statusRepository.AddRangeAsync(statuses, cancellationToken);

        // The default board opens with every default status as a swimlane, in catalog order.
        var orderedStatusIds = statuses.Select(s => s.Id).ToList();
        var board = Board.Create(
            organizationId,
            OrganizationDefaults.DefaultBoardName,
            allowUserStatusUpdate: true,
            orderedStatusIds,
            nowUtc,
            actorUserId);

        await _boardRepository.AddAsync(board, cancellationToken);

        return new OrganizationBootstrapResult(board.Id, statuses.Count);
    }
}
