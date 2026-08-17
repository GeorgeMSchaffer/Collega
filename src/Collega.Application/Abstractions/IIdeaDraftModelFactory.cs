using Collega.Application.Ai;

namespace Collega.Application.Abstractions;

/// <summary>
/// Builds a draft model whose system prompt is fixed to a caller-supplied string, for developer
/// tooling that needs to see how a prompt edit changes the model's behaviour.
/// </summary>
/// <remarks>
/// <para><b>Development only.</b> Implementations must refuse outside the Development environment.
/// The ability to hand the model an arbitrary system prompt is the whole capability the product
/// deliberately withholds — the prompt carries the injection fence and is the cached stable prefix,
/// so in production it comes from code and configuration and nowhere else.</para>
/// <para>This is a separate factory rather than a parameter on
/// <see cref="IIdeaDraftModel.ContinueAsync"/> precisely so the production seam stays narrow: no
/// caller of the registered <see cref="IIdeaDraftModel"/> can steer the model, which is the
/// property the schema-based containment rules depend on.</para>
/// </remarks>
public interface IIdeaDraftModelFactory
{
    /// <summary>
    /// A draft model that sends <paramref name="systemPrompt"/> verbatim, ignoring the compiled
    /// prompt builder.
    /// </summary>
    /// <exception cref="InvalidOperationException">The host is not running in Development.</exception>
    IIdeaDraftModel CreateWithSystemPrompt(string systemPrompt);
}
