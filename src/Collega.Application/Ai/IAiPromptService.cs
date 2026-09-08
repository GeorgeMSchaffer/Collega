namespace Collega.Application.Ai;

/// <summary>
/// Site-Admin management of the idea-assist prompt (SPEC/20-feature-ai-idea-assist.md rules 34–38).
/// </summary>
/// <remarks>
/// Every method is Site-Admin only. This is deployment configuration, the same scope as the API key in
/// rule 29 — not organization content, so it does not go through View As.
/// </remarks>
public interface IAiPromptService
{
    /// <summary>The active prompt plus the version history. Returns the built-in default when none is published.</summary>
    Task<AiPromptSettings> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>Publishes a new version and makes it active.</summary>
    Task<AiPromptSettings> PublishAsync(PublishAiPromptCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Republishes an earlier version as a <b>new</b> version. History stays append-only, so the restore
    /// is itself visible in it rather than silently reactivating an old row.
    /// </summary>
    Task<AiPromptSettings> RestoreAsync(int version, CancellationToken cancellationToken = default);

    /// <summary>Stands down every version, returning the deployment to the built-in default.</summary>
    Task<AiPromptSettings> ResetToDefaultAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs the advisory safety probes against a draft body (rule 37). Never publishes, and a failing
    /// probe never blocks a later publish — it exists so an admin can see what an edit did to refusal,
    /// which is otherwise invisible until it matters.
    /// </summary>
    Task<AiPromptProbeReport> ProbeAsync(string draftBody, CancellationToken cancellationToken = default);
}
