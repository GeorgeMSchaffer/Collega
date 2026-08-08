namespace Collega.API.Contracts.Boards;

/// <summary>One requested swimlane: the status it maps to and its display position.</summary>
public sealed class SwimlaneRequest
{
    public Guid StatusId { get; set; }

    public int Order { get; set; }
}
