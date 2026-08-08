using Collega.API.Validation;
using Collega.Domain.Boards;

namespace Collega.API.Contracts.Boards;

/// <summary>Request shape for `PUT /api/v1/boards/{boardId}`.</summary>
public sealed class UpdateBoardRequest
{
    [RequiredField]
    [MaxLengthField(Board.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    public bool AllowUserStatusUpdate { get; set; }

    public IReadOnlyList<SwimlaneRequest> Swimlanes { get; set; } = new List<SwimlaneRequest>();
}
