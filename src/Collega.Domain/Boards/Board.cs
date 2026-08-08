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

        for (var order = 0; order < orderedStatusIds.Count; order++)
        {
            board._swimlanes.Add(new BoardSwimlane(board.Id, orderedStatusIds[order], order));
        }

        board.MarkCreated(nowUtc, actorUserId);
        return board;
    }
}
