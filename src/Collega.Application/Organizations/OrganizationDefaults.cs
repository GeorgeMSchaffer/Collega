namespace Collega.Application.Organizations;

/// <summary>
/// Canonical defaults provisioned for every new organization
/// (SPEC/20-feature-boards-and-statuses.md "Status Rules" #3-4, "Board Rules" #4).
/// </summary>
public static class OrganizationDefaults
{
    public const string DefaultBoardName = "Ideas";

    /// <summary>
    /// The 5 canonical default statuses in catalog order. Default <c>Color</c>/<c>SortOrder</c>
    /// values are a spec open item (SPEC/60-spec-q-and-a-backlog.md "Remaining MVP Clarifications");
    /// these colors match the locked design comps recorded in the implementation tracker
    /// (New/Pending slate, In Review amber, In Progress blue, Client Review purple, Complete green)
    /// and are the working default until that item is formally resolved.
    /// </summary>
    public static readonly IReadOnlyList<DefaultStatus> Statuses = new[]
    {
        new DefaultStatus("New / Pending", "#64748B", 10),
        new DefaultStatus("In Review", "#D97706", 20),
        new DefaultStatus("In Progress", "#2563EB", 30),
        new DefaultStatus("Client Review", "#7C3AED", 40),
        new DefaultStatus("Complete", "#16A34A", 50)
    };
}

public sealed record DefaultStatus(string Name, string Color, int SortOrder);
