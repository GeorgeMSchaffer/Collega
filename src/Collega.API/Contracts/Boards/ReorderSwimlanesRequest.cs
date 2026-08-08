namespace Collega.API.Contracts.Boards;

/// <summary>Request shape for `POST /api/v1/boards/{boardId}/swimlanes/reorder`.</summary>
public sealed class ReorderSwimlanesRequest
{
    public IReadOnlyList<SwimlaneRequest> Swimlanes { get; set; } = new List<SwimlaneRequest>();
}
