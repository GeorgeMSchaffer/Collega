using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Boards;
using Collega.Domain.Enums;
using Collega.Domain.Statuses;

namespace Collega.Application.Boards;

/// <summary>
/// Board configuration use cases (T021-T024). Site Admin may manage any organization; Org Admin only
/// their own. Listing and detail are available to any authenticated member of the organization;
/// create/update/reorder are admin-only (rule #5).
/// </summary>
public sealed class BoardService : IBoardService
{
    private readonly IBoardRepository _boardRepository;
    private readonly IStatusRepository _statusRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public BoardService(
        IBoardRepository boardRepository,
        IStatusRepository statusRepository,
        IOrganizationRepository organizationRepository,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _boardRepository = boardRepository;
        _statusRepository = statusRepository;
        _organizationRepository = organizationRepository;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<IReadOnlyList<BoardListItem>> ListAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        EnsureReadScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var boards = await _boardRepository.ListByOrganizationAsync(organizationId, cancellationToken);
        return boards
            .Select(b => new BoardListItem(b.Id, b.OrganizationId, b.Name, b.AllowUserStatusUpdate, b.Swimlanes.Count))
            .ToList();
    }

    public async Task<CreateBoardResult> CreateAsync(Guid organizationId, CreateBoardCommand command, CancellationToken cancellationToken = default)
    {
        EnsureAdminScope(organizationId);
        await EnsureOrganizationExistsAsync(organizationId, cancellationToken);

        var statusLookup = await LoadStatusLookupAsync(organizationId, cancellationToken);
        var orderedStatusIds = ValidateAndOrderSwimlanes(command.Swimlanes, statusLookup);

        var now = _clock.UtcNow;
        var board = Board.Create(organizationId, command.Name, command.AllowUserStatusUpdate, orderedStatusIds, now, _currentUser.UserId);
        await _boardRepository.AddAsync(board, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("BoardCreated", organizationId, board.Id, $"Board '{board.Name}' created.", now, new { board.Name, SwimlaneCount = board.Swimlanes.Count }, cancellationToken);

        var swimlanes = BuildSwimlaneDetails(board, statusLookup);
        return new CreateBoardResult(board.Id, board.Name, swimlanes);
    }

    public async Task<BoardDetail> GetByIdAsync(Guid boardId, CancellationToken cancellationToken = default)
    {
        var board = await _boardRepository.GetByIdAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");

        EnsureReadScope(board.OrganizationId);

        var statusLookup = await LoadStatusLookupAsync(board.OrganizationId, cancellationToken);
        return ToDetail(board, statusLookup);
    }

    public async Task<BoardDetail> UpdateAsync(Guid boardId, UpdateBoardCommand command, CancellationToken cancellationToken = default)
    {
        var board = await _boardRepository.GetByIdAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");

        EnsureAdminScope(board.OrganizationId);

        var statusLookup = await LoadStatusLookupAsync(board.OrganizationId, cancellationToken);
        var orderedStatusIds = ValidateAndOrderSwimlanes(command.Swimlanes, statusLookup);

        var now = _clock.UtcNow;
        board.Update(command.Name, command.AllowUserStatusUpdate, orderedStatusIds, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("BoardUpdated", board.OrganizationId, board.Id, $"Board '{board.Name}' updated.", now, new { board.Name, SwimlaneCount = board.Swimlanes.Count }, cancellationToken);

        return ToDetail(board, statusLookup);
    }

    public async Task ReorderSwimlanesAsync(Guid boardId, ReorderSwimlanesCommand command, CancellationToken cancellationToken = default)
    {
        var board = await _boardRepository.GetByIdAsync(boardId, cancellationToken)
            ?? throw new NotFoundAppException("Board not found.");

        EnsureAdminScope(board.OrganizationId);

        var orderedStatusIds = OrderSwimlaneInputs(command.Swimlanes);
        if (orderedStatusIds.Count != orderedStatusIds.Distinct().Count())
        {
            throw new ValidationAppException("swimlanes", new[] { "A board cannot list the same status twice." });
        }

        // A reorder cannot add or remove swimlanes — it must list exactly the current set (T024).
        var current = board.Swimlanes.Select(sl => sl.StatusId).ToHashSet();
        if (orderedStatusIds.Count != current.Count || !orderedStatusIds.All(current.Contains))
        {
            throw new ValidationAppException("swimlanes", new[] { "A reorder must list exactly the board's current swimlane statuses." });
        }

        var now = _clock.UtcNow;
        board.ReorderSwimlanes(orderedStatusIds, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("BoardSwimlanesReordered", board.OrganizationId, board.Id, $"Board '{board.Name}' swimlanes reordered.", now, null, cancellationToken);
    }

    /// <summary>
    /// Normalizes the requested swimlanes to a dense, ordered list of status ids and validates the
    /// 2-swimlane minimum (T022), distinctness, and that every status is an active status of the
    /// organization (subset support, T023).
    /// </summary>
    private static IReadOnlyList<Guid> ValidateAndOrderSwimlanes(IReadOnlyList<SwimlaneInput>? swimlanes, IReadOnlyDictionary<Guid, Status> statusLookup)
    {
        var orderedStatusIds = OrderSwimlaneInputs(swimlanes);

        if (orderedStatusIds.Count < Board.MinimumSwimlanes)
        {
            throw new ValidationAppException("swimlanes", new[] { $"A board must have at least {Board.MinimumSwimlanes} swimlanes." });
        }

        if (orderedStatusIds.Count != orderedStatusIds.Distinct().Count())
        {
            throw new ValidationAppException("swimlanes", new[] { "A board cannot list the same status twice." });
        }

        foreach (var statusId in orderedStatusIds)
        {
            if (!statusLookup.TryGetValue(statusId, out var status) || status.IsDeleted)
            {
                throw new ValidationAppException("swimlanes", new[] { "Every swimlane must reference an active status in this organization." });
            }
        }

        return orderedStatusIds;
    }

    private static List<Guid> OrderSwimlaneInputs(IReadOnlyList<SwimlaneInput>? swimlanes) =>
        (swimlanes ?? Array.Empty<SwimlaneInput>())
            .OrderBy(s => s.Order)
            .Select(s => s.StatusId)
            .ToList();

    private async Task<IReadOnlyDictionary<Guid, Status>> LoadStatusLookupAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        // Include deleted so board detail can still surface a prior status name if one was later
        // removed (rule #8); create/update validation rejects deleted statuses separately.
        var statuses = await _statusRepository.ListByOrganizationAsync(organizationId, includeDeleted: true, cancellationToken);
        return statuses.ToDictionary(s => s.Id);
    }

    private static BoardDetail ToDetail(Board board, IReadOnlyDictionary<Guid, Status> statusLookup) =>
        new(board.Id, board.OrganizationId, board.Name, board.AllowUserStatusUpdate, BuildSwimlaneDetails(board, statusLookup));

    private static IReadOnlyList<SwimlaneDetail> BuildSwimlaneDetails(Board board, IReadOnlyDictionary<Guid, Status> statusLookup) =>
        board.Swimlanes
            .OrderBy(sl => sl.DisplayOrder)
            .Select(sl =>
            {
                var status = statusLookup.GetValueOrDefault(sl.StatusId);
                return new SwimlaneDetail(
                    sl.StatusId,
                    status?.Name ?? string.Empty,
                    status?.Color ?? string.Empty,
                    sl.DisplayOrder,
                    status?.IsDeleted ?? false);
            })
            .ToList();

    private async Task EnsureOrganizationExistsAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var organization = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
            ?? throw new NotFoundAppException("Organization not found.");
        _ = organization;
    }

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

        throw new NotFoundAppException("Board not found.");
    }

