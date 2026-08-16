namespace Collega.Domain.Ai;

/// <summary>
/// How a model call ended. All three outcomes consume tokens and all three are metered — a budget
/// that counted only successful turns would not bound spend.
/// </summary>
public enum AiCallOutcome
{
    /// <summary>The turn produced a usable draft response.</summary>
    Succeeded = 0,

    /// <summary>The turn was judged out of scope and returned the fixed redirect (rule 8).</summary>
    Refused = 1,

    /// <summary>
    /// The provider timed out, rate-limited, or returned something unparseable, and the turn
    /// degraded to scripted behavior (rule 32). Tokens may still have been billed.
    /// </summary>
    Failed = 2,
}
