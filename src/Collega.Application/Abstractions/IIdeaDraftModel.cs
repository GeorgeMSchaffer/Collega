using Collega.Application.Ai;

namespace Collega.Application.Abstractions;

/// <summary>
/// The seam between idea drafting and whichever model provider backs it
/// (SPEC/20-feature-ai-idea-assist.md "Model Configuration"). Implemented in Infrastructure so no
/// vendor type ever appears in Application or Domain.
/// </summary>
public interface IIdeaDraftModel
{
    /// <summary>
    /// Whether a credential is configured. False is a <b>supported state</b>, not an error: the
    /// product must work with the feature dark (rule 31), so callers answer 503 and the client
    /// falls back to the scripted brainstorm rather than surfacing a failure.
    /// </summary>
    bool IsConfigured { get; }

    /// <summary>
    /// Advances the conversation by one turn.
    /// </summary>
    /// <param name="context">
    /// Retrieval assembled server-side from the caller's organization. The implementation builds the
    /// response schema's closed enums from this, which is what makes an out-of-org classification
    /// structurally impossible rather than merely discouraged (rule 16).
    /// </param>
    /// <returns>
    /// The model's raw answer — <b>untrusted</b>. The caller re-validates every returned id against
    /// <paramref name="context"/> before any of it reaches a client.
    /// </returns>
    /// <exception cref="IdeaDraftModelException">
    /// The provider failed, timed out, or returned something unusable. Callers degrade for that turn
    /// rather than propagating an error (rule 32).
    /// </exception>
    Task<IdeaDraftModelResponse> ContinueAsync(
        IdeaAssistContext context,
        IReadOnlyList<IdeaAssistTurn> transcript,
        IdeaDraft currentDraft,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// A model call that could not produce a usable answer. Carries no provider detail worth showing a
/// user — the degradation path is the same whatever went wrong.
/// </summary>
public sealed class IdeaDraftModelException : Exception
{
    public IdeaDraftModelException(string message, Exception? innerException = null)
        : base(message, innerException)
    {
    }
}
