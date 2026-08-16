namespace Collega.Domain.Ai;

/// <summary>
/// Which credential paid for a model call. v1 has only the shared deployment key; the enum exists so
/// that when per-org keys land (SPEC/20-feature-ai-idea-assist.md rule 30) historical rows already
/// say which pool they came out of.
/// </summary>
public enum AiKeySource
{
    /// <summary>The single deployment-level key shared by every organization (rule 29).</summary>
    Platform = 0,

    /// <summary>An organization's own key. Not reachable in v1 — rule 30 defers per-org keys.</summary>
    Organization = 1,
}
