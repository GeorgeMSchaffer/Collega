using Collega.Domain.Common;

namespace Collega.Domain.Boards;

/// <summary>
/// A collection of ideas organized by status swimlanes (SPEC/20-feature-boards-and-statuses.md
/// "Board Rules"). Enforces the minimum-two-swimlanes invariant (#3). Board management endpoints
/// (create/edit/reorder) belong to the Workflow Configuration slice; this entity is introduced here
/// so a new organization can be provisioned with its one default board (#4).
/// </summary>
public sealed class Board : AuditableEntityBase
{
    public const int NameMaxLength = 150;
    public const int MinimumSwimlanes = 2;

    private readonly List<BoardSwimlane> _swimlanes = new();

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>Controls whether the <c>User</c> role can move ideas on this board.</summary>
    public bool AllowUserStatusUpdate { get; private set; }

    public IReadOnlyList<BoardSwimlane> Swimlanes => _swimlanes;

    private Board()
    {
    }

    /// <summary>
    /// Creates a board with its swimlanes. <paramref name="orderedStatusIds"/> must contain at
    /// least <see cref="MinimumSwimlanes"/> distinct status ids; display order follows the given
    /// sequence.
    /// </summary>
    public static Board Create(
        Guid organizationId,
        string name,
        bool allowUserStatusUpdate,
        IReadOnlyList<Guid> orderedStatusIds,
        DateTime nowUtc,
        Guid? actorUserId = null)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (orderedStatusIds is null || orderedStatusIds.Count < MinimumSwimlanes)
        {
            throw new ArgumentException($"A board must have at least {MinimumSwimlanes} swimlanes.", nameof(orderedStatusIds));
        }

        if (orderedStatusIds.Distinct().Count() != orderedStatusIds.Count)
        {
            throw new ArgumentException("A board cannot list the same status twice.", nameof(orderedStatusIds));
        }

        var board = new Board
        {
            OrganizationId = organizationId,
            Name = name.Trim(),
            AllowUserStatusUpdate = allowUserStatusUpdate
        };

        board.SetSwimlanes(orderedStatusIds);
        board.MarkCreated(nowUtc, actorUserId);
        return board;
    }

    /// <summary>
    /// Updates the board name, the User-role move permission, and the set/order of swimlanes
    /// (SPEC/30-Contracts.md <c>PUT /boards/{id}</c>). <paramref name="orderedStatusIds"/> may add
    /// or remove statuses relative to the current swimlanes but must keep at least
    /// <see cref="MinimumSwimlanes"/> distinct statuses (rule #3, T022) and may only draw from the
    /// organization's statuses (subset support, T023 — validated by the Application layer).
    /// </summary>
    public void Update(
        string name,
        bool allowUserStatusUpdate,
        IReadOnlyList<Guid> orderedStatusIds,
        DateTime nowUtc,
        Guid? actorUserId = null)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        ValidateSwimlaneStatusIds(orderedStatusIds);

        Name = name.Trim();
        AllowUserStatusUpdate = allowUserStatusUpdate;
        SetSwimlanes(orderedStatusIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Reorders the board's existing swimlanes in place (rule #6, T024 — persisted immediately after
    /// drag-and-drop). Unlike <see cref="Update"/> this never adds or removes a swimlane:
    /// <paramref name="orderedStatusIds"/> must be exactly the board's current swimlane statuses.
    /// </summary>
    public void ReorderSwimlanes(IReadOnlyList<Guid> orderedStatusIds, DateTime nowUtc, Guid? actorUserId = null)
    {
        ValidateSwimlaneStatusIds(orderedStatusIds);

        var current = _swimlanes.Select(sl => sl.StatusId).ToHashSet();
        if (orderedStatusIds.Count != current.Count || !orderedStatusIds.All(current.Contains))
        {
            throw new ArgumentException(
                "A reorder must list exactly the board's current swimlane statuses.",
                nameof(orderedStatusIds));
        }

        SetSwimlanes(orderedStatusIds);
        MarkUpdated(nowUtc, actorUserId);
    }

    private static void ValidateSwimlaneStatusIds(IReadOnlyList<Guid> orderedStatusIds)
    {
        if (orderedStatusIds is null || orderedStatusIds.Count < MinimumSwimlanes)
        {
            throw new ArgumentException($"A board must have at least {MinimumSwimlanes} swimlanes.", nameof(orderedStatusIds));
        }

        if (orderedStatusIds.Distinct().Count() != orderedStatusIds.Count)
        {
            throw new ArgumentException("A board cannot list the same status twice.", nameof(orderedStatusIds));
        }
    }

    /// <summary>
    /// Reconciles the swimlane collection to <paramref name="orderedStatusIds"/>: drops swimlanes no
    /// longer selected, keeps and renumbers those retained, and appends newly selected statuses.
    /// Existing rows are preserved where the status is retained so a reorder is a pure position update.
    /// </summary>
    private void SetSwimlanes(IReadOnlyList<Guid> orderedStatusIds)
    {
        _swimlanes.RemoveAll(sl => !orderedStatusIds.Contains(sl.StatusId));

        for (var order = 0; order < orderedStatusIds.Count; order++)
        {
            var statusId = orderedStatusIds[order];
            var existing = _swimlanes.FirstOrDefault(sl => sl.StatusId == statusId);
            if (existing is null)
            {
                _swimlanes.Add(new BoardSwimlane(Id, statusId, order));
            }
            else
            {
                existing.SetDisplayOrder(order);
            }
        }
    }
}