    private void EnsureAdminScope(Guid organizationId)
    {
        var role = RequireAuthenticatedRole();

        // Rule 25: a Site Admin acting as themselves may not mutate org-owned content — View As is
        // the path. No impersonation branch is needed: while a session is live this role is the
        // target's, so the guard does not fire. Read paths use EnsureReadScope and are unaffected.
        _currentUser.EnsureNotDirectSiteAdmin();

        // No SiteAdmin pass-through below, deliberately: the guard above has already refused that
        // role, so a `return` here would be dead code that reads like a live bypass. Should the
        // guard ever move, falling through to the OrgAdmin check denies rather than admits.
        if (role == Role.OrgAdmin)
        {
            if (_currentUser.OrganizationId == organizationId)
            {
                return;
            }

            throw new NotFoundAppException("Board not found.");
        }

        throw new ForbiddenAppException("You are not allowed to manage boards in this organization.");
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private async Task AuditAsync(
        string eventType,
        Guid organizationId,
        Guid boardId,
        string message,
        DateTime nowUtc,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        // Rule 14: while acting as someone, the real administrator is the actor and the target
        // moves to OnBehalfOfUserId — an audit row must never read as though the target did it.
        var attribution = _currentUser.AttributeAudit(_currentUser.UserId);
        var auditEvent = AuditEvent.Create(eventType, "Board", message, nowUtc, organizationId, attribution.ActorUserId, boardId, metadataJson, attribution.OnBehalfOfUserId);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
