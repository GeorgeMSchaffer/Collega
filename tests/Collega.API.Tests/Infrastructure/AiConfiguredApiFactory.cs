using Collega.Application.Abstractions;
using Collega.Application.Ai;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.API.Tests.Infrastructure;

/// <summary>
/// A host whose AI assist is <b>configured</b>, backed by a stub that answers without a network call.
/// </summary>
/// <remarks>
/// <para>The default <see cref="CollegaApiFactory"/> deliberately runs with the feature dark, which is
/// the right default — it proves the degradation contract and keeps every other test off a provider.
/// But it makes the paths *behind* availability unreachable: with no key, a turn 503s before the rate
/// limiter is consulted and before any usage record is written, so a limit measured from those records
/// can never accumulate.</para>
///
/// <para>This factory exists for exactly those paths. It still never reaches Anthropic — the stub is
/// local and deterministic.</para>
/// </remarks>
public sealed class AiConfiguredApiFactory : CollegaApiFactory
{
    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);

        builder.ConfigureServices(services =>
        {
            var existing = services.SingleOrDefault(d => d.ServiceType == typeof(IIdeaDraftModel));
            if (existing is not null)
            {
                services.Remove(existing);
            }

            services.AddSingleton<IIdeaDraftModel, StubIdeaDraftModel>();
        });
    }
}

/// <summary>
/// A configured model that answers locally. Token counts are non-zero so metering has something real
/// to record, which is what the rate limiter and the budget gate both read.
/// </summary>
internal sealed class StubIdeaDraftModel : IIdeaDraftModel
{
    public bool IsConfigured => true;

    public Task<IdeaDraftModelResponse> ContinueAsync(
        IdeaAssistContext context,
        IReadOnlyList<IdeaAssistTurn> transcript,
        IdeaDraft currentDraft,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new IdeaDraftModelResponse(
            InScope: true,
            "What problem does this solve, and who feels it most?",
            currentDraft,
            InputTokens: 120,
            OutputTokens: 40));
}
