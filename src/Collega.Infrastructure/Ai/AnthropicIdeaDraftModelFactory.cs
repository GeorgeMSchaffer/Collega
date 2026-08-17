using Collega.Application.Abstractions;
using Collega.Application.Ai;

namespace Collega.Infrastructure.Ai;

/// <summary>
/// Builds <see cref="AnthropicIdeaDraftModel"/> instances carrying a caller-supplied system prompt,
/// for Development-only prompt tooling. Refuses in every other environment.
/// </summary>
/// <remarks>
/// <para>Registered as a singleton holding one <see cref="HttpClient"/> that every produced model
/// shares. That is the reason this is a factory rather than a <c>new</c> at the call site: passing
/// no client makes the SDK construct its own per instance, and a per-request model would then leak
/// a socket pool per call.</para>
/// <para>The environment is a constructor flag rather than an injected <c>IHostEnvironment</c> so
/// this project keeps no dependency on the hosting abstractions — the same shape as
/// <c>DevelopmentOnlyControllerConvention</c>, and directly testable without a fake environment.</para>
/// <para>The DI-registered singleton <see cref="IIdeaDraftModel"/> is untouched by this and remains
/// what production uses; models built here are never registered.</para>
/// </remarks>
public sealed class AnthropicIdeaDraftModelFactory : IIdeaDraftModelFactory
{
    private readonly AiUsageLimits _limits;
    private readonly AiCredentials _credentials;
    private readonly bool _isDevelopment;
    private readonly HttpClient _httpClient;

    public AnthropicIdeaDraftModelFactory(
        AiUsageLimits limits,
        AiCredentials credentials,
        bool isDevelopment,
        HttpClient? httpClient = null)
    {
        _limits = limits;
        _credentials = credentials;
        _isDevelopment = isDevelopment;
        _httpClient = httpClient ?? new HttpClient();
    }

    public IIdeaDraftModel CreateWithSystemPrompt(string systemPrompt)
    {
        if (!_isDevelopment)
        {
            // Deliberately InvalidOperationException, not an AppException: reaching here is not a
            // request the caller could have made correctly, it is a wiring defect. The routing-level
            // gate should already have made the surface unreachable; this is the backstop that keeps
            // the capability dead even if that gate regresses.
            throw new InvalidOperationException(
                "Arbitrary system prompts are a Development-only capability. "
                + "The idea draft model factory refuses to build one outside Development.");
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(systemPrompt);

        return new AnthropicIdeaDraftModel(_limits, _credentials, _ => systemPrompt, _httpClient);
    }
}
