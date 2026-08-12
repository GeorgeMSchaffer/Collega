using System.Net;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Epic 1 QA baseline: "baseline smoke checks for boot and error envelope behavior"
/// (SPEC/archive/70-delivery-backlog.md, Epic 1). These are integration-style smoke tests
/// against the real in-memory host (see <see cref="CollegaApiFactory"/>), not unit
/// tests — booting a real ASP.NET Core pipeline is the point, so hermeticity here
/// means "no external network/database", not "no host".
/// </summary>
public sealed class SmokeTests : IClassFixture<CollegaApiFactory>
{
    private readonly CollegaApiFactory _factory;

    public SmokeTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// GREEN today. Confirms the host can be built and started and will serve an
    /// HTTP request without throwing. This exercises exactly the "the API starts
    /// successfully" exit criterion for Epic 1 in SPEC/archive/70-delivery-backlog.md.
    /// </summary>
    [Fact]
    public async Task Application_Boots_And_Responds_To_Requests()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        // If the host failed to build/start, this call throws before we ever see a response.
        using var response = await client.GetAsync("/");

        // Assert
        Assert.NotNull(response);
        Assert.NotEqual(HttpStatusCode.InternalServerError, response.StatusCode);
    }

    /// <summary>
    /// EXPECTED RED until the Backend Developer's Epic 1 branch (T003: shared
    /// /api/v1 routing conventions and problem-details error handling) merges into
    /// dev. Today src/Collega.API/Program.cs is the bare `dotnet new webapi
    /// --use-controllers` template with no custom error handling, no controllers,
    /// and no problem-details middleware, so an unmatched route falls through to
    /// the framework's default empty 404 (no body, no content-type) rather than
    /// the contract's problem-details envelope.
    ///
    /// Per SPEC/30-Contracts.md ("Error Envelope"): "All non-2xx responses use a
    /// problem-details-style payload" with fields type/title/status/detail/instance.
    /// This test targets a route that cannot exist under any routing convention, so
    /// it exercises that "ALL" as broadly as possible without depending on any
    /// specific endpoint Backend has not built yet.
    ///
    /// Reviewer note / open risk: "all non-2xx responses" is broad enough to cover
    /// framework-level 404s for completely unrouted paths (this test's scenario),
    /// but a problem-details implementation is commonly wired only through
    /// UseExceptionHandler plus explicit Problem()/ValidationProblem() results in
    /// controllers -- which does NOT automatically catch a 404 for a path that
    /// matched no endpoint at all. That additionally requires something like
    /// UseStatusCodePagesWithReExecute (or equivalent) in the pipeline. If Backend's
    /// T003 only covers the exception/explicit-result path, this specific test will
    /// still be red after their branch merges -- that would be a real gap between
    /// the contract's "ALL non-2xx responses" wording and the implementation, not a
    /// flaw in this test, and should be raised with Backend Developer rather than
    /// "fixed" by narrowing this assertion.
    /// </summary>
    [Fact]
    public async Task NonSuccessResponse_UsesProblemDetailsEnvelope()
    {
        // Arrange
        using var client = _factory.CreateClient();

        // Act
        using var response = await client.GetAsync("/__smoke__/route-that-will-never-exist");

        // Assert
        Assert.False(response.IsSuccessStatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        Assert.True(root.TryGetProperty("type", out _), "problem-details envelope is missing 'type'.");
        Assert.True(root.TryGetProperty("title", out _), "problem-details envelope is missing 'title'.");
        Assert.True(root.TryGetProperty("status", out _), "problem-details envelope is missing 'status'.");
        Assert.True(root.TryGetProperty("detail", out _), "problem-details envelope is missing 'detail'.");
        Assert.True(root.TryGetProperty("instance", out _), "problem-details envelope is missing 'instance'.");
    }
}
