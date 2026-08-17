using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// The Site-Admin prompt endpoints (SPEC/30-Contracts.md → <c>/ai-assist/prompt</c>;
/// SPEC/20-feature-ai-idea-assist.md rules 34–38).
/// </summary>
public sealed class AiPromptTests : IClassFixture<CollegaApiFactory>
{
    private const string ValidBody =
        "Draft ideas for this organization.\n\n{{SCOPE_STATEMENT}}\n\n{{ORGANIZATION_CATALOG}}\n";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public AiPromptTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    private static object PublishBody(string body = ValidBody) => new
    {
        body,
        outOfScopeRedirect = "Only ideas, please.",
        conversationClosedRedirect = "Let's continue on the form.",
    };

    [Fact]
    public async Task Get_IsUnauthorized_ForAnonymousCallers()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/ai-assist/prompt");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// The prompt is deployment configuration, so unlike the org-scoped scope statement an Org Admin
    /// owns (rule 6), no organization role reaches it.
    /// </summary>
    [Theory]
    [InlineData("OrgAdmin")]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task Prompt_IsForbidden_ForEveryOrganizationRole(string role)
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, $"Prompt {role} Robotics");
        using var member = await CreateMemberClientAsync(client, org.OrganizationId, role);

        var read = await member.GetAsync("/api/v1/ai-assist/prompt");
        var publish = await member.PutAsJsonAsync("/api/v1/ai-assist/prompt", PublishBody());

        Assert.Equal(HttpStatusCode.Forbidden, read.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, publish.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsTheBuiltInDefault_BeforeAnythingIsPublished()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var body = await client.GetStringAsync("/api/v1/ai-assist/prompt");
        using var parsed = JsonDocument.Parse(body);

        Assert.True(parsed.RootElement.GetProperty("isBuiltInDefault").GetBoolean());
        Assert.Contains("{{ORGANIZATION_CATALOG}}", parsed.RootElement.GetProperty("body").GetString());
    }

    [Fact]
    public async Task Publish_RejectsABodyMissingARequiredPlaceholder()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var response = await client.PutAsJsonAsync(
            "/api/v1/ai-assist/prompt", PublishBody("No placeholders anywhere in this body."));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        // The message must name what is missing — "invalid body" would leave an admin guessing which
        // of two placeholders they dropped.
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("ORGANIZATION_CATALOG", problem);
    }

    [Fact]
    public async Task Restore_IsNotFound_ForAnUnknownVersion()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var response = await client.PostAsJsonAsync("/api/v1/ai-assist/prompt/versions/9999/restore", new { });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// The harness swaps in <c>UnconfiguredIdeaDraftModel</c>, which throws rather than answering, so a
    /// probe must surface as unavailable. This is the guard that proves the endpoint cannot make the
    /// suite reach a real provider — the failure this repo has actually had before.
    /// </summary>
    [Fact]
    public async Task Probe_IsUnavailable_AndReachesNoProvider_UnderTest()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var response = await client.PostAsJsonAsync("/api/v1/ai-assist/prompt/probe", new { body = ValidBody });

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task Probe_RejectsADraftMissingTheCatalogPlaceholder()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var response = await client.PostAsJsonAsync("/api/v1/ai-assist/prompt/probe", new { body = "nothing here" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<OrganizationCreated> CreateOrganizationAsync(HttpClient client, string title)
    {
        await ViewAsAuth.StopActingAsync(client);

        var response = await client.PostAsJsonAsync(
            "/api/v1/organizations",
            new { title, description = $"{title} prompt tests." });

        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<OrganizationCreated>(Json))!;
    }

    /// <summary>Creates a real member and returns a client logged in as them, mirroring IdeaAssistTests.</summary>
    private async Task<HttpClient> CreateMemberClientAsync(HttpClient siteAdminClient, Guid organizationId, string role)
    {
        await ViewAsAuth.StopActingAsync(siteAdminClient);

        // Unique per call — the InMemory database is shared across the class and email is globally unique.
        var email = $"prompt-{role.ToLowerInvariant()}-{Guid.NewGuid():N}@collega.test";
        const string password = "Str0ng!Passw0rd";

        var create = await siteAdminClient.PostAsJsonAsync($"/api/v1/organizations/{organizationId}/users", new
        {
            firstName = "Prompt",
            lastName = role,
            email,
            role,
            initialPassword = password,
        });
        create.EnsureSuccessStatusCode();

        var member = _factory.CreateClient();
        await LoginAsync(member, email, password);
        return member;
    }

    private static async Task LoginAsync(HttpClient client, string email, string currentPassword)
    {
        const string rotated = "R0tated!Passw0rd";

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = currentPassword });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", body.AccessToken);

        if (!body.RequiresPasswordChange)
        {
            return;
        }

        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword, newPassword = rotated });
        change.EnsureSuccessStatusCode();

        var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = rotated });
        reLogin.EnsureSuccessStatusCode();
        var reBody = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", reBody.AccessToken);
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record OrganizationCreated(Guid OrganizationId, Guid DefaultBoardId);
}
