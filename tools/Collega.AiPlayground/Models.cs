using System.Text.Json.Serialization;

namespace Collega.AiPlayground;

/// <summary>
/// A synthetic organization catalog, deserialized from <c>fixtures/*.json</c> and turned into a real
/// <see cref="Collega.Application.Ai.IdeaAssistContext"/>.
/// </summary>
/// <remarks>
/// Synthetic on purpose. The harness never opens a database, so a run is reproducible, needs no
/// container, and cannot be pointed at a real organization's data by accident.
/// </remarks>
public sealed class FixtureFile
{
    public string Name { get; set; } = "";
    public string OrganizationName { get; set; } = "";

    /// <summary>Null or empty means "no narrowing beyond Idea Types" — the demo seed's state.</summary>
    public string? ScopeStatement { get; set; }

    public List<FixtureOption> IdeaTypes { get; set; } = new();
    public List<FixtureOption> BusinessImpacts { get; set; } = new();
    public List<string> Statuses { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public List<string> MemberNames { get; set; } = new();
}

/// <summary>
/// One catalog option. <see cref="Id"/> is optional: when omitted the loader derives a stable GUID
/// from the name, so a fixture stays readable and its ids never churn between runs.
/// </summary>
public sealed class FixtureOption
{
    public string Name { get; set; } = "";
    public Guid? Id { get; set; }
    public List<string>? FieldNames { get; set; }
}

/// <summary>One eval case, deserialized from <c>cases/*.json</c>.</summary>
public sealed class CaseFile
{
    public string Id { get; set; } = "";
    public string Fixture { get; set; } = "";

    /// <summary>
    /// Scripted user turns, oldest first. The runner feeds them in order, appending the model's
    /// <c>nextQuestion</c> as the assistant turn between them, and scores against the final response.
    /// </summary>
    public List<string> Turns { get; set; } = new();

    public CaseExpectation Expect { get; set; } = new();

    /// <summary>Optional free text explaining why the case exists. Printed on failure.</summary>
    public string? Note { get; set; }
}

/// <summary>
/// What the final turn should produce. Every member is optional and only declared dimensions are
/// scored, so a refusal case asserts <c>inScope: false</c> and nothing else — a refused turn returns
/// the draft unchanged, so scoring classification on it would be meaningless.
/// </summary>
public sealed class CaseExpectation
{
    public bool? InScope { get; set; }

    /// <summary>Idea type <b>by name</b>; resolved against the fixture. Keeps cases readable.</summary>
    public string? IdeaType { get; set; }

    public string? BusinessImpact { get; set; }
    public string? Priority { get; set; }
    public bool? TitleSet { get; set; }
    public bool? DescriptionSet { get; set; }
}

/// <summary>The five scoreable dimensions. Kept separate so a regression can be localized.</summary>
public enum Dimension
{
    Scope,
    IdeaType,
    BusinessImpact,
    Priority,
    Fields,
}

/// <summary>One dimension's outcome on one attempt.</summary>
public sealed record DimensionResult(Dimension Dimension, bool Passed, string? Detail = null);

/// <summary>One attempt at one case: the scored dimensions plus what it cost.</summary>
public sealed record AttemptResult(
    string CaseId,
    int Attempt,
    bool Errored,
    string? Error,
    IReadOnlyList<DimensionResult> Dimensions,
    int InputTokens,
    int OutputTokens,
    int CacheReadTokens,
    int CacheCreationTokens,
    int Turns,
    string? NextQuestion)
{
    [JsonIgnore]
    public bool Passed => !Errored && Dimensions.All(d => d.Passed);
}

/// <summary>
/// A whole sweep, written to <c>--json</c> so two runs can be compared. <see cref="PromptLabel"/>
/// records which prompt produced it, because a result file with no provenance is not evidence.
/// </summary>
public sealed record RunReport(
    string PromptLabel,
    string Model,
    string Effort,
    int Repeat,
    IReadOnlyList<AttemptResult> Attempts)
{
    public decimal CostUsd(decimal inputRate, decimal outputRate) =>
        Attempts.Sum(a => (a.InputTokens / 1_000_000m * inputRate)
                        + (a.OutputTokens / 1_000_000m * outputRate));
}
