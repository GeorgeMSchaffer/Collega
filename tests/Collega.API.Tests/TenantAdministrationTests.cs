using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Golden-path integration coverage for the Tenant Administration slice (T012-T019) through the
/// real request pipeline. Not the deferred formal QA pass — this proves the slice's happy path and
/// the two headline guardrails (default provisioning, last-Org-Admin safeguard) actually wire up.
/// List <c>search</c> is deliberately avoided: it compiles to <c>EF.Functions.Like</c>, which the
/// InMemory test provider does not translate.
/// </summary>
public sealed class TenantAdministrationTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public TenantAdministrationTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task SiteAdmin_Can_Create_Organization_With_Default_Provisioning()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var create = await client.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = "Contoso Manufacturing",
            description = "Precision parts supplier."
        });

        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreateOrgResponse>(Json);
        Assert.NotNull(created);
        Assert.NotEqual(Guid.Empty, created!.OrganizationId);
        Assert.False(string.IsNullOrWhiteSpace(created.InviteCode));
        Assert.NotEqual(Guid.Empty, created.DefaultBoardId);
        Assert.Equal(5, created.DefaultStatusCount); // the 5 canonical default statuses

        var detail = await client.GetFromJsonAsync<OrgDetailResponse>($"/api/v1/organizations/{created.OrganizationId}", Json);
        Assert.NotNull(detail);
        Assert.Equal("Contoso Manufacturing", detail!.Title);
        Assert.Equal(created.InviteCode, detail.InviteCode);
        Assert.False(detail.IsArchived);
    }

    [Fact]
    public async Task Organization_List_Excludes_Archived_By_Default()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var created = await CreateOrganizationAsync(client, "Northwind Traders", "Wholesale goods.");

        var archive = await client.PostAsync($"/api/v1/organizations/{created.OrganizationId}/archive", content: null);
        Assert.Equal(HttpStatusCode.NoContent, archive.StatusCode);

        var defaultList = await client.GetFromJsonAsync<PagedResponse<OrgListItem>>("/api/v1/organizations?pageSize=100", Json);
        Assert.DoesNotContain(defaultList!.Items, o => o.OrganizationId == created.OrganizationId);

        var archivedList = await client.GetFromJsonAsync<PagedResponse<OrgListItem>>("/api/v1/organizations?pageSize=100&isArchived=true", Json);
        Assert.Contains(archivedList!.Items, o => o.OrganizationId == created.OrganizationId);
    }

    [Fact]
    public async Task Invite_Code_Regeneration_Replaces_Previous_Code()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var created = await CreateOrganizationAsync(client, "Fabrikam Inc", "Consumer electronics.");

        var regen = await client.PostAsync($"/api/v1/organizations/{created.OrganizationId}/invite-code/regenerate", content: null);
        Assert.Equal(HttpStatusCode.OK, regen.StatusCode);
        var body = await regen.Content.ReadFromJsonAsync<RegenerateResponse>(Json);

        Assert.False(string.IsNullOrWhiteSpace(body!.InviteCode));
        Assert.NotEqual(created.InviteCode, body.InviteCode);
    }

    [Fact]
    public async Task User_Create_Enforces_Email_Uniqueness_And_Password_Policy()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Tailspin Toys", "Toy manufacturer.");
        var email = $"member-{Guid.NewGuid():N}@tailspin.test";

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Pat",
            lastName = "Jones",
            email,
            role = "User",
            initialPassword = "Str0ng!Pass"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);

        // Duplicate email -> 409.
        var duplicate = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Sam",
            lastName = "Lee",
            email,
            role = "User",
            initialPassword = "Str0ng!Pass"
        });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        // Weak password -> 400 with the initialPassword field key.
        var weak = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Kim",
            lastName = "Park",
            email = $"kim-{Guid.NewGuid():N}@tailspin.test",
            role = "User",
            initialPassword = "weak"
        });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
    }

    [Fact]
    public async Task Last_OrgAdmin_Cannot_Deactivate_Self()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Wingtip Toys", "Novelty goods.");
        var adminEmail = $"orgadmin-{Guid.NewGuid():N}@wingtip.test";
        const string password = "Str0ng!Pass";

        var createAdmin = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Robin",
            lastName = "Diaz",
            email = adminEmail,
            role = "OrgAdmin",
            initialPassword = password
        });
        Assert.Equal(HttpStatusCode.Created, createAdmin.StatusCode);
        var admin = await createAdmin.Content.ReadFromJsonAsync<CreateUserResponse>(Json);

        // The admin's created credential forces a change on first login; do that, then act as them.
        using var adminClient = _factory.CreateClient();
        var login = await adminClient.PostAsJsonAsync("/api/v1/auth/login", new { email = adminEmail, password });
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        Assert.True(loginBody!.RequiresPasswordChange);
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginBody.AccessToken);

        var change = await adminClient.PostAsJsonAsync("/api/v1/auth/change-password", new
        {
            currentPassword = password,
            newPassword = "N3w!Passw0rd"
        });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        // Re-login (password change rotates the SecurityStamp, invalidating the first token).
        var reLogin = await adminClient.PostAsJsonAsync("/api/v1/auth/login", new { email = adminEmail, password = "N3w!Passw0rd" });
        var reLoginBody = await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json);
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reLoginBody!.AccessToken);

        // As the sole Org Admin, deactivating self is rejected (requirement #8).
        var deactivate = await adminClient.PutAsJsonAsync($"/api/v1/users/{admin!.UserId}", new
        {
            firstName = "Robin",
            lastName = "Diaz",
            email = adminEmail,
            role = "OrgAdmin",
            status = "Inactive"
        });
        Assert.Equal(HttpStatusCode.BadRequest, deactivate.StatusCode);
    }

    [Fact]
    public async Task NonSiteAdmin_Cannot_Create_Organization()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Adventure Works", "Outdoor gear.");
        var userEmail = $"user-{Guid.NewGuid():N}@adventure.test";
        const string password = "Str0ng!Pass";

        await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Lee",
            lastName = "Wu",
            email = userEmail,
            role = "User",
            initialPassword = password
        });

        using var userClient = _factory.CreateClient();
        var login = await userClient.PostAsJsonAsync("/api/v1/auth/login", new { email = userEmail, password });
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        userClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginBody!.AccessToken);

        var create = await userClient.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = "Sneaky Org",
            description = "Should be rejected."
        });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
    }

    [Fact]
    public async Task SiteAdmin_Can_Edit_User_In_Another_Organization()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);

        var org = await CreateOrganizationAsync(client, "Contoso", "Cross-org edit test.");
        var email = $"user-{Guid.NewGuid():N}@contoso.test";
        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Sam",
            lastName = "Lee",
            email,
            role = "User",
            initialPassword = "Str0ng!Pass"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var user = await create.Content.ReadFromJsonAsync<CreateUserResponse>(Json);

        // The Site Admin (not a member of Contoso) promotes the user — cross-org management is allowed.
        var update = await client.PutAsJsonAsync($"/api/v1/users/{user!.UserId}", new
        {
            firstName = "Sam",
            lastName = "Lee",
            email,
            role = "OrgAdmin",
            status = "Active"
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<UserDetailResp>(Json);
        Assert.Equal("OrgAdmin", updated!.Role);

        // And can read that user back by id.
        var fetched = await client.GetFromJsonAsync<UserDetailResp>($"/api/v1/users/{user.UserId}", Json);
        Assert.Equal("OrgAdmin", fetched!.Role);
    }

    [Fact]
    public async Task SiteAdmin_Can_Set_And_Clear_Organization_Logo()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Logo Co", "Logo test.");

        const string dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        var set = await client.PutAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/logo",
            new { thumbnailDataUri = dataUri, heightPx = 120 });
        Assert.Equal(HttpStatusCode.OK, set.StatusCode);
        var detail = await set.Content.ReadFromJsonAsync<OrgLogoResponse>(Json);
        Assert.Equal(dataUri, detail!.LogoThumbnailUrl);
        Assert.Equal(120, detail.LogoHeightPx);

        // A non-image payload is rejected as a 400 (not a 500).
        var bad = await client.PutAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/logo",
            new { thumbnailDataUri = "not-an-image", heightPx = 100 });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);

        // Clearing removes it.
        var clear = await client.DeleteAsync($"/api/v1/organizations/{org.OrganizationId}/logo");
        Assert.Equal(HttpStatusCode.OK, clear.StatusCode);
        var cleared = await clear.Content.ReadFromJsonAsync<OrgLogoResponse>(Json);
        Assert.Null(cleared!.LogoThumbnailUrl);
        Assert.Null(cleared.LogoHeightPx);
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient client, string title, string description)
    {
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new { title, description });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private static async Task AuthenticateAsSiteAdminAsync(HttpClient client)
    {
        // Credentials from CollegaApiFactory's environment variables. The seeded Site Admin is
        // flagged MustChangePassword, but the issued token is still valid for protected calls.
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = "siteadmin@collega.test",
            password = "Test123!Password"
        });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.AccessToken);
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record OrgDetailResponse(Guid OrganizationId, string Title, string InviteCode, bool IsArchived);
    private sealed record OrgListItem(Guid OrganizationId, string Title, bool IsArchived);
    private sealed record RegenerateResponse(string InviteCode);
    private sealed record CreateUserResponse(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);
    private sealed record UserDetailResp(string Role, string Status);
    private sealed record OrgLogoResponse(string? LogoThumbnailUrl, int? LogoHeightPx);
    private sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
}
