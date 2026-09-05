namespace Collega.Application.Ai;

/// <summary>What the Site-Admin settings surface reads back (contract `GET /ai-assist/prompt`).</summary>
/// <param name="IsBuiltInDefault">
/// True when nothing is published and the compiled default is in force. Distinct from
/// <paramref name="Version"/> being null only in intent — the flag is what the UI keys its
/// "reset to default" affordance off, so it is stated rather than inferred.
/// </param>
public sealed record AiPromptSettings(
    string Body,
    string OutOfScopeRedirect,
    string ConversationClosedRedirect,
    int? Version,
    bool IsBuiltInDefault,
    IReadOnlyList<AiPromptVersionSummary> Versions);

/// <summary>One row in the version history. Carries no body — the list is for choosing, not reading.</summary>
public sealed record AiPromptVersionSummary(
    int Version,
    DateTime CreatedAtUtc,
    Guid? CreatedByUserId,
    string? CreatedByDisplayName,
    bool IsActive);

/// <summary>A publish request.</summary>
public sealed record PublishAiPromptCommand(
    string Body,
    string OutOfScopeRedirect,
    string ConversationClosedRedirect);

/// <summary>
/// One advisory safety probe result (rule 37). <paramref name="ExpectedRefused"/> is always true today —
/// every probe is an attack or an off-topic message — but it is returned rather than assumed so the UI
/// renders outcomes without encoding that assumption, and so an in-scope control probe can be added later.
/// </summary>
public sealed record AiPromptProbeResult(
    string Id,
    string Prompt,
    bool Refused,
    bool ExpectedRefused);

/// <summary>The full probe run.</summary>
public sealed record AiPromptProbeReport(
    IReadOnlyList<AiPromptProbeResult> Probes)
{
    public int RefusedCount => Probes.Count(p => p.Refused);

    public int TotalCount => Probes.Count;
}
