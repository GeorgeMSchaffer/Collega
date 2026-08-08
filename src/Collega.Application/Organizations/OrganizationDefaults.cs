namespace Collega.Application.Organizations;

/// <summary>
/// Canonical defaults provisioned for every new organization
/// (SPEC/20-feature-boards-and-statuses.md "Status Rules" #3-4, "Board Rules" #4).
/// </summary>
public static class OrganizationDefaults
{
    public const string DefaultBoardName = "Ideas";

    /// <summary>
    /// Fallback color applied to a custom status created without an explicit color. Matches the
    /// slate used for the "New / Pending" default (SPEC/20-feature-boards-and-statuses.md rule #9).
    /// </summary>
    public const string DefaultStatusColor = "#64748B";

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

    /// <summary>
    /// Canonical default Idea Types provisioned for every new organization
    /// (SPEC/50-technical-implementation-plan.md Phase 4 #9). The first by sort order is the default.
    /// </summary>
    public static readonly IReadOnlyList<DefaultIdeaType> IdeaTypes = new[]
    {
        new DefaultIdeaType("Continuous Improvement", 10),
        new DefaultIdeaType("Process Revision", 20)
    };

    /// <summary>
    /// Canonical default Business Impacts provisioned for every new organization. The first by sort
    /// order is the default. Colors follow a low→critical green/blue/amber/red progression.
    /// </summary>
    public static readonly IReadOnlyList<DefaultBusinessImpact> BusinessImpacts = new[]
    {
        new DefaultBusinessImpact("Low", "#16A34A", 10),
        new DefaultBusinessImpact("Medium", "#2563EB", 20),
        new DefaultBusinessImpact("High", "#D97706", 30),
        new DefaultBusinessImpact("Critical", "#DC2626", 40)
    };
}

public sealed record DefaultStatus(string Name, string Color, int SortOrder);

public sealed record DefaultIdeaType(string Name, int SortOrder);

public sealed record DefaultBusinessImpact(string Name, string Color, int SortOrder);
