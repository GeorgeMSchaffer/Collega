namespace Collega.Application.Ai;

/// <summary>
/// AI-assisted idea drafting (SPEC/20-feature-ai-idea-assist.md). Never a write path: it returns
/// suggestions that seed the create form, which is submitted and validated separately.
/// </summary>
public interface IIdeaAssistService
{
    /// <summary>
    /// Advances the conversation by one turn.
    /// </summary>
    /// <exception cref="AiAssistUnavailableException">
    /// Unconfigured, provider unavailable, or the daily token budget is exhausted. The three are
    /// deliberately indistinguishable — all mean "keep working without the assistant".
    /// </exception>
    Task<IdeaAssistTurnResult> ContinueAsync(
        IdeaAssistTurnRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Whether a drafting turn would be attempted right now: a key is configured and the deployment is
    /// within its daily token budget (rule 32a). Deliberately a bare bool — the caller must not be able
    /// to tell unconfigured from budget-exhausted, for the same reason <c>ContinueAsync</c> collapses
    /// both into one exception.
    /// </summary>
    /// <remarks>
    /// A snapshot, not a guarantee. The budget can be exhausted between this call and the next turn, so
    /// a client that uses this must still handle <see cref="AiAssistUnavailableException"/> (rule 32b).
    /// </remarks>
    Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default);

    /// <summary>Reads an organization's AI assist configuration. Never returns a key.</summary>
    Task<AiAssistSettings> GetSettingsAsync(Guid organizationId, CancellationToken cancellationToken = default);

    /// <summary>Sets or clears the organization's scope statement. Null or empty clears it.</summary>
    Task<AiAssistSettings> SetScopeStatementAsync(
        Guid organizationId,
        string? scopeStatement,
        CancellationToken cancellationToken = default);
}
