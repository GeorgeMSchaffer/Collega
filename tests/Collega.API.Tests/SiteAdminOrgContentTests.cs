using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for <c>SPEC/20-feature-view-as.md</c> rules 25-26: a Site Admin acting as
/// themselves cannot create, edit or delete organization-owned content, but reaches the same
/// operations through View As, and keeps direct organization and user administration.
/// </summary>
/// <remarks>
/// <para>The rest of the API suite exercises the <i>permitted</i> half of this rule incidentally —
/// its helpers elevate through <see cref="ViewAsAuth"/>, so every mutation they make already runs
/// under an impersonated Org Admin. Nothing there asserts the <i>refusal</i>, which is the half the
/// server-side guard was added for. If the guard were deleted, this class is what would fail.</para>
///
/// <para>Deliberately paired: each refusal is asserted next to the same call succeeding under View
/// As. A test that only checked for 403 would still pass if the endpoint were broken outright.</para>
/// </remarks>
public sealed class SiteAdminOrgContentTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public SiteAdminOrgContentTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Creating_A_Status_But_Succeeds_Through_ViewAs()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        var direct = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/statuses",
            new { name = "Blocked", color = "#EF4444", sortOrder = 60 });
        Assert.Equal(HttpStatusCode.Forbidden, direct.StatusCode);

        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var throughViewAs = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/statuses",
            new { name = "Blocked", color = "#EF4444", sortOrder = 60 });
        Assert.Equal(HttpStatusCode.Created, throughViewAs.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Creating_A_Board_But_Succeeds_Through_ViewAs()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        var statuses = await client.GetFromJsonAsync<List<StatusItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/statuses", Json);
        var swimlanes = new[]
        {
            new { statusId = statuses![0].StatusId, order = 0 },
            new { statusId = statuses[1].StatusId, order = 1 }
        };

        var direct = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards",
            new { name = "Direct", allowUserStatusUpdate = false, swimlanes });
        Assert.Equal(HttpStatusCode.Forbidden, direct.StatusCode);

        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var throughViewAs = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards",
            new { name = "Through View As", allowUserStatusUpdate = false, swimlanes });
        Assert.Equal(HttpStatusCode.Created, throughViewAs.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Creating_An_Idea_But_Succeeds_Through_ViewAs()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        // Idea create requires an active Idea Type and Business Impact; read the organization's
        // canonical defaults, which a direct Site Admin may still do.
        var ideaTypes = await client.GetFromJsonAsync<List<IdeaTypeItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/idea-types", Json);
        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/business-impacts", Json);

        var idea = new
        {
            title = "Direct",
            description = "d",
            priority = "Low",
            ideaTypeId = ideaTypes![0].IdeaTypeId,
            businessImpactId = impacts![0].BusinessImpactId
        };

        var direct = await client.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas", idea);
        Assert.Equal(HttpStatusCode.Forbidden, direct.StatusCode);

        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var throughViewAs = await client.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas", idea);
        Assert.Equal(HttpStatusCode.Created, throughViewAs.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Creating_An_IdeaType_And_A_FieldDefinition()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        var ideaType = await client.PostAsJsonAsync(
            $"/api/v1/organizations/{org.OrganizationId}/idea-types", new { name = "Direct" });
        Assert.Equal(HttpStatusCode.Forbidden, ideaType.StatusCode);

        var fieldDefinition = await client.PostAsJsonAsync(
            $"/api/v1/organizations/{org.OrganizationId}/field-definitions",
            new { name = "Direct", fieldType = "Text", isRequired = false });
        Assert.Equal(HttpStatusCode.Forbidden, fieldDefinition.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Reassigning_An_Idea_Type()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        var ideaTypes = await client.GetFromJsonAsync<List<IdeaTypeItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/idea-types", Json);
        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/business-impacts", Json);

        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var create = await client.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas", new
        {
            title = "Reassign me",
            description = "d",
            priority = "Low",
            ideaTypeId = ideaTypes![0].IdeaTypeId,
            businessImpactId = impacts![0].BusinessImpactId
        });
        create.EnsureSuccessStatusCode();
        var idea = (await create.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json))!;

        // Reassignment is a separate admin-only path that does not share the create/update guard,
        // so it needs its own assertion — it changes an idea's type, which is org content.
        await ViewAsAuth.StopActingAsync(client);
        var reassign = await client.PutAsJsonAsync(
            $"/api/v1/organizations/{org.OrganizationId}/ideas/{idea.IdeaId}/idea-type",
            new { ideaTypeId = ideaTypes[1].IdeaTypeId });
        Assert.Equal(HttpStatusCode.Forbidden, reassign.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Bulk_Creating_Ideas_By_Csv_Import()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        // The sibling of POST /boards/{id}/ideas. Guarding only the single-create endpoint would
        // leave the same mutation reachable in bulk, which is strictly worse.
        using var content = new MultipartFormDataContent();
        // Must be a *valid* file: the controller parses and bounds-checks before calling the
        // service, so a malformed one would 400 for reasons unrelated to the guard under test.
        var csv = new ByteArrayContent(
            "Title,Description,Priority,Idea Type,Business Impact\nImported,d,Low,Continuous Improvement,High\n"u8.ToArray());
        csv.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        content.Add(csv, "csvFile", "ideas.csv");

        var import = await client.PostAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas/import", content);
        Assert.Equal(HttpStatusCode.Forbidden, import.StatusCode);
    }

    [Fact]
    public async Task Direct_SiteAdmin_Is_Refused_Upvoting_And_Commenting()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        var ideaTypes = await client.GetFromJsonAsync<List<IdeaTypeItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/idea-types", Json);
        var impacts = await client.GetFromJsonAsync<List<BusinessImpactItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/business-impacts", Json);

        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var create = await client.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas", new
        {
            title = "Engagement",
            description = "d",
            priority = "Low",
            ideaTypeId = ideaTypes![0].IdeaTypeId,
            businessImpactId = impacts![0].BusinessImpactId
        });
        create.EnsureSuccessStatusCode();
        var idea = (await create.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json))!;

        // Rule 25c: a vote and a comment express a member's position, and a Site Admin is not a
        // member of this organization. Both remain available through View As — which is how the
        // idea above was created.
        await ViewAsAuth.StopActingAsync(client);

        var upvote = await client.PostAsync($"/api/v1/ideas/{idea.IdeaId}/upvote/toggle", null);
        Assert.Equal(HttpStatusCode.Forbidden, upvote.StatusCode);

        var comment = await client.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments",
            new { body = "Direct comment" });
        Assert.Equal(HttpStatusCode.Forbidden, comment.StatusCode);
    }

    [Fact]
    public async Task Reading_Organization_Content_Stays_Open_To_A_Direct_SiteAdmin()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client);

        // The global aggregate views depend on this: rule 25 restricts mutation only.
        var statuses = await client.GetAsync($"/api/v1/organizations/{org.OrganizationId}/statuses");
        Assert.Equal(HttpStatusCode.OK, statuses.StatusCode);

        var ideas = await client.GetAsync($"/api/v1/organizations/{org.OrganizationId}/ideas");
        Assert.Equal(HttpStatusCode.OK, ideas.StatusCode);
    }

    [Fact]
    public async Task Bootstrap_Exception_Leaves_Organization_And_User_Administration_Direct()
    {
        using var client = _factory.CreateClient();
        await SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

        // Rule 26. Without both of these a fresh deployment could never be set up, because there
        // would be no user to act as — so they must work with no View As session in play.
        var org = await CreateOrganizationAsync(client);

        var user = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Bootstrap",
            lastName = "Admin",
            email = $"bootstrap-{Guid.NewGuid():N}@collega.test",
            role = "OrgAdmin",
            initialPassword = "Str0ng!Passw0rd"
        });
        Assert.Equal(HttpStatusCode.Created, user.StatusCode);
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient client)
    {
        // Creating an organization is Site Admin work, so close any session an earlier test in this
        // class left open — the InMemory database is shared across the class. Idempotent.
        await ViewAsAuth.StopActingAsync(client);
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Rule 25 test organization."
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private sealed record CreateOrgResponse(Guid OrganizationId, Guid DefaultBoardId);
    private sealed record StatusItem(Guid StatusId);
    private sealed record IdeaCreatedResponse(Guid IdeaId);
    private sealed record IdeaTypeItem(Guid IdeaTypeId);
    private sealed record BusinessImpactItem(Guid BusinessImpactId);
}
