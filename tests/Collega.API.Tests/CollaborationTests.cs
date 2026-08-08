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
/// Integration coverage for the Collaboration slice (T025-T036) through the real request pipeline:
/// idea create/detail/list/update/status/delete, title/description limits, left-most-swimlane
/// default, tag normalization + autocomplete, organization-scoped mention resolution, comment
/// CRUD + chronology, upvote one-per-user, board-configured User moves, and permission rules.
/// Board/status read endpoints belong to the Workflow Configuration slice, so tests read seeded
/// swimlane status ids directly from the InMemory <see cref="CollegaDbContext"/>.
/// </summary>
public sealed class CollaborationTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string StrongPassword = "Str0ng!Pass";
    private const string ChangedPassword = "N3w!Passw0rd";

    private readonly CollegaApiFactory _factory;

    public CollaborationTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    // T025 / T027 -------------------------------------------------------------------------------

    [Fact]
    public async Task Create_Idea_Defaults_To_LeftMost_Swimlane_Status()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var statusIds = GetBoardStatusIds(org.DefaultBoardId);

        var created = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Reduce cycle time", description = "Streamline the intake flow.", priority = "High" });

        Assert.Equal(statusIds[0], created.StatusId);

        var detail = await admin.GetFromJsonAsync<IdeaDetailResponse>($"/api/v1/ideas/{created.IdeaId}", Json);
        Assert.Equal("Reduce cycle time", detail!.Title);
        Assert.Equal("High", detail.Priority);
        Assert.Equal(statusIds[0], detail.StatusId);
    }

    // T026 -------------------------------------------------------------------------------------

    [Fact]
    public async Task Create_Idea_Enforces_Field_Limits_And_Required_Fields()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var url = $"/api/v1/boards/{org.DefaultBoardId}/ideas";

        var longTitle = await admin.PostAsJsonAsync(url, new { title = new string('t', 151), description = "ok", priority = "Low" });
        Assert.Equal(HttpStatusCode.BadRequest, longTitle.StatusCode);

        var longDescription = await admin.PostAsJsonAsync(url, new { title = "ok", description = new string('d', 4001), priority = "Low" });
        Assert.Equal(HttpStatusCode.BadRequest, longDescription.StatusCode);

        var missingTitle = await admin.PostAsJsonAsync(url, new { description = "ok", priority = "Low" });
        Assert.Equal(HttpStatusCode.BadRequest, missingTitle.StatusCode);

        var badPriority = await admin.PostAsJsonAsync(url, new { title = "ok", description = "ok", priority = "Urgent" });
        Assert.Equal(HttpStatusCode.BadRequest, badPriority.StatusCode);
    }

    [Fact]
    public async Task Create_Idea_With_Status_Not_On_Board_Is_Rejected()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var response = await admin.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "ok", description = "ok", priority = "Low", statusId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // T028 / T029 ------------------------------------------------------------------------------

    [Fact]
    public async Task Tags_Are_Normalized_Reused_And_Autocompleted()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var first = await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "First", description = "d", priority = "Low", tagNames = new[] { "Roadmap", "Quick Win" } });
        var second = await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Second", description = "d", priority = "Low", tagNames = new[] { " roadmap " } });

        var firstDetail = await admin.GetFromJsonAsync<IdeaDetailResponse>($"/api/v1/ideas/{first.IdeaId}", Json);
        var secondDetail = await admin.GetFromJsonAsync<IdeaDetailResponse>($"/api/v1/ideas/{second.IdeaId}", Json);
        Assert.Contains("Roadmap", firstDetail!.TagNames);
        // The second idea's " roadmap " normalizes to and reuses the existing "Roadmap" display value.
        Assert.Contains("Roadmap", secondDetail!.TagNames);

        // Autocomplete begins after 2 characters; a single character returns nothing.
        var oneChar = await admin.GetFromJsonAsync<string[]>($"/api/v1/organizations/{org.OrganizationId}/tags?search=r", Json);
        Assert.Empty(oneChar!);

        var suggestions = await admin.GetFromJsonAsync<string[]>($"/api/v1/organizations/{org.OrganizationId}/tags?search=ro", Json);
        Assert.Single(suggestions!);
        Assert.Equal("Roadmap", suggestions![0]);
    }

    [Fact]
    public async Task Create_Idea_Rejects_More_Than_Ten_Tags()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var tooManyTags = Enumerable.Range(0, 11).Select(i => $"tag{i}").ToArray();
        var response = await admin.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "ok", description = "ok", priority = "Low", tagNames = tooManyTags });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // T030 -------------------------------------------------------------------------------------

    [Fact]
    public async Task Mentions_Resolve_Same_Org_Users_And_Reject_Unknown()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var member = await CreateUserAsync(admin, org.OrganizationId, "User");

        var resolved = await admin.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "Mentioned", description = "d", priority = "Low", mentionEmails = new[] { member.Email } });
        Assert.Equal(HttpStatusCode.Created, resolved.StatusCode);

        var unresolved = await admin.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "Bad mention", description = "d", priority = "Low", mentionEmails = new[] { "nobody@nowhere.test" } });
        Assert.Equal(HttpStatusCode.BadRequest, unresolved.StatusCode);
    }

    [Fact]
    public async Task Mentions_Reject_Cross_Organization_Users()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgA = await CreateOrganizationAsync(admin);
        var orgB = await CreateOrganizationAsync(admin);
        var outsider = await CreateUserAsync(admin, orgB.OrganizationId, "User");

        var response = await admin.PostAsJsonAsync($"/api/v1/boards/{orgA.DefaultBoardId}/ideas",
            new { title = "Cross-org", description = "d", priority = "Low", mentionEmails = new[] { outsider.Email } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // T031 -------------------------------------------------------------------------------------

    [Fact]
    public async Task Comments_Create_List_Chronologically_Edit_And_Delete()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Discuss", description = "d", priority = "Low" });

        var c1 = await CreateCommentAsync(admin, idea.IdeaId, "First comment");
        var c2 = await CreateCommentAsync(admin, idea.IdeaId, "Second comment");

        var list = await admin.GetFromJsonAsync<PagedResponse<CommentItem>>($"/api/v1/ideas/{idea.IdeaId}/comments", Json);
        Assert.Equal(2, list!.Items.Count);
        Assert.Equal(c1.CommentId, list.Items[0].CommentId);
        Assert.Equal(c2.CommentId, list.Items[1].CommentId);

        var edit = await admin.PutAsJsonAsync($"/api/v1/comments/{c1.CommentId}", new { body = "First comment (edited)" });
        Assert.Equal(HttpStatusCode.OK, edit.StatusCode);

        var delete = await admin.DeleteAsync($"/api/v1/comments/{c2.CommentId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var after = await admin.GetFromJsonAsync<PagedResponse<CommentItem>>($"/api/v1/ideas/{idea.IdeaId}/comments", Json);
        Assert.Single(after!.Items);
    }

    [Fact]
    public async Task Comment_Edit_Is_Author_Only_But_Admin_Can_Delete()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Shared", description = "d", priority = "Low" });

        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);
        var comment = await CreateCommentAsync(authorClient, idea.IdeaId, "Author comment");

        var other = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var otherClient = await LoginAsync(other.Email);

        // A different user cannot edit someone else's comment.
        var foreignEdit = await otherClient.PutAsJsonAsync($"/api/v1/comments/{comment.CommentId}", new { body = "hijacked" });
        Assert.Equal(HttpStatusCode.Forbidden, foreignEdit.StatusCode);

        // A Site Admin (in-scope admin) can delete any comment.
        var adminDelete = await admin.DeleteAsync($"/api/v1/comments/{comment.CommentId}");
        Assert.Equal(HttpStatusCode.NoContent, adminDelete.StatusCode);
    }

    // T032 / T033 ------------------------------------------------------------------------------

    [Fact]
    public async Task Upvote_Toggles_And_Enforces_One_Per_User()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Popular", description = "d", priority = "Low" });

        var member = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var memberClient = await LoginAsync(member.Email);

        var on = await ToggleUpvoteAsync(memberClient, idea.IdeaId);
        Assert.True(on.HasUpvoted);
        Assert.Equal(1, on.UpvoteCount);

        // Toggling again by the same user removes their single upvote (idempotent one-per-user).
        var off = await ToggleUpvoteAsync(memberClient, idea.IdeaId);
        Assert.False(off.HasUpvoted);
        Assert.Equal(0, off.UpvoteCount);

        // Two distinct users each contribute exactly one upvote.
        var readOnly = await CreateUserAsync(admin, org.OrganizationId, "ReadOnly");
        using var readOnlyClient = await LoginAsync(readOnly.Email);
        await ToggleUpvoteAsync(memberClient, idea.IdeaId);
        var second = await ToggleUpvoteAsync(readOnlyClient, idea.IdeaId);
        Assert.Equal(2, second.UpvoteCount);
    }

    // T034 -------------------------------------------------------------------------------------

    [Fact]
    public async Task User_Status_Move_Follows_Board_Configuration()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var statusIds = GetBoardStatusIds(org.DefaultBoardId);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Movable", description = "d", priority = "Low" });

        var member = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var memberClient = await LoginAsync(member.Email);

        // Default board allows User status updates -> a User may move the idea.
        var allowed = await memberClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[1] });
        Assert.Equal(HttpStatusCode.NoContent, allowed.StatusCode);

        // A Read Only user may never move an idea.
        var readOnly = await CreateUserAsync(admin, org.OrganizationId, "ReadOnly");
        using var readOnlyClient = await LoginAsync(readOnly.Email);
        var readOnlyMove = await readOnlyClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[2] });
        Assert.Equal(HttpStatusCode.Forbidden, readOnlyMove.StatusCode);

        // When the board disallows User moves, the User is forbidden but an Org Admin still may.
        SetBoardAllowUserStatusUpdate(org.DefaultBoardId, false);
        var blocked = await memberClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[2] });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
    }

    // T035 -------------------------------------------------------------------------------------

    [Fact]
    public async Task Completed_Idea_Remains_Editable_And_Collaborative()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var completeStatusId = GetStatusIdByName(org.OrganizationId, "Complete");
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Shipping", description = "d", priority = "Low" });

        var move = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = completeStatusId });
        Assert.Equal(HttpStatusCode.NoContent, move.StatusCode);

        var update = await admin.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "Shipping (revised)", description = "revised", priority = "Medium" });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);

        var comment = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments", new { body = "Still discussing." });
        Assert.Equal(HttpStatusCode.Created, comment.StatusCode);

        var upvote = await admin.PostAsync($"/api/v1/ideas/{idea.IdeaId}/upvote/toggle", content: null);
        Assert.Equal(HttpStatusCode.OK, upvote.StatusCode);
    }

    // Permissions / delete ---------------------------------------------------------------------

    [Fact]
    public async Task ReadOnly_Cannot_Create_Or_Edit_But_Can_Comment_And_Upvote()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "RO test", description = "d", priority = "Low" });

        var readOnly = await CreateUserAsync(admin, org.OrganizationId, "ReadOnly");
        using var readOnlyClient = await LoginAsync(readOnly.Email);

        var create = await readOnlyClient.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "nope", description = "d", priority = "Low" });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);

        var edit = await readOnlyClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "nope", description = "d", priority = "Low" });
        Assert.Equal(HttpStatusCode.Forbidden, edit.StatusCode);

        var comment = await readOnlyClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments", new { body = "I can still comment." });
        Assert.Equal(HttpStatusCode.Created, comment.StatusCode);

        var upvote = await readOnlyClient.PostAsync($"/api/v1/ideas/{idea.IdeaId}/upvote/toggle", content: null);
        Assert.Equal(HttpStatusCode.OK, upvote.StatusCode);
    }

    [Fact]
    public async Task Description_Change_Restricted_To_Author_Or_Admin()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);
        var idea = await CreateIdeaAsync(authorClient, org.DefaultBoardId, new { title = "Owned", description = "original", priority = "Low" });

        var other = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var otherClient = await LoginAsync(other.Email);

        // A non-author User can edit non-restricted fields as long as description is unchanged.
        var titleOnly = await otherClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "Owned (retitled)", description = "original", priority = "High" });
        Assert.Equal(HttpStatusCode.OK, titleOnly.StatusCode);

        // But changing the description is restricted to the author or an in-scope admin.
        var descriptionChange = await otherClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "Owned (retitled)", description = "rewritten by someone else", priority = "High" });
        Assert.Equal(HttpStatusCode.Forbidden, descriptionChange.StatusCode);

        // The author may change the description.
        var authorChange = await authorClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "Owned (retitled)", description = "rewritten by author", priority = "High" });
        Assert.Equal(HttpStatusCode.OK, authorChange.StatusCode);
    }

    [Fact]
    public async Task Assignee_Collection_Is_Validated()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var assignees = new List<Guid>();
        for (var i = 0; i < 6; i++)
        {
            assignees.Add((await CreateUserAsync(admin, org.OrganizationId, "User")).UserId);
        }

        // More than five assignees is rejected.
        var tooMany = await admin.PostAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas",
            new { title = "Crowded", description = "d", priority = "Low", assigneeUserIds = assignees });
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);

        // A valid set of assignees is accepted and surfaced on detail.
        var valid = assignees.Take(3).ToList();
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Assigned", description = "d", priority = "Low", assigneeUserIds = valid });
        var detail = await admin.GetFromJsonAsync<IdeaDetailResponse>($"/api/v1/ideas/{idea.IdeaId}", Json);
        Assert.Equal(3, detail!.Assignees.Count);
    }

    [Fact]
    public async Task Idea_Delete_Is_Admin_Only_And_Excludes_From_Queries()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Doomed", description = "d", priority = "Low" });

        var member = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var memberClient = await LoginAsync(member.Email);

        // A plain User cannot delete ideas.
        var forbidden = await memberClient.DeleteAsync($"/api/v1/ideas/{idea.IdeaId}");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // An Org Admin can, and the idea then disappears from detail and list queries.
        var orgAdmin = await CreateUserAsync(admin, org.OrganizationId, "OrgAdmin");
        using var orgAdminClient = await LoginAsync(orgAdmin.Email);
        var deleted = await orgAdminClient.DeleteAsync($"/api/v1/ideas/{idea.IdeaId}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        var detail = await admin.GetAsync($"/api/v1/ideas/{idea.IdeaId}");
        Assert.Equal(HttpStatusCode.NotFound, detail.StatusCode);

        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>($"/api/v1/boards/{org.DefaultBoardId}/ideas?pageSize=100", Json);
        Assert.DoesNotContain(list!.Items, i => i.IdeaId == idea.IdeaId);
    }

    [Fact]
    public async Task Idea_In_Other_Organization_Is_Not_Found_For_Scoped_User()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgA = await CreateOrganizationAsync(admin);
        var orgB = await CreateOrganizationAsync(admin);
        var ideaInA = await CreateIdeaAsync(admin, orgA.DefaultBoardId, new { title = "Secret", description = "d", priority = "Low" });

        var outsider = await CreateUserAsync(admin, orgB.OrganizationId, "User");
        using var outsiderClient = await LoginAsync(outsider.Email);

        var response = await outsiderClient.GetAsync($"/api/v1/ideas/{ideaInA.IdeaId}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // Helpers -----------------------------------------------------------------------------------

    private async Task<IdeaCreatedResponse> CreateIdeaAsync(HttpClient client, Guid boardId, object body)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/boards/{boardId}/ideas", body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json))!;
    }

    private async Task<CommentCreatedResponse> CreateCommentAsync(HttpClient client, Guid ideaId, string commentBody)
    {
        var response = await client.PostAsJsonAsync($"/api/v1/ideas/{ideaId}/comments", new { body = commentBody });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CommentCreatedResponse>(Json))!;
    }

    private async Task<UpvoteResponse> ToggleUpvoteAsync(HttpClient client, Guid ideaId)
    {
        var response = await client.PostAsync($"/api/v1/ideas/{ideaId}/upvote/toggle", content: null);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UpvoteResponse>(Json))!;
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient admin)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Collaboration test organization."
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private async Task<CreatedUser> CreateUserAsync(HttpClient admin, Guid organizationId, string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@collab.test";
        var response = await admin.PostAsJsonAsync($"/api/v1/organizations/{organizationId}/users", new
        {
            firstName = "Test",
            lastName = role,
            email,
            role,
            initialPassword = StrongPassword
        });
        response.EnsureSuccessStatusCode();
        var created = (await response.Content.ReadFromJsonAsync<CreateUserResponse>(Json))!;
        return new CreatedUser(created.UserId, email);
    }

    /// <summary>Logs in a freshly created user, performing the forced first-login password change.</summary>
    private async Task<HttpClient> LoginAsync(string email)
    {
        var client = _factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = StrongPassword });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;

        if (body.RequiresPasswordChange)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
            var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword = StrongPassword, newPassword = ChangedPassword });
            change.EnsureSuccessStatusCode();

            var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = ChangedPassword });
            reLogin.EnsureSuccessStatusCode();
            body = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        }

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
        return client;
    }

    private static async Task AuthenticateAsSiteAdminAsync(HttpClient client)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "siteadmin@collega.test", password = "Test123!Password" });
        login.EnsureSuccessStatusCode();
        var body = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body!.AccessToken);
    }

    private List<Guid> GetBoardStatusIds(Guid boardId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        var board = db.Boards.Include(b => b.Swimlanes).First(b => b.Id == boardId);
        return board.Swimlanes.OrderBy(s => s.DisplayOrder).Select(s => s.StatusId).ToList();
    }

    private Guid GetStatusIdByName(Guid organizationId, string name)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        return db.Statuses.First(s => s.OrganizationId == organizationId && s.Name == name).Id;
    }

    private void SetBoardAllowUserStatusUpdate(Guid boardId, bool allow)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        var board = db.Boards.First(b => b.Id == boardId);
        db.Entry(board).Property(b => b.AllowUserStatusUpdate).CurrentValue = allow;
        db.SaveChanges();
    }

    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record CreateUserResponse(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);
    private sealed record CreatedUser(Guid UserId, string Email);
    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record IdeaCreatedResponse(Guid IdeaId, Guid BoardId, Guid StatusId, string Title, string Priority, string? DueDate);
    private sealed record IdeaListItemResponse(Guid IdeaId, string Title, Guid StatusId);
    private sealed record AssigneeItem(Guid UserId, bool IsActive);
    private sealed record IdeaDetailResponse(
        Guid IdeaId,
        string Title,
        string Description,
        string Priority,
        Guid StatusId,
        IReadOnlyList<string> TagNames,
        IReadOnlyList<AssigneeItem> Assignees,
        int UpvoteCount,
        bool HasUpvoted,
        int CommentCount);
    private sealed record CommentCreatedResponse(Guid CommentId, Guid IdeaId);
    private sealed record CommentItem(Guid CommentId, Guid IdeaId, Guid AuthorUserId, string Body, DateTime CreatedAtUtc, DateTime UpdatedAtUtc);
    private sealed record UpvoteResponse(Guid IdeaId, bool HasUpvoted, int UpvoteCount);
    private sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount);
}
