using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Contract coverage for the problem-details error envelope (T047-T049 hardening,
/// SPEC/30-Contracts.md "Error Envelope"): every non-2xx response is
/// <c>application/problem+json</c> carrying <c>title</c>/<c>status</c>/<c>detail</c>/<c>instance</c>
/// (and, per the contract, <c>type</c>), validation failures add an <c>errors</c> object keyed by
/// camelCase field names, and each mapped status is reachable through a real request. The
/// <c>AppExceptionHandler</c> maps 400/401/403/404/409, and lockout to 429 (canonical per
/// SPEC/30-Contracts.md; CLAUDE.md's 423 is stale doc drift). There is no code path that yields 423.
///
/// KNOWN GAP (flagged, not fixed here — this unit is test-only): responses rendered by
/// <c>AppExceptionHandler</c> (401/403/404/409/429) omit the <c>type</c> member entirely, whereas
/// the contract's "Error Envelope" says <c>type</c> is present on all non-2xx responses. The
/// framework-rendered paths (model-state 400, bodiless routing 404) DO include <c>type</c>. This is
/// pinned by <see cref="AppExceptionEnvelope_Currently_Omits_Type_KnownGap"/> and
/// <see cref="ValidationError_400_Envelope_Includes_Type"/> so the discrepancy is visible and any
/// future fix will flip the characterization test.
/// </summary>
public sealed class ContractTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string SiteAdminEmail = "siteadmin@collega.test";
    private const string SiteAdminPassword = "Test123!Password";
    private const string StrongPassword = "Str0ng!Pass";

    private readonly CollegaApiFactory _factory;

    public ContractTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task ValidationError_400_Uses_Envelope_With_CamelCase_Errors()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // Empty body fails every [RequiredField] on CreateUserRequest, producing model-state errors.
        using var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var root = await AssertProblemEnvelopeAsync(response, HttpStatusCode.BadRequest);

        Assert.True(root.TryGetProperty("errors", out var errors), "validation envelope is missing 'errors'.");
        // Property names are PascalCase in C# but the envelope keys must be camelCase (contract shape).
        var keys = errors.EnumerateObject().Select(p => p.Name).ToArray();
        Assert.Contains("firstName", keys);
        Assert.DoesNotContain(keys, k => k == "FirstName");
    }

    [Fact]
    public async Task ValidationError_400_Envelope_Includes_Type()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        using var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new { });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var root = await ReadEnvelopeAsync(response);
        // The model-state validation path sets a concrete problem 'type' URI.
        Assert.True(root.TryGetProperty("type", out var type), "validation envelope is missing 'type'.");
        Assert.False(string.IsNullOrWhiteSpace(type.GetString()));
    }

    [Fact]
    public async Task AppExceptionEnvelope_Currently_Omits_Type_KnownGap()
    {
        // Characterization of the KNOWN GAP described on this class: AppExceptionHandler-rendered
        // envelopes (here, a 404) do not include a 'type' member, contrary to SPEC/30-Contracts.md.
        // If AppExceptionHandler is fixed to populate 'type', this assertion flips and this test
        // should be updated to require 'type' — that is the intended signal, not a regression.
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);

        using var response = await admin.GetAsync($"/api/v1/organizations/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var root = await ReadEnvelopeAsync(response);
        Assert.False(root.TryGetProperty("type", out _),
            "AppExceptionHandler now emits 'type' — update this characterization test to require it (spec gap fixed).");
    }

    [Fact]
    public async Task Unauthorized_401_Uses_Envelope()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();
        using var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = "wrong-password" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        await AssertProblemEnvelopeAsync(response, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Forbidden_403_Uses_Envelope()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var userClient = await LoginAsUserAsync(user.Email);

        // A non-Site-Admin creating an organization is forbidden.
        using var response = await userClient.PostAsJsonAsync("/api/v1/organizations", new { title = "Nope", description = "Rejected." });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        await AssertProblemEnvelopeAsync(response, HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task NotFound_404_Uses_Envelope()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);

        using var response = await admin.GetAsync($"/api/v1/organizations/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertProblemEnvelopeAsync(response, HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Conflict_409_Uses_Envelope()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var email = $"conflict-{Guid.NewGuid():N}@contract.test";
        var first = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "First",
            lastName = "User",
            email,
            role = "User",
            initialPassword = StrongPassword
        });
        first.EnsureSuccessStatusCode();

        // Re-using the email conflicts with the globally-unique-email rule.
        using var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Second",
            lastName = "User",
            email,
            role = "User",
            initialPassword = StrongPassword
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertProblemEnvelopeAsync(response, HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task LockedOut_429_Uses_Envelope()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();

        HttpResponseMessage? last = null;
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            last?.Dispose();
            last = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = "wrong-password" });
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        await AssertProblemEnvelopeAsync(last, HttpStatusCode.TooManyRequests);
        last.Dispose();
    }

    // Helpers -----------------------------------------------------------------------------------

    /// <summary>
    /// Asserts the problem-details envelope shape shared by every mapped status: correct media type,
    /// and the contract fields that are reliably populated across both the framework-rendered and
    /// AppExceptionHandler-rendered paths (title / status / detail / instance). The <c>type</c>
    /// member is asserted separately because AppExceptionHandler currently omits it (see the class
    /// summary's KNOWN GAP).
    /// </summary>
    private static async Task<JsonElement> AssertProblemEnvelopeAsync(HttpResponseMessage response, HttpStatusCode expected)
    {
        var root = await ReadEnvelopeAsync(response);

        Assert.True(root.TryGetProperty("title", out var title), "envelope is missing 'title'.");
        Assert.True(root.TryGetProperty("status", out var status), "envelope is missing 'status'.");
        Assert.True(root.TryGetProperty("detail", out _), "envelope is missing 'detail'.");
        Assert.True(root.TryGetProperty("instance", out _), "envelope is missing 'instance'.");

        Assert.Equal((int)expected, status.GetInt32());
        Assert.False(string.IsNullOrWhiteSpace(title.GetString()));

        return root;
    }

    private static async Task<JsonElement> ReadEnvelopeAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);

        var body = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(body);
        // Clone so the element remains usable after the JsonDocument is disposed.
        return document.RootElement.Clone();
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient admin)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Contract test organization."
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private async Task<CreatedUser> CreateOrgUserAsync(HttpClient admin)
    {
        var org = await CreateOrganizationAsync(admin);
        var email = $"user-{Guid.NewGuid():N}@contract.test";
        var user = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Contract",
            lastName = "User",
            email,
            role = "User",
            initialPassword = StrongPassword
        });
        user.EnsureSuccessStatusCode();
        var created = (await user.Content.ReadFromJsonAsync<CreateUserResponse>(Json))!;
        return new CreatedUser(created.UserId, email);
    }

    private async Task<HttpClient> LoginAsUserAsync(string email)
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = StrongPassword });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;

        // A freshly created user must change its password on first login before acting.
        if (body.RequiresPasswordChange)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
            var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword = StrongPassword, newPassword = "N3w!Passw0rd" });
            change.EnsureSuccessStatusCode();

            var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "N3w!Passw0rd" });
            reLogin.EnsureSuccessStatusCode();
            body = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
        return client;
    }

    private static async Task AuthenticateAsSiteAdminAsync(HttpClient client)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = SiteAdminEmail, password = SiteAdminPassword });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.AccessToken);
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record CreateUserResponse(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);
    private sealed record CreatedUser(Guid UserId, string Email);
}
