namespace Collega.API.Contracts.Ideas;

/// <summary>Request shape for `POST /api/v1/ideas/{ideaId}/status`.</summary>
public sealed class ChangeIdeaStatusRequest
{
    /// <summary>Target status; validated as an active swimlane on the idea's board.</summary>
    public Guid StatusId { get; set; }
}
