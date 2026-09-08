using Collega.Domain.Ai;

namespace Collega.Domain.Tests;

/// <summary>
/// Invariants for a published prompt version (SPEC/20-feature-ai-idea-assist.md rules 34–36).
/// </summary>
public sealed class AiPromptVersionTests
{
    private static readonly DateTime Now = new(2026, 8, 17, 12, 0, 0, DateTimeKind.Utc);

    private const string ValidBody =
        "Draft ideas.\n\n{{SCOPE_STATEMENT}}\n\n{{ORGANIZATION_CATALOG}}\n";

    private static AiPromptVersion Publish(
        string body = ValidBody,
        string outOfScope = "Only ideas, please.",
        string closed = "Let's continue on the form.") =>
        AiPromptVersion.Publish(1, body, outOfScope, closed, Now, Guid.NewGuid());

    [Fact]
    public void Publish_SetsTheVersionActive()
    {
        var version = Publish();

        Assert.True(version.IsActive);
        Assert.Equal(1, version.Version);
        Assert.Equal(Now, version.CreatedAtUtc);
    }

    /// <summary>
    /// The invariant that keeps the catalog reachable at all. Enforced on the entity rather than only at
    /// the API edge so every write path — publish, restore, anything added later — shares one rule.
    /// </summary>
    [Fact]
    public void Publish_RejectsABodyWithoutTheCatalogPlaceholder()
    {
        var body = ValidBody.Replace(AiPromptVersion.OrganizationCatalogPlaceholder, "the catalog");

        var ex = Assert.Throws<ArgumentException>(() => Publish(body));
        Assert.Contains(AiPromptVersion.OrganizationCatalogPlaceholder, ex.Message);
    }

    /// <summary>
    /// Without this placeholder every organization's scope statement would be dropped silently — no
    /// error, no log line, just a boundary that stopped applying. That is why it is required rather
    /// than optional-but-recommended.
    /// </summary>
    [Fact]
    public void Publish_RejectsABodyWithoutTheScopePlaceholder()
    {
        var body = ValidBody.Replace(AiPromptVersion.ScopeStatementPlaceholder, string.Empty);

        var ex = Assert.Throws<ArgumentException>(() => Publish(body));
        Assert.Contains(AiPromptVersion.ScopeStatementPlaceholder, ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Publish_RejectsAnEmptyBody(string body) =>
        Assert.Throws<ArgumentException>(() => Publish(body));

    [Fact]
    public void Publish_RejectsABodyOverTheCap()
    {
        var body = ValidBody + new string('x', AiPromptVersion.BodyMaxLength);

        Assert.Throws<ArgumentException>(() => Publish(body));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Publish_RejectsAnEmptyRedirect(string redirect)
    {
        Assert.Throws<ArgumentException>(() => Publish(outOfScope: redirect));
        Assert.Throws<ArgumentException>(() => Publish(closed: redirect));
    }

    [Fact]
    public void Publish_RejectsARedirectOverTheCap()
    {
        var redirect = new string('x', AiPromptVersion.RedirectMaxLength + 1);

        Assert.Throws<ArgumentException>(() => Publish(outOfScope: redirect));
    }

    [Fact]
    public void Publish_TrimsStoredText()
    {
        var version = Publish(outOfScope: "  Only ideas.  ");

        Assert.Equal("Only ideas.", version.OutOfScopeRedirect);
    }

    [Fact]
    public void Deactivate_StandsTheVersionDown()
    {
        var version = Publish();

        version.Deactivate();

        Assert.False(version.IsActive);
    }
}
