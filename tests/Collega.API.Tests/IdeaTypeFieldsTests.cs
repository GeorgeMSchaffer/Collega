using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the Idea-Type Fields slice (T061-T066) through the real pipeline: per-type
/// field selection + appearance admin endpoints, idea-type immutability on update, and the admin
/// reassign hatch (SPEC/20-feature-idea-type-fields.md, SPEC/30-Contracts.md "Idea-Type Field Contracts").
/// </summary>
public sealed class IdeaTypeFieldsTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly CollegaApiFactory _factory;

    public IdeaTypeFieldsTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SetFields_SwitchesTypeToCurated_ThenClearReturnsToAllActiveFields()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgId = await CreateOrganizationAsync(admin);
        var fieldId = await CreateFieldDefinitionAsync(admin, orgId, "Budget", "Number");
        var typeId = (await GetIdeaTypesAsync(admin, orgId))[0].IdeaTypeId;

        var set = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types/{typeId}/fields", new
        {
            fields = new[] { new { fieldDefinitionId = fieldId, displayOrder = 1, isRequired = true } }
        });
        Assert.Equal(HttpStatusCode.NoContent, set.StatusCode);

        var curated = (await GetIdeaTypesAsync(admin, orgId)).Single(t => t.IdeaTypeId == typeId);
        Assert.Equal("Curated", curated.FieldMode);
        var link = Assert.Single(curated.Fields);
        Assert.Equal(fieldId, link.FieldDefinitionId);
        Assert.True(link.IsRequired);

        var clear = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types/{typeId}/fields", new { fields = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.NoContent, clear.StatusCode);

        var reverted = (await GetIdeaTypesAsync(admin, orgId)).Single(t => t.IdeaTypeId == typeId);
        Assert.Equal("AllActiveFields", reverted.FieldMode);
        Assert.Empty(reverted.Fields);
    }

    [Fact]
    public async Task SetFields_WithUnknownField_ReturnsBadRequest()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgId = await CreateOrganizationAsync(admin);
        var typeId = (await GetIdeaTypesAsync(admin, orgId))[0].IdeaTypeId;

        var set = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types/{typeId}/fields", new
        {
            fields = new[] { new { fieldDefinitionId = Guid.NewGuid(), displayOrder = 1, isRequired = false } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, set.StatusCode);
    }

    [Fact]
    public async Task SetAppearance_ValidatesColor_AndPersistsBadge()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgId = await CreateOrganizationAsync(admin);
        var typeId = (await GetIdeaTypesAsync(admin, orgId))[0].IdeaTypeId;

        var bad = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types/{typeId}/appearance", new { colorHex = "red", icon = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        var ok = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/idea-types/{typeId}/appearance", new { colorHex = "#1D4ED8", icon = "rocket" });
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);

        var updated = (await GetIdeaTypesAsync(admin, orgId)).Single(t => t.IdeaTypeId == typeId);
        Assert.Equal("#1D4ED8", updated.ColorHex);
        Assert.Equal("rocket", updated.Icon);
    }

    [Fact]
    public async Task UpdateIdea_ChangingIdeaType_ReturnsBadRequest()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var (orgId, boardId) = await CreateOrgWithBoardAsync(admin);
        var types = await GetIdeaTypesAsync(admin, orgId);
        var (typeA, typeB) = (types[0], types[1]);
        var impactId = FirstBusinessImpactId(orgId);

        var created = await CreateIdeaAsync(admin, boardId, typeA.IdeaTypeId, impactId);

        var update = await admin.PutAsJsonAsync($"/api/v1/ideas/{created}", new
        {
            title = "Retitled",
            description = "A revised description of the idea.",
            priority = "High",
            ideaTypeId = typeB.IdeaTypeId,     // different -> rejected (immutable)
            businessImpactId = impactId
        });
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
    }

    [Fact]
    public async Task ReassignIdeaType_AdminSucceeds_UserForbidden()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var (orgId, boardId) = await CreateOrgWithBoardAsync(admin);
        var types = await GetIdeaTypesAsync(admin, orgId);
        var impactId = FirstBusinessImpactId(orgId);
        var created = await CreateIdeaAsync(admin, boardId, types[0].IdeaTypeId, impactId);

        // A plain user cannot reassign.
        var userEmail = await CreateUserAsync(admin, orgId, "User");
        using var user = await LoginAsync(userEmail);
        var forbidden = await user.PutAsJsonAsync($"/api/v1/organizations/{orgId}/ideas/{created}/idea-type", new { ideaTypeId = types[1].IdeaTypeId });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // The Site Admin can.
        var ok = await admin.PutAsJsonAsync($"/api/v1/organizations/{orgId}/ideas/{created}/idea-type", new { ideaTypeId = types[1].IdeaTypeId });
        Assert.Equal(HttpStatusCode.NoContent, ok.StatusCode);

        var detail = await admin.GetFromJsonAsync<IdeaDetailResponse>($"/api/v1/ideas/{created}", Json);
        Assert.Equal(types[1].IdeaTypeId, detail!.IdeaTypeId);
    }

    // Helpers ----------------------------------------------------------------------------------

    private async Task<Guid> CreateOrganizationAsync(HttpClient admin) => (await CreateOrgAsync(admin)).OrganizationId;

    private async Task<(Guid OrgId, Guid BoardId)> CreateOrgWithBoardAsync(HttpClient admin)
    {
        var org = await CreateOrgAsync(admin);
        return (org.OrganizationId, org.DefaultBoardId);
    }

    private async Task<CreateOrgResponse> CreateOrgAsync(HttpClient admin)
    {
        // Bootstrap runs as the Site Admin, so close any session a previous test left open — they
        // are non-nestable and the InMemory database is shared across the class. Idempotent.
        await ViewAsAuth.StopActingAsync(admin);
        var response = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Idea-type fields test organization."
        });
        response.EnsureSuccessStatusCode();
        var created = (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;

        // Rule 25: a Site Admin acting as themselves can bootstrap an organization but cannot then
        // mutate its content. Elevating here — once, in the shared helper — leaves every test body
        // unchanged while routing its mutations through View As, which is the path the product now
        // requires and which nothing else covers end to end.
        await ViewAsAuth.ActAsOrgAdminAsync(admin, created.OrganizationId);

        return created;
    }

    private async Task<Guid> CreateFieldDefinitionAsync(HttpClient admin, Guid orgId, string name, string fieldType)
    {
        var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{orgId}/field-definitions", new { name, fieldType, isRequired = false });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<FieldDefinitionResponse>(Json);
        return created!.FieldDefinitionId;
    }

    private async Task<Guid> CreateIdeaAsync(HttpClient client, Guid boardId, Guid ideaTypeId, Guid businessImpactId)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/boards/{boardId}/ideas", new
        {
            title = "Reduce cycle time",
            description = "Streamline the intake flow to cut waiting.",
            priority = "Medium",
            ideaTypeId,
            businessImpactId
        });
        response.EnsureSuccessStatusCode();
        var created = await response.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json);
        return created!.IdeaId;
    }

    private Guid FirstBusinessImpactId(Guid orgId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        return db.BusinessImpacts.Where(b => b.OrganizationId == orgId && !b.IsDeleted).OrderBy(b => b.SortOrder).Select(b => b.Id).First();
    }

    private async Task<List<IdeaTypeItem>> GetIdeaTypesAsync(HttpClient client, Guid orgId) =>
        (await client.GetFromJsonAsync<List<IdeaTypeItem>>($"/api/v1/organizations/{orgId}/idea-types", Json))!;

    private async Task<string> CreateUserAsync(HttpClient admin, Guid orgId, string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@itf.test";
        var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{orgId}/users", new
        {
            firstName = "Test",
            lastName = role,
            email,
            role,
            initialPassword = "Str0ng!Pass"
        });
        response.EnsureSuccessStatusCode();
        return email;
    }

    private async Task<HttpClient> LoginAsync(string email)
    {
        var client = _factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "Str0ng!Pass" });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;

        if (body.RequiresPasswordChange)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
            var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword = "Str0ng!Pass", newPassword = "N3w!Passw0rd" });
            change.EnsureSuccessStatusCode();
            var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = "N3w!Passw0rd" });
            reLogin.EnsureSuccessStatusCode();
            body = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
        return client;
    }

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private sealed record LoginResponse(string AccessToken, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record FieldDefinitionResponse(Guid FieldDefinitionId);
    private sealed record IdeaCreatedResponse(Guid IdeaId);
    private sealed record IdeaDetailResponse(Guid IdeaId, Guid IdeaTypeId, string? IdeaTypeColorHex, string? IdeaTypeIcon);
    private sealed record IdeaTypeItem(Guid IdeaTypeId, string Name, bool IsDeleted, string? ColorHex, string? Icon, string FieldMode, List<IdeaTypeFieldItem> Fields);
    private sealed record IdeaTypeFieldItem(Guid FieldDefinitionId, int DisplayOrder, bool IsRequired);
}
