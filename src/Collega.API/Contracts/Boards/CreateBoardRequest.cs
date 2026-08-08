using Collega.API.Validation;
using Collega.Domain.Boards;

namespace Collega.API.Contracts.Boards;

/// <summary>Request shape for `POST /api/v1/organizations/{organizationId}/boards`. The 2-swimlane
/// minimum and status-subset validation are enforced by the Application layer.</summary>
public sealed class CreateBoardRequest
{
    [RequiredField]
    [MaxLengthField(Board.NameMaxLength)]
    public string Name { get; set; } = string.Empty;

    public bool AllowUserStatusUpdate { get; set; }

    public IReadOnlyList<SwimlaneRequest> Swimlanes { get; set; } = new List<SwimlaneRequest>();
}
