using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

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

        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>($"/api/v1/organizations/{orgId}/business-impacts", Json);
        Assert.Equal(new[] { "Low", "Medium", "High", "Critical" }, impacts!.Select(i => i.Name));
        Assert.All(impacts, i => Assert.Matches("^#[0-9A-Fa-f]{6}$", i.Color));
    }

    [Fact]
    public async Task IdeaType_CreateAppendsAtEnd_AndLastActiveCannotBeDeleted()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgId = await CreateOrganizationAsync(client, "Northwind Fields");

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
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new { title, description = "desc" });
        response.EnsureSuccessStatusCode();
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
