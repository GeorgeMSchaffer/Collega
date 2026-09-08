using Collega.Application.Ai;
using Collega.Infrastructure.Ai;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// The factory's environment refusal is the last line of defence for the arbitrary-system-prompt
/// capability, so it is asserted directly rather than only through the routing gate above it.
/// </summary>
/// <remarks>
/// Hermetic: constructing an <see cref="AnthropicIdeaDraftModel"/> opens no connection and issues no
/// request — with a blank key it does not even build a client.
/// </remarks>
public class AnthropicIdeaDraftModelFactoryTests
{
    private static AnthropicIdeaDraftModelFactory Factory(bool isDevelopment, string? apiKey = null) =>
        new(new AiUsageLimits(), new AiCredentials { ApiKey = apiKey }, isDevelopment);

    [Theory]
    [InlineData(null)]
    [InlineData("test-key")]
    public void OutsideDevelopment_ItRefuses(string? apiKey)
    {
        var factory = Factory(isDevelopment: false, apiKey);

        var exception = Assert.Throws<InvalidOperationException>(
            () => factory.CreateWithSystemPrompt("You are a helpful assistant."));

        Assert.Contains("Development-only", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void InDevelopment_ItBuildsAModel()
    {
        var model = Factory(isDevelopment: true, apiKey: "test-key")
            .CreateWithSystemPrompt("You are a helpful assistant.");

        Assert.True(model.IsConfigured);
    }

    /// <summary>
    /// An absent key stays a supported state here as it is everywhere else — the feature runs dark
    /// rather than the factory failing, so the tooling above it degrades the same way the product does.
    /// </summary>
    [Fact]
    public void InDevelopmentWithNoKey_TheModelIsUnconfiguredRatherThanAFailure()
    {
        var model = Factory(isDevelopment: true, apiKey: null)
            .CreateWithSystemPrompt("You are a helpful assistant.");

        Assert.False(model.IsConfigured);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void InDevelopment_ABlankPromptIsRejected(string systemPrompt)
    {
        var factory = Factory(isDevelopment: true, apiKey: "test-key");

        Assert.Throws<ArgumentException>(() => factory.CreateWithSystemPrompt(systemPrompt));
    }

    [Fact]
    public void InDevelopment_ANullPromptIsRejected()
    {
        var factory = Factory(isDevelopment: true, apiKey: "test-key");

        Assert.Throws<ArgumentNullException>(() => factory.CreateWithSystemPrompt(null!));
    }

    /// <summary>
    /// Each call yields its own model. The factory is a singleton only so the transport is shared;
    /// returning a cached instance would make two concurrent previews share one prompt.
    /// </summary>
    [Fact]
    public void EachCallReturnsItsOwnModel()
    {
        var factory = Factory(isDevelopment: true, apiKey: "test-key");

        Assert.NotSame(factory.CreateWithSystemPrompt("first"), factory.CreateWithSystemPrompt("second"));
    }
}
