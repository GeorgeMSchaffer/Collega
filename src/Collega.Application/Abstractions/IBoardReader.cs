namespace Collega.Application.Abstractions;

/// <summary>
/// Read-only access to board, swimlane, and status data that the Collaboration slice needs when
/// creating and moving ideas. Kept separate from <see cref="IBoardRepository"/>/<see
/// cref="IStatusRepository"/> — which the Workflow Configuration slice owns and mutates — so the two
/// slices can evolve in parallel without colliding on shared abstractions.
/// </summary>
public interface IBoardReader
{
    /// <summary>Loads a board's swimlane layout and settings, or null if it does not exist.</summary>
    Task<BoardContext?> GetBoardContextAsync(Guid boardId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Status id -> display info for every status in an organization, including soft-deleted ones so
    /// historical references still render their prior name with an archived indicator
    /// (SPEC/20-feature-boards-and-statuses.md "Status Rules" #8).
    /// </summary>
    Task<IReadOnlyDictionary<Guid, StatusInfo>> GetStatusInfoAsync(Guid organizationId, CancellationToken cancellationToken = default);
}

/// <summary>A board with just the fields idea use cases need for scoping and status placement.</summary>
public sealed record BoardContext(
    Guid BoardId,
    Guid OrganizationId,
    string Name,
    bool AllowUserStatusUpdate,
    IReadOnlyList<SwimlaneInfo> Swimlanes)
{
    /// <summary>The left-most swimlane's status — the default for new ideas (rule #27).</summary>
    public Guid? LeftMostStatusId => Swimlanes.Count == 0
        ? null
        : Swimlanes.OrderBy(s => s.DisplayOrder).First().StatusId;

    public bool HasSwimlaneForStatus(Guid statusId) => Swimlanes.Any(s => s.StatusId == statusId);
}

public sealed record SwimlaneInfo(Guid StatusId, int DisplayOrder);

public sealed record StatusInfo(Guid StatusId, string Name, string Color, bool IsDeleted);
