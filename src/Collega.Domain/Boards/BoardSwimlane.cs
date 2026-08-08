using Collega.Domain.Common;

namespace Collega.Domain.Boards;

/// <summary>
/// Ordered mapping of a board to one of its organization's statuses
/// (SPEC/20-feature-boards-and-statuses.md "Board Rules" #2). A board's swimlane order is
/// independent of the organization-level status catalog order.
/// </summary>
public sealed class BoardSwimlane : EntityBase
{
    public Guid BoardId { get; private set; }
    public Guid StatusId { get; private set; }
    public int DisplayOrder { get; private set; }

    private BoardSwimlane()
    {
    }

    internal BoardSwimlane(Guid boardId, Guid statusId, int displayOrder)
    {
        StatusId = statusId;
        DisplayOrder = displayOrder;
        BoardId = boardId;
    }
}
