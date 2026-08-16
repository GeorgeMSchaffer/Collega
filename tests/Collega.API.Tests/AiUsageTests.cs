using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;
using Collega.Domain.Ai;
using Collega.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the AI usage endpoints through the real pipeline
/// (SPEC/30-Contracts.md → "AI Idea Assist Contracts", SPEC/40-test-strategy.md §7): the Site-Admin
/// cross-org roll-up, the org-scoped report, and the authorization matrix on both routes.
/// </summary>
/// <remarks>
/// Usage rows are written straight into the DbContext rather than earned through a model call: the
/// drafting endpoint does not exist yet, and when it does it will be faked anyway (no test may reach
/// a provider). What these tests own is the read path and its authorization — the aggregation and the
/// budget gate are covered in <c>Collega.Application.Tests.AiUsageServiceTests</c>.
/// </remarks>
public sealed class AiUsageTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public AiUsageTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SiteAdmin_Sees_Every_Organization_And_The_Daily_Ceiling()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var heavy = await CreateOrganizationAsync(client, "Heavy Usage Robotics");
        var light = await CreateOrganizationAsync(client, "Light Usage Logistics");
        GivenUsage(heavy.OrganizationId, inputTokens: 40_000, outputTokens: 8_000);
        GivenUsage(light.OrganizationId, inputTokens: 1_000, outputTokens: 200);

        var response = await client.GetAsync("/api/v1/ai-assist/usage");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = (await response.Content.ReadFromJsonAsync<UsageReportResponse>(Json))!;

        var heavyRow = Assert.Single(report.Organizations, o => o.OrganizationId == heavy.OrganizationId);
        Assert.Equal("Heavy Usage Robotics", heavyRow.OrganizationName);
        Assert.Equal(48_000, heavyRow.TotalTokens);
        Assert.Contains(report.Organizations, o => o.OrganizationId == light.OrganizationId);

        // Ordered by consumption, so the organization to talk to about cost is the first row.
        Assert.Equal(heavy.OrganizationId, report.Organizations[0].OrganizationId);

        // The ceiling and the day's consumption against it are Site-Admin-only figures.
        Assert.Equal(500_000, report.DailyTokenLimit);
        Assert.NotNull(report.TokensUsedToday);
    }

    [Fact]
    public async Task OrgAdmin_Sees_Only_Their_Own_Organization_And_No_Ceiling()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var mine = await CreateOrganizationAsync(client, "Own Org Robotics");
        var theirs = await CreateOrganizationAsync(client, "Other Org Logistics");
        GivenUsage(mine.OrganizationId, inputTokens: 3_000, outputTokens: 500);
        GivenUsage(theirs.OrganizationId, inputTokens: 90_000, outputTokens: 9_000);

        using var orgAdmin = await CreateOrgAdminClientAsync(client, mine.OrganizationId);

        var response = await orgAdmin.GetAsync($"/api/v1/organizations/{mine.OrganizationId}/ai-assist/usage");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = (await response.Content.ReadFromJsonAsync<UsageReportResponse>(Json))!;

        var only = Assert.Single(report.Organizations);
        Assert.Equal(mine.OrganizationId, only.OrganizationId);
        Assert.Equal(3_500, only.TotalTokens);
        Assert.Null(report.DailyTokenLimit);
        Assert.Null(report.TokensUsedToday);
    }

    /// <summary>404, not 403 — the response must not confirm that the other organization exists.</summary>
    [Fact]
    public async Task OrgAdmin_Gets_NotFound_For_Another_Organization()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var mine = await CreateOrganizationAsync(client, "Scoped Org Robotics");
        var theirs = await CreateOrganizationAsync(client, "Foreign Org Logistics");
        using var orgAdmin = await CreateOrgAdminClientAsync(client, mine.OrganizationId);

        var response = await orgAdmin.GetAsync($"/api/v1/organizations/{theirs.OrganizationId}/ai-assist/usage");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task OrgAdmin_Is_Forbidden_From_The_Platform_Wide_Report()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "No Platform View Robotics");
        using var orgAdmin = await CreateOrgAdminClientAsync(client, org.OrganizationId);

        var response = await orgAdmin.GetAsync("/api/v1/ai-assist/usage");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task Ordinary_Members_Are_Refused_Both_Routes(string role)
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, $"Member Denied {role} Robotics");
        using var member = await CreateMemberClientAsync(client, org.OrganizationId, role);

        var platform = await member.GetAsync("/api/v1/ai-assist/usage");
        Assert.Equal(HttpStatusCode.Forbidden, platform.StatusCode);

        var scoped = await member.GetAsync($"/api/v1/organizations/{org.OrganizationId}/ai-assist/usage");
        Assert.Equal(HttpStatusCode.Forbidden, scoped.StatusCode);
    }

    [Fact]
    public async Task Anonymous_Callers_Are_Unauthorized()
    {
        using var client = _factory.CreateClient();

        var platform = await client.GetAsync("/api/v1/ai-assist/usage");
        Assert.Equal(HttpStatusCode.Unauthorized, platform.StatusCode);

        var scoped = await client.GetAsync($"/api/v1/organizations/{Guid.NewGuid()}/ai-assist/usage");
        Assert.Equal(HttpStatusCode.Unauthorized, scoped.StatusCode);
    }

    [Fact]
    public async Task Inverted_Date_Range_Is_A_Validation_Error()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var response = await client.GetAsync(
            "/api/v1/ai-assist/usage?fromUtc=2026-08-10T00:00:00Z&toUtc=2026-08-01T00:00:00Z");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    /// <summary>
    /// Rule 28e: the meter is counts, not content. Asserted on the serialized response as well as on
    /// the entity, because a leak would reach a reader through this payload.
    /// </summary>
    [Fact]
    public async Task Usage_Response_Carries_No_Prompt_Or_Transcript_Text()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Counts Only Robotics");
        GivenUsage(org.OrganizationId, inputTokens: 1_000, outputTokens: 100);

        var body = await client.GetStringAsync("/api/v1/ai-assist/usage");

        Assert.DoesNotContain("prompt", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("transcript", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("message", body, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Writes a usage row directly. The clock is the real one here (this is the integration host),
    /// so rows are stamped "now" and land inside the report's default current-month window.
    /// </summary>
    private void GivenUsage(Guid organizationId, int inputTokens, int outputTokens)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();

        db.AiUsageRecords.Add(AiUsageRecord.Create(
            organizationId,
            "claude-sonnet-5",
            DateTime.UtcNow,
            inputTokens,
            outputTokens,
            inputRatePerMillion: 3.00m,
            outputRatePerMillion: 15.00m,
            AiCallOutcome.Succeeded));

        db.SaveChanges();
    }

    private static async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient client, string title)
    {
        await ViewAsAuth.StopActingAsync(client);
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new { title, description = $"{title} usage tests." });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private Task<HttpClient> CreateOrgAdminClientAsync(HttpClient siteAdminClient, Guid organizationId) =>
        CreateMemberClientAsync(siteAdminClient, organizationId, "OrgAdmin");

    /// <summary>
    /// Creates a real member account and returns a client logged in as them. A separate client, not
    /// a View As session: these tests are about what each role may read on its own credentials.
    /// </summary>
    private async Task<HttpClient> CreateMemberClientAsync(HttpClient siteAdminClient, Guid organizationId, string role)
    {
        await ViewAsAuth.StopActingAsync(siteAdminClient);

        // Unique per call — the InMemory database is shared across the class and email is globally unique.
        var email = $"usage-{role.ToLowerInvariant()}-{Guid.NewGuid():N}@collega.test";
        const string password = "Str0ng!Passw0rd";

        var create = await siteAdminClient.PostAsJsonAsync($"/api/v1/organizations/{organizationId}/users", new
        {
            firstName = "Usage",
            lastName = role,
            email,
            role,
            initialPassword = password
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

    private sealed record UsageSummaryResponse(
        Guid OrganizationId,
        string OrganizationName,
        int Calls,
        long InputTokens,
        long OutputTokens,
        long CacheReadInputTokens,
        long CacheCreationInputTokens,
        decimal EstimatedCost,
        long TotalTokens);

    private sealed record UsageReportResponse(
        DateTime FromUtc,
        DateTime ToUtc,
        IReadOnlyList<UsageSummaryResponse> Organizations,
        long? DailyTokenLimit,
        long? TokensUsedToday,
        int TotalCalls,
        long TotalTokens,
        decimal TotalEstimatedCost);
}
