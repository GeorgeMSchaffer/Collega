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
            WithClassification(new { title = "Mentioned", description = "d", priority = "Low", mentionEmails = new[] { member.Email } }, org.OrganizationId));
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
            WithClassification(new { title = "Shipping (revised)", description = "revised", priority = "Medium" }, org.OrganizationId));
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
            WithClassification(new { title = "Owned (retitled)", description = "original", priority = "High" }, org.OrganizationId));
        Assert.Equal(HttpStatusCode.OK, titleOnly.StatusCode);

        // But changing the description is restricted to the author or an in-scope admin.
        var descriptionChange = await otherClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            new { title = "Owned (retitled)", description = "rewritten by someone else", priority = "High" });
        Assert.Equal(HttpStatusCode.Forbidden, descriptionChange.StatusCode);

        // The author may change the description.
        var authorChange = await authorClient.PutAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}",
            WithClassification(new { title = "Owned (retitled)", description = "rewritten by author", priority = "High" }, org.OrganizationId));
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
    public async Task Members_Endpoint_Lets_Plain_User_List_Assignable_Members()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        var teammate = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);

        // The admin user listing stays Org-Admin+, so a plain User is forbidden there...
        var forbidden = await authorClient.GetAsync($"/api/v1/organizations/{org.OrganizationId}/users");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);

        // ...but the minimal members endpoint is readable and populates the assignee picker.
        var members = await authorClient.GetFromJsonAsync<List<MemberItem>>(
            $"/api/v1/organizations/{org.OrganizationId}/members", Json);

        Assert.NotNull(members);
        Assert.Contains(members!, m => m.UserId == author.UserId);
        Assert.Contains(members!, m => m.UserId == teammate.UserId);
        Assert.All(members!, m => Assert.False(string.IsNullOrWhiteSpace(m.Email)));
    }

    [Fact]
    public async Task Members_Endpoint_Is_Scoped_To_Caller_Organization()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var orgA = await CreateOrganizationAsync(admin);
        var orgB = await CreateOrganizationAsync(admin);
        var outsider = await CreateUserAsync(admin, orgB.OrganizationId, "User");
        using var outsiderClient = await LoginAsync(outsider.Email);

        // A User in org B cannot read org A's members — 404 rather than leaking the org's existence.
        var response = await outsiderClient.GetAsync($"/api/v1/organizations/{orgA.OrganizationId}/members");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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

    // T059 --------------------------------------------------------------------------------------

    [Fact]
    public async Task OrganizationIdeas_WithPagingParams_AndNoFieldFilters_Succeeds()
    {
        // Regression: the fieldFilters query parsing must not choke on the page/pageSize/sortDirection
        // params the client always sends when no field filters are applied.
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Plain list idea", description = "d", priority = "Low" });

        using var response = await admin.GetAsync($"/api/v1/organizations/{org.OrganizationId}/ideas?page=1&pageSize=25&sortDirection=desc");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task OrganizationIdeas_Filters_By_Field_Value_And_Ignores_Unknown_Keys()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // A Text custom field, then two ideas carrying different values for it.
        var fieldResponse = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/field-definitions",
            new { name = "Team", fieldType = "Text", isRequired = false, displayOrder = 10, options = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.Created, fieldResponse.StatusCode);
        var field = (await fieldResponse.Content.ReadFromJsonAsync<FieldDefResponse>(Json))!;

        await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Platform idea", description = "d", priority = "Low", fieldValues = new[] { new { fieldDefinitionId = field.FieldDefinitionId, value = "Platform Team" } } });
        await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Design idea", description = "d", priority = "Low", fieldValues = new[] { new { fieldDefinitionId = field.FieldDefinitionId, value = "Design Team" } } });

        // Contains filter on the Text field returns only the matching idea.
        var filtered = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?fieldFilters%5B{field.FieldDefinitionId}%5D=platform", Json);
        Assert.Equal("Platform idea", Assert.Single(filtered!.Items).Title);

        // An unknown fieldDefinitionId key is silently ignored (both ideas returned).
        var unknown = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?fieldFilters%5B{Guid.NewGuid()}%5D=whatever", Json);
        Assert.Equal(2, unknown!.TotalCount);
    }

    // Sprint 3: all-column search, tag filter, user-association filter, server-side sort ----------

    [Fact]
    public async Task OrganizationIdeas_FiltersByTag()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Tagged idea", description = "d", priority = "Low", tagNames = new[] { "Roadmap" } });
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Plain idea", description = "d", priority = "Low" });

        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?tag=roadmap", Json);

        Assert.Equal("Tagged idea", Assert.Single(list!.Items).Title);
    }

    [Fact]
    public async Task OrganizationIdeas_FiltersByAssociatedUser_MatchesAuthorOrAssignee()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var member = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var memberClient = await LoginAsync(member.Email);

        await CreateIdeaAsync(memberClient, org.DefaultBoardId, new { title = "Member authored", description = "d", priority = "Low" });
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Assigned to member", description = "d", priority = "Low", assigneeUserIds = new[] { member.UserId } });
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Unrelated", description = "d", priority = "Low" });

        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?user={member.UserId}&pageSize=100", Json);

        Assert.Equal(2, list!.TotalCount);
        Assert.DoesNotContain(list.Items, i => i.Title == "Unrelated");
    }

    [Fact]
    public async Task OrganizationIdeas_Search_MatchesAuthorName()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        var member = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var memberClient = await LoginAsync(member.Email);
        await CreateIdeaAsync(memberClient, org.DefaultBoardId, new { title = "Member idea", description = "d", priority = "Low" });
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Admin idea", description = "d", priority = "Low" });

        // CreateUserAsync names members "Test <Role>"; the seeded Site Admin is "Site Admin", so a search
        // for "Test" matches only the member-authored idea.
        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?search=Test&pageSize=100", Json);

        Assert.Contains(list!.Items, i => i.Title == "Member idea");
        Assert.DoesNotContain(list.Items, i => i.Title == "Admin idea");
    }

    [Fact]
    public async Task OrganizationIdeas_SortsByTitle_ServerSide()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Zebra", description = "d", priority = "Low" });
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Apple", description = "d", priority = "Low" });

        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?sortBy=title&sortDirection=asc&pageSize=100", Json);

        Assert.Equal(new[] { "Apple", "Zebra" }, list!.Items.Select(i => i.Title).ToArray());
    }

    [Fact]
    public async Task Idea_Csv_Export_Then_Import_RoundTrips_And_Rejects_Bad_Rows()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Seed idea", description = "Has, a comma", priority = "High" });

        // Export returns CSV with the seeded idea and the required classification columns populated.
        using var export = await admin.GetAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas/export");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        Assert.Equal("text/csv", export.Content.Headers.ContentType?.MediaType);
        var csv = await export.Content.ReadAsStringAsync();
        Assert.Contains("Idea Type", csv);
        Assert.Contains("Seed idea", csv);
        Assert.Contains("\"Has, a comma\"", csv); // comma-bearing description is quoted

        // Import: one valid row (create-only) + one row with an unknown Idea Type (rejected).
        var importCsv =
            "Title,Description,Priority,Idea Type,Business Impact,Status\n"
            + "Imported idea,From CSV,Medium,Continuous Improvement,High,\n"
            + "Bad idea,Nope,Low,Nonexistent Type,High,\n";
        var result = await ImportIdeasAsync(admin, org.DefaultBoardId, importCsv);

        Assert.Equal(1, result.CreatedCount);
        Assert.Equal(1, result.RejectedCount);
        Assert.Contains(result.Rows, r => r.Outcome == "Created" && r.Title == "Imported idea");
        Assert.Contains(result.Rows, r => r.Outcome == "Rejected" && r.Error!.Contains("Idea Type"));

        // The created idea is now listed on the board.
        var list = await admin.GetFromJsonAsync<PagedResponse<IdeaListItemResponse>>(
            $"/api/v1/organizations/{org.OrganizationId}/ideas?search=Imported", Json);
        Assert.Equal("Imported idea", Assert.Single(list!.Items).Title);
    }

    [Fact]
    public async Task Idea_Csv_Import_MissingFile_Returns400()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        using var empty = new MultipartFormDataContent();
        using var response = await admin.PostAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas/import", empty);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Idea_Csv_RoundTrips_Udf_Columns_And_Rejects_Bad_Option()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // A Dropdown UDF with two options.
        var fieldResponse = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/field-definitions",
            new
            {
                name = "Area",
                fieldType = "Dropdown",
                isRequired = false,
                displayOrder = 10,
                options = new[] { new { label = "Frontend", displayOrder = 10 }, new { label = "Backend", displayOrder = 20 } },
            });
        Assert.Equal(HttpStatusCode.Created, fieldResponse.StatusCode);

        // Import references the option by label; an unknown label is rejected.
        var importCsv =
            "Title,Description,Priority,Idea Type,Business Impact,Area\n"
            + "Area idea,d,Low,Continuous Improvement,High,Backend\n"
            + "Bad area,d,Low,Continuous Improvement,High,Nowhere\n";
        var result = await ImportIdeasAsync(admin, org.DefaultBoardId, importCsv);

        Assert.Equal(1, result.CreatedCount);
        Assert.Equal(1, result.RejectedCount);
        Assert.Contains(result.Rows, r => r.Outcome == "Rejected" && r.Error!.Contains("Area"));

        // Export renders the UDF column header and the resolved option label (not the id).
        using var export = await admin.GetAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas/export");
        var csv = await export.Content.ReadAsStringAsync();
        Assert.Contains("Area", csv);
        Assert.Contains("Backend", csv);
        Assert.Contains("Area idea", csv);
    }

    [Fact]
    public async Task Idea_Csv_Excludes_Udf_Named_Like_A_Core_Column()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // A UDF whose name collides with the core "Priority" column.
        var field = await admin.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/field-definitions",
            new { name = "Priority", fieldType = "Text", isRequired = false, displayOrder = 10, options = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.Created, field.StatusCode);

        await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Seed", description = "d", priority = "Low" });

        // Export must not duplicate the core Priority column with the collided UDF.
        using var export = await admin.GetAsync($"/api/v1/boards/{org.DefaultBoardId}/ideas/export");
        var csv = await export.Content.ReadAsStringAsync();
        var headerLine = csv.Replace("﻿", string.Empty).Split('\n')[0].TrimEnd('\r');
        Assert.Equal(1, headerLine.Split(',').Count(c => c == "Priority"));

        // Import with a Priority column still creates, using it as the core priority (UDF ignored).
        var result = await ImportIdeasAsync(admin, org.DefaultBoardId,
            "Title,Description,Priority,Idea Type,Business Impact\nImported,d,Low,Continuous Improvement,High\n");
        Assert.Equal(1, result.CreatedCount);
        Assert.Equal(0, result.RejectedCount);
    }

    private async Task<ImportResult> ImportIdeasAsync(HttpClient client, Guid boardId, string csvContent)
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes(csvContent));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "csvFile", "ideas.csv");

        var response = await client.PostAsync($"/api/v1/boards/{boardId}/ideas/import", content);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ImportResult>(Json))!;
    }

    private sealed record ImportResult(int CreatedCount, int RejectedCount, IReadOnlyList<ImportRowResult> Rows);
    private sealed record ImportRowResult(int RowNumber, string? Title, string Outcome, string? Error);

    private sealed record FieldDefResponse(Guid FieldDefinitionId, string Name, string FieldType);

    private async Task<IdeaCreatedResponse> CreateIdeaAsync(HttpClient client, Guid boardId, object body)
    {
        var payload = WithClassification(body, OrganizationIdForBoard(boardId));
        var response = await client.PostAsJsonAsync($"/api/v1/boards/{boardId}/ideas", payload);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json))!;
    }

    /// <summary>
    /// Idea create/update now require an active Idea Type and Business Impact reference. This merges the
    /// organization's canonical defaults into an idea request body unless the test supplied its own.
    /// </summary>
    private Dictionary<string, object?> WithClassification(object body, Guid organizationId)
    {
        var (ideaTypeId, businessImpactId) = DefaultClassification(organizationId);
        var dict = JsonSerializer
            .Deserialize<Dictionary<string, JsonElement>>(JsonSerializer.Serialize(body, Json), Json)!
            .ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
        dict.TryAdd("ideaTypeId", ideaTypeId);
        dict.TryAdd("businessImpactId", businessImpactId);
        return dict;
    }

    private (Guid IdeaTypeId, Guid BusinessImpactId) DefaultClassification(Guid organizationId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        var ideaTypeId = db.IdeaTypes.Where(t => t.OrganizationId == organizationId && !t.IsDeleted)
            .OrderBy(t => t.SortOrder).Select(t => t.Id).First();
        var businessImpactId = db.BusinessImpacts.Where(b => b.OrganizationId == organizationId && !b.IsDeleted)
            .OrderBy(b => b.SortOrder).Select(b => b.Id).First();
        return (ideaTypeId, businessImpactId);
    }

    private Guid OrganizationIdForBoard(Guid boardId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        return db.Boards.Where(b => b.Id == boardId).Select(b => b.OrganizationId).First();
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
    private sealed record MemberItem(Guid UserId, string FirstName, string LastName, string Email);
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
