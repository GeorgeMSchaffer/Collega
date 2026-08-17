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
    /// The 5 canonical default statuses in catalog order, with the <c>Color</c>/<c>SortOrder</c>
    /// values ratified in SPEC/20-feature-boards-and-statuses.md "Status Rules" #4
    /// (New/Pending slate, In Review amber, In Progress blue, Client Review purple, Complete green).
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
    /// Canonical default Business Impacts provisioned for every new organization, **most severe first**
    /// (user decision 2026-08-17).
    /// </summary>
    /// <remarks>
    /// Unlike <see cref="IdeaTypes"/> and <see cref="Statuses"/>, the first option here is <b>not</b> the
    /// default for a new idea — <see cref="DefaultBusinessImpactName"/> is. Reversing this list without
    /// that decoupling would have pre-marked every new idea <c>Critical</c>, inflating reported severity
    /// through a default nobody chose. Colors stay bound to meaning, not to position: red is Critical
    /// wherever it sits.
    /// </remarks>
    public static readonly IReadOnlyList<DefaultBusinessImpact> BusinessImpacts = new[]
    {
        new DefaultBusinessImpact("Critical", "#DC2626", 10),
        new DefaultBusinessImpact("High", "#D97706", 20),
        new DefaultBusinessImpact("Medium", "#2563EB", 30),
        new DefaultBusinessImpact("Low", "#16A34A", 40)
    };

    /// <summary>
    /// The Business Impact pre-selected on a new idea, matched by name. Mirrors <c>Priority</c>, which
    /// already hard-defaults to Medium rather than to first-in-list. Callers fall back to the first
    /// active option when an organization has renamed or removed this one.
    /// </summary>
    public const string DefaultBusinessImpactName = "Medium";
}

public sealed record DefaultStatus(string Name, string Color, int SortOrder);

public sealed record DefaultIdeaType(string Name, int SortOrder);

public sealed record DefaultBusinessImpact(string Name, string Color, int SortOrder);
