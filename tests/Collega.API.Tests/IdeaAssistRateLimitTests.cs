using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Rate limiting on the drafting endpoint (SPEC/20-feature-ai-idea-assist.md rule 26; contract
/// <c>429</c>), against a host whose assist is configured with a local stub.
/// </summary>
/// <remarks>
/// Separate class, separate fixture: the default harness runs with the feature dark, where a turn
/// 503s before the limiter is consulted and writes no usage record for it to count. That ordering is
/// correct — with nothing to spend there is nothing to limit — so the limit has to be tested where it
/// actually applies. See <see cref="AiConfiguredApiFactory"/>.
/// </remarks>
public sealed class IdeaAssistRateLimitTests : IClassFixture<AiConfiguredApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly AiConfiguredApiFactory _factory;

    public IdeaAssistRateLimitTests(AiConfiguredApiFactory factory)
    {
        _factory = factory;
    }

    /// <summary>
    /// The positive half of the availability probe (rule 32a), which the dark default harness cannot
    /// express. Paired with <c>Availability_Is_False_When_The_Feature_Is_Dark</c>, this is what makes
    /// the probe worth trusting: it tracks real deployment state in both directions rather than
    /// returning a constant.
    /// </summary>
    [Fact]
    public async Task Availability_Is_True_When_Assist_Is_Configured()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Available Robotics");
        using var member = await CreateMemberClientAsync(client, org.OrganizationId, "User");

        var body = await member.GetStringAsync("/api/v1/ai-assist/availability");

        Assert.Contains("\"available\":true", body.Replace(" ", string.Empty), StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Rate limiting is a distinct outcome from unavailability, and the wire says so: <c>429</c> with
    /// a <c>Retry-After</c>, not the <c>503</c> that means "stop asking". The default per-user limit
    /// is ten per window, so a burst past that trips it.
    /// </summary>
    [Fact]
    public async Task Turn_Is_RateLimited_With_RetryAfter_After_Too_Many_Requests()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Rate Limited Robotics");
        using var member = await CreateMemberClientAsync(client, org.OrganizationId, "User");

        HttpResponseMessage? limited = null;
        var allowed = 0;

        for (var i = 0; i < 15 && limited is null; i++)
        {
            var response = await PostTurnAsync(member, org.DefaultBoardId, $"Idea number {i}.");

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                limited = response;
            }
            else
            {
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                allowed++;
            }
        }

        Assert.NotNull(limited);
        Assert.NotNull(limited!.Headers.RetryAfter);

        // The limit is a ceiling, not an approximation: exactly the configured allowance gets through.
        Assert.Equal(10, allowed);
    }

    /// <summary>
    /// One user's burst must not lock out a colleague. The per-user limit is the tighter of the two,
    /// so a second member still has their own allowance after the first is exhausted.
    /// </summary>
    [Fact]
    public async Task One_Users_Limit_Does_Not_Block_A_Colleague()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Shared Allowance Robotics");
        using var heavy = await CreateMemberClientAsync(client, org.OrganizationId, "User");
        using var quiet = await CreateMemberClientAsync(client, org.OrganizationId, "User");

        for (var i = 0; i < 11; i++)
        {
            await PostTurnAsync(heavy, org.DefaultBoardId, $"Burst {i}.");
        }

        var colleague = await PostTurnAsync(quiet, org.DefaultBoardId, "My own first idea.");

        Assert.Equal(HttpStatusCode.OK, colleague.StatusCode);
    }

    private static Task<HttpResponseMessage> PostTurnAsync(HttpClient client, Guid boardId, string text) =>
        client.PostAsJsonAsync(
            $"/api/v1/boards/{boardId}/idea-assist/turns",
            new { transcript = new[] { new { role = "user", text } } });

    private static async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient client, string title)
    {
        await ViewAsAuth.StopActingAsync(client);
        var response = await client.PostAsJsonAsync(
            "/api/v1/organizations",
            new { title, description = $"{title} rate-limit tests." });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private async Task<HttpClient> CreateMemberClientAsync(HttpClient siteAdminClient, Guid organizationId, string role)
    {
        await ViewAsAuth.StopActingAsync(siteAdminClient);

        var email = $"ratelimit-{Guid.NewGuid():N}@collega.test";
        const string password = "Str0ng!Passw0rd";

        var create = await siteAdminClient.PostAsJsonAsync($"/api/v1/organizations/{organizationId}/users", new
        {
            firstName = "Rate",
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
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);

        if (!body.RequiresPasswordChange)
        {
            return;
        }

        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword, newPassword = rotated });
        change.EnsureSuccessStatusCode();

        var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = rotated });
        reLogin.EnsureSuccessStatusCode();
        var reBody = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reBody.AccessToken);
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
}
