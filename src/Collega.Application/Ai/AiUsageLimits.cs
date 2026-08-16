namespace Collega.Application.Ai;

/// <summary>
/// Cost controls for AI idea assist (SPEC/20-feature-ai-idea-assist.md rules 28a–28b). Bound from
/// configuration in <c>AddInfrastructure</c> — rule 26 requires limits be configuration, never
/// hard-coded — following the same plain-options pattern as <c>AccessTokenOptions</c>.
/// </summary>
public sealed class AiUsageLimits
{
    /// <summary>
    /// Ceiling on total tokens consumed across <b>all</b> organizations in one UTC day. One shared
    /// pool, not a per-org allowance.
    /// </summary>
    /// <remarks>
    /// This is a runaway stop, not a budget forecast (rule 28b). Saturated every day at a typical
    /// input/output mix, the default of 500,000 would allow roughly $99/month on Sonnet 5 — well
    /// above the $50 the feature is aiming at. It exists so a defect or an abusive user cannot run
    /// up an unbounded bill; holding a monthly figure is the usage surface's job, not the cap's.
    /// </remarks>
    public long DailyTokenLimit { get; init; } = 500_000;

    /// <summary>The model id passed to the provider. Configuration so the tier can be re-tested without a code change.</summary>
    public string Model { get; init; } = "claude-sonnet-5";

    /// <summary>
    /// Reasoning effort. Starts at <c>low</c>: effort defaults to <c>high</c>, and thinking bills as
    /// output at five times the input rate, so this is the largest single cost lever available.
    /// </summary>
    public string Effort { get; init; } = "low";

    /// <summary>USD per million input tokens, as published for <see cref="Model"/>.</summary>
    public decimal InputRatePerMillion { get; init; } = 3.00m;

    /// <summary>USD per million output tokens. Thinking tokens bill here too.</summary>
    public decimal OutputRatePerMillion { get; init; } = 15.00m;

    /// <summary>
    /// Whether a ceiling is in force at all. A non-positive limit disables the gate — useful for a
    /// local environment, never intended for a deployment.
    /// </summary>
    public bool IsEnforced => DailyTokenLimit > 0;
}
