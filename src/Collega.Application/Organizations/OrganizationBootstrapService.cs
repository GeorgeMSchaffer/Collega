using Collega.Application.Abstractions;
using Collega.Domain.Boards;
using Collega.Domain.IdeaFields;
using Collega.Domain.Statuses;

namespace Collega.Application.Organizations;

public sealed class OrganizationBootstrapService : IOrganizationBootstrapService
{
    private readonly IStatusRepository _statusRepository;
    private readonly IBoardRepository _boardRepository;
    private readonly IIdeaTypeRepository _ideaTypeRepository;
    private readonly IBusinessImpactRepository _businessImpactRepository;

    public OrganizationBootstrapService(
        IStatusRepository statusRepository,
        IBoardRepository boardRepository,
        IIdeaTypeRepository ideaTypeRepository,
        IBusinessImpactRepository businessImpactRepository)
    {
        _statusRepository = statusRepository;
        _boardRepository = boardRepository;
        _ideaTypeRepository = ideaTypeRepository;
        _businessImpactRepository = businessImpactRepository;
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

        // Canonical Idea Type and Business Impact option sets (first by sort order is the default).
        var ideaTypes = OrganizationDefaults.IdeaTypes
            .Select(t => IdeaType.Create(organizationId, t.Name, t.SortOrder, nowUtc, actorUserId))
            .ToList();
        await _ideaTypeRepository.AddRangeAsync(ideaTypes, cancellationToken);

        var businessImpacts = OrganizationDefaults.BusinessImpacts
            .Select(b => BusinessImpact.Create(organizationId, b.Name, b.Color, b.SortOrder, nowUtc, actorUserId))
            .ToList();
        await _businessImpactRepository.AddRangeAsync(businessImpacts, cancellationToken);

        return new OrganizationBootstrapResult(board.Id, statuses.Count);
    }
}
