using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;
using Collega.Application.Organizations;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the Idea Field Options slice (Idea Type + Business Impact) through the
/// real pipeline: canonical provisioning on org create, option CRUD, the last-active-option guard,
/// and color validation. Mirrors <see cref="TenantAdministrationTests"/>.
/// </summary>
public sealed class IdeaFieldOptionsTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public IdeaFieldOptionsTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task NewOrganization_IsProvisionedWithCanonicalOptionSets()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Contoso Fields");

        var ideaTypes = await client.GetFromJsonAsync<List<IdeaTypeItem>>($"/api/v1/organizations/{orgId}/idea-types", Json);
        Assert.Equal(new[] { "Continuous Improvement", "Process Revision" }, ideaTypes!.Select(t => t.Name));

        // Most severe first since 2026-08-17 (user decision). Note the consequence this ordering
        // creates: unlike Idea Type, the first Business Impact is deliberately NOT the default for a
        // new idea — that is OrganizationDefaults.DefaultBusinessImpactName ("Medium"), because
        // first-active would otherwise pre-mark every idea Critical. See 10-requirements.md.
        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>($"/api/v1/organizations/{orgId}/business-impacts", Json);
        Assert.Equal(new[] { "Critical", "High", "Medium", "Low" }, impacts!.Select(i => i.Name));
        Assert.All(impacts, i => Assert.Matches("^#[0-9A-Fa-f]{6}$", i.Color));

        // Colour is bound to meaning, not position: red stays Critical wherever it sits in the list.
        Assert.Equal("#DC2626", impacts.Single(i => i.Name == "Critical").Color);
        Assert.Equal("#16A34A", impacts.Single(i => i.Name == "Low").Color);
        Assert.NotEqual(OrganizationDefaults.DefaultBusinessImpactName, impacts[0].Name);
    }

    [Fact]
    public async Task IdeaType_CreateAppendsAtEnd_AndLastActiveCannotBeDeleted()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Northwind Fields");
        await ViewAsAuth.ActAsOrgAdminAsync(client, orgId);

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types", new { name = "Bug Fix" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        var types = await client.GetFromJsonAsync<List<IdeaTypeItem>>($"/api/v1/organizations/{orgId}/idea-types", Json);
        Assert.Equal(3, types!.Count);
        Assert.Equal("Bug Fix", types[^1].Name); // appended at the end of the order

        // Delete the two extras, leaving exactly one active; the last cannot be deleted.
        foreach (var id in types.Take(2).Select(t => t.IdeaTypeId))
        {
            var del = await client.DeleteAsync($"/api/v1/idea-types/{id}");
            Assert.Equal(HttpStatusCode.NoContent, del.StatusCode);
        }

        var remaining = await client.GetFromJsonAsync<List<IdeaTypeItem>>($"/api/v1/organizations/{orgId}/idea-types", Json);
        var last = Assert.Single(remaining!);
        var deleteLast = await client.DeleteAsync($"/api/v1/idea-types/{last.IdeaTypeId}");
        Assert.Equal(HttpStatusCode.BadRequest, deleteLast.StatusCode);
    }

    [Fact]
    public async Task IdeaType_DuplicateActiveName_IsRejected()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Tailspin Fields");
        await ViewAsAuth.ActAsOrgAdminAsync(client, orgId);

        // "Continuous Improvement" already exists as a provisioned default (case-insensitive clash).
        var dup = await client.PostAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types", new { name = "continuous improvement" });
        Assert.Equal(HttpStatusCode.BadRequest, dup.StatusCode);
    }

    [Fact]
    public async Task BusinessImpact_CreateRequiresValidHexColor()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Fabrikam Fields");
        await ViewAsAuth.ActAsOrgAdminAsync(client, orgId);

        var bad = await client.PostAsJsonAsync($"/api/v1/organizations/{orgId}/business-impacts", new { name = "Blocker", color = "red" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var ok = await client.PostAsJsonAsync($"/api/v1/organizations/{orgId}/business-impacts", new { name = "Blocker", color = "#FF0000" });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
    }

    [Fact]
    public async Task BusinessImpact_ReorderRewritesSortOrder()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Adventure Fields");
        await ViewAsAuth.ActAsOrgAdminAsync(client, orgId);

        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>($"/api/v1/organizations/{orgId}/business-impacts", Json);
        var reversed = impacts!.Select(i => i.BusinessImpactId).Reverse().ToList();

        var reorder = await client.PostAsJsonAsync(
            $"/api/v1/organizations/{orgId}/business-impacts/reorder",
            new { orderedBusinessImpactIds = reversed });
        Assert.Equal(HttpStatusCode.NoContent, reorder.StatusCode);

        var after = await client.GetFromJsonAsync<List<BusinessImpactItem>>($"/api/v1/organizations/{orgId}/business-impacts", Json);
        Assert.Equal(reversed, after!.Select(i => i.BusinessImpactId).ToList());
    }

    [Fact]
    public async Task NonAdmin_CannotManageOptions()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Wingtip Fields");

        var userEmail = $"user-{Guid.NewGuid():N}@wingtip.test";
        const string password = "Str0ng!Pass";
        await client.PostAsJsonAsync($"/api/v1/organizations/{orgId}/users", new
        {
            firstName = "Lee",
            lastName = "Wu",
            email = userEmail,
            role = "User",
            initialPassword = password
        });

        using var userClient = _factory.CreateClient();
        var login = await userClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userEmail, password });
        var body = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        userClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.AccessToken);

        var create = await userClient.PostAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types", new { name = "Sneaky" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
    }

    private async Task<Guid> CreateOrganizationAsync(HttpClient client, string title)
    {
        // Bootstrap runs as the Site Admin, so close any session a previous test left open — they
        // are non-nestable and the InMemory database is shared across the class. Idempotent.
        await ViewAsAuth.StopActingAsync(client);
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new { title, description = "desc" });
        response.EnsureSuccessStatusCode();
        // Leaves the client acting as the Site Admin. Rule 25 means the caller cannot yet mutate
        // this organization's content — a test that needs to must opt in with an explicit
        // ViewAsAuth.ActAsOrgAdminAsync naming the organization it means. See ViewAsAuth's remarks
        // for why this is opt-in rather than automatic.
        var created = await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json);
        return created!.OrganizationId;
    }

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private sealed record LoginResponse(string AccessToken);
    private sealed record CreateOrgResponse(Guid OrganizationId);
    private sealed record IdeaTypeItem(Guid IdeaTypeId, Guid OrganizationId, string Name, int SortOrder, bool IsDeleted);
    private sealed record BusinessImpactItem(Guid BusinessImpactId, Guid OrganizationId, string Name, string Color, int SortOrder, bool IsDeleted);
}
