using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Application.Organizations;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Statuses;

namespace Collega.Application.Statuses;

/// <summary>
/// Status configuration use cases (T020). Site Admin may manage any organization; Org Admin only
/// their own. Listing is available to any authenticated member of the organization because every
/// board render needs the status catalog; create/update/delete are admin-only (rule #2).
/// </summary>
public sealed class StatusService : IStatusService
{
    private const int SortOrderStep = 10;

    private readonly IStatusRepository _statusRepository;
    private readonly IBoardRepository _boardRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public StatusService(
        IStatusRepository statusRepository,
        IBoardRepository boardRepository,
        IOrganizationRepository organizationRepository,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _statusRepository = statusRepository;
        _boardRepository = boardRepository;
        _organizationRepository = organizationRepository;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<IReadOnlyList<StatusItem>> ListAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var statuses = await _statusRepository.ListByOrganizationAsync(organizationId, includeDeleted, cancellationToken);
        return statuses.Select(ToItem).ToList();
    }

    public async Task<CreateStatusResult> CreateAsync(Guid organizationId, CreateStatusCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var now = _clock.UtcNow;
        var color = string.IsNullOrWhiteSpace(command.Color) ? OrganizationDefaults.DefaultStatusColor : command.Color;

        var sortOrder = command.SortOrder ?? await NextSortOrderAsync(organizationId, cancellationToken);

        var status = Status.Create(organizationId, command.Name, color, sortOrder, now, _currentUser.UserId);
        await _statusRepository.AddAsync(status, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("StatusCreated", organizationId, status.Id, $"Status '{status.Name}' created.", now, new { status.Name, status.Color, status.SortOrder }, cancellationToken);

        return new CreateStatusResult(status.Id, status.Name, status.Color, status.SortOrder);
    }

    public async Task<StatusItem> UpdateAsync(Guid statusId, UpdateStatusCommand command, CancellationToken cancellationToken = default)
    {
        var status = await _statusRepository.GetByIdAsync(statusId, cancellationToken)
            ?? throw new NotFoundAppException("Status not found.");

        EnsureAdminScope(status.OrganizationId);

        // A soft-deleted status is not part of the active catalog; treat it as gone.
        if (status.IsDeleted)
        {
            throw new NotFoundAppException("Status not found.");
        }

        var now = _clock.UtcNow;
        var color = string.IsNullOrWhiteSpace(command.Color) ? status.Color : command.Color;
        var sortOrder = command.SortOrder ?? status.SortOrder;

        status.Update(command.Name, color, sortOrder, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("StatusUpdated", status.OrganizationId, status.Id, $"Status '{status.Name}' updated.", now, new { status.Name, status.Color, status.SortOrder }, cancellationToken);

        return ToItem(status);
    }

    public async Task ReorderAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var active = await _statusRepository.ListByOrganizationAsync(organizationId, includeDeleted: false, cancellationToken);
        EnsureReorderCoversActive(orderedIds, active.Select(s => s.Id));

        var now = _clock.UtcNow;
        var byId = active.ToDictionary(s => s.Id);
        for (var i = 0; i < orderedIds.Count; i++)
        {
            byId[orderedIds[i]].SetSortOrder((i + 1) * SortOrderStep, now, _currentUser.UserId);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await AuditAsync("StatusesReordered", organizationId, organizationId, "Status order updated.", now, null, cancellationToken);
    }

    public async Task DeleteAsync(Guid statusId, CancellationToken cancellationToken = default)
    {
        var status = await _statusRepository.GetByIdAsync(statusId, cancellationToken)
            ?? throw new NotFoundAppException("Status not found.");

        EnsureAdminScope(status.OrganizationId);

        if (status.IsDeleted)
        {
            // Soft delete is idempotent.
            return;
        }

        // Rule #7: an organization must retain at least 2 active statuses at all times. The status
        // being deleted is still active, so the current active count must exceed the floor.
        var activeCount = await _statusRepository.CountActiveByOrganizationAsync(status.OrganizationId, cancellationToken);
        if (activeCount <= Status.MinimumActiveStatusesPerOrganization)
        {
            throw new ValidationAppException("status", new[]
            {
                $"An organization must keep at least {Status.MinimumActiveStatusesPerOrganization} active statuses; this status cannot be deleted."
            });
        }

        // Rule #6: a status referenced as a swimlane on any board cannot be soft-deleted.
        if (await _boardRepository.IsStatusReferencedAsync(statusId, cancellationToken))
        {
            throw new ValidationAppException("status", new[]
            {
                "This status is used as a swimlane on a board and cannot be deleted until it is removed from that board."
            });
        }

        var now = _clock.UtcNow;
        status.SoftDelete(now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("StatusDeleted", status.OrganizationId, status.Id, $"Status '{status.Name}' soft-deleted.", now, null, cancellationToken);
    }

    private static void EnsureReorderCoversActive(IReadOnlyList<Guid> orderedIds, IEnumerable<Guid> activeIds)
    {
        var active = activeIds.ToHashSet();
        if (orderedIds is null || orderedIds.Count != active.Count || orderedIds.Distinct().Count() != orderedIds.Count || !orderedIds.All(active.Contains))
        {
            throw new ValidationAppException("orderedIds", new[] { "The reorder must list every active status exactly once." });
        }
    }

    private async Task<int> NextSortOrderAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var existing = await _statusRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        return existing.Count == 0 ? SortOrderStep : existing.Max(s => s.SortOrder) + SortOrderStep;
    }

    private async Task EnsureOrganizationExistsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var organization = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");
        _ = organization;
    }

    /// <summary>Site Admin (any org) or a member of the target organization (any role) may read the catalog.</summary>
    private void EnsureReadScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin)
        {
            return;
        }

        if (_currentUser.OrganizationId == organizationId)
        {
            return;
        }

        throw new NotFoundAppException("Organization not found.");
    }

    /// <summary>Site Admin (any org) or Org Admin (own org) may manage statuses (rule #2).</summary>
    private void EnsureAdminScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();
        if (role == Role.SiteAdmin)
        {
            return;
        }

        if (role == Role.OrgAdmin)
        {
            if (_currentUser.OrganizationId == organizationId)
            {
                return;
            }

            throw new NotFoundAppException("Organization not found.");
        }

        throw new ForbiddenAppException("You are not allowed to manage statuses in this organization.");
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private static StatusItem ToItem(Status s) => new(s.Id, s.OrganizationId, s.Name, s.Color, s.SortOrder, s.IsDeleted);

    private async Task AuditAsync(
        string eventType,
        Guid organizationId,
        Guid statusId,
        string message,
        DateTime nowUtc,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        var auditEvent = AuditEvent.Create(eventType, "Status", message, nowUtc, organizationId, _currentUser.UserId, statusId, metadataJson);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
