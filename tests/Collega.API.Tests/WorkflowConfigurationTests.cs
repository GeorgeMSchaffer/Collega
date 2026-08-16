using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the Workflow Configuration slice (T020-T024) through the real request
/// pipeline: status create/list/update/soft-delete with the 2-active-status floor and the
/// board-reference guard, and board create/detail/update/reorder with the 2-swimlane minimum and
/// status-subset support. Mirrors the style of <see cref="TenantAdministrationTests"/>.
/// </summary>
public sealed class WorkflowConfigurationTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly CollegaApiFactory _factory;

    public WorkflowConfigurationTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    // ---- Status: T020 ----

    [Fact]
    public async Task SiteAdmin_Creates_And_Lists_Custom_Status()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Contoso Statuses", "Status CRUD org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var defaults = await ListStatusesAsync(client, org.OrganizationId);
        Assert.Equal(5, defaults.Count); // the 5 canonical default statuses

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/statuses", new
        {
            name = "Blocked",
            color = "#EF4444",
            sortOrder = 60
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreateStatusResponse>(Json);
        Assert.NotNull(created);
        Assert.Equal("Blocked", created!.Name);
        Assert.Equal("#EF4444", created.Color);
        Assert.Equal(60, created.SortOrder);

        var after = await ListStatusesAsync(client, org.OrganizationId);
        Assert.Equal(6, after.Count);
        Assert.Contains(after, s => s.StatusId == created.StatusId && s.Name == "Blocked");
    }

    [Fact]
    public async Task Status_Create_Defaults_Color_And_Appends_SortOrder_When_Omitted()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Fabrikam Statuses", "Defaulting org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/statuses", new
        {
            name = "Deferred"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<CreateStatusResponse>(Json);

        Assert.False(string.IsNullOrWhiteSpace(created!.Color)); // fell back to the neutral color
        Assert.True(created.SortOrder > 50); // appended after the 5 defaults (10..50)
    }

    [Fact]
    public async Task Status_Update_Renames_Recolors_And_Reorders()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Tailspin Statuses", "Update org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var statuses = await ListStatusesAsync(client, org.OrganizationId);
        var target = statuses[0];

        var update = await client.PutAsJsonAsync($"/api/v1/statuses/{target.StatusId}", new
        {
            name = "Triage",
            color = "#111827",
            sortOrder = 5
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<StatusItemResponse>(Json);
        Assert.Equal("Triage", updated!.Name);
        Assert.Equal("#111827", updated.Color);
        Assert.Equal(5, updated.SortOrder);
    }

    [Fact]
    public async Task Status_Delete_Rejected_When_Referenced_By_A_Board()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Northwind Statuses", "Reference guard org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        // The default board opens with all 5 statuses as swimlanes, so every status is referenced.
        var statuses = await ListStatusesAsync(client, org.OrganizationId);
        var referenced = statuses[2];

        var delete = await client.DeleteAsync($"/api/v1/statuses/{referenced.StatusId}");
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);

        // Still active after the rejected delete.
        var after = await ListStatusesAsync(client, org.OrganizationId);
        Assert.Contains(after, s => s.StatusId == referenced.StatusId);
    }

    [Fact]
    public async Task Status_Delete_Succeeds_When_Unreferenced_And_Above_Floor()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Wingtip Statuses", "Soft-delete org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var statuses = await ListStatusesAsync(client, org.OrganizationId);
        // Shrink the default board to the first two statuses so statuses[2..4] become unreferenced.
        await SetDefaultBoardSwimlanesAsync(client, org.DefaultBoardId, statuses.Take(2));

        var toDelete = statuses[2];
        var delete = await client.DeleteAsync($"/api/v1/statuses/{toDelete.StatusId}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var active = await ListStatusesAsync(client, org.OrganizationId);
        Assert.DoesNotContain(active, s => s.StatusId == toDelete.StatusId);

        // It remains as a soft-deleted row when archived statuses are requested (rule #8).
        var withDeleted = await ListStatusesAsync(client, org.OrganizationId, includeDeleted: true);
        Assert.Contains(withDeleted, s => s.StatusId == toDelete.StatusId && s.IsDeleted);
    }

    [Fact]
    public async Task Status_Delete_Rejected_At_Two_Active_Minimum()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Adventure Statuses", "Floor org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);

        var statuses = await ListStatusesAsync(client, org.OrganizationId);
        var first = statuses[0];
        var second = statuses[1];

        // Free statuses[2..4] by pointing the board at only the first two, then delete them down to 2.
        await SetDefaultBoardSwimlanesAsync(client, org.DefaultBoardId, new[] { first, second });
        foreach (var s in statuses.Skip(2))
        {
            var d = await client.DeleteAsync($"/api/v1/statuses/{s.StatusId}");
            Assert.Equal(HttpStatusCode.NoContent, d.StatusCode);
        }

        var active = await ListStatusesAsync(client, org.OrganizationId);
        Assert.Equal(2, active.Count);

        // Deleting either remaining status would drop the org below the 2-active floor (rule #7).
        var delete = await client.DeleteAsync($"/api/v1/statuses/{first.StatusId}");
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);
    }

    // ---- Board: T021-T024 ----

    [Fact]
    public async Task Board_Create_Requires_At_Least_Two_Swimlanes()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Contoso Boards", "Min-swimlane org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var statuses = await ListStatusesAsync(client, org.OrganizationId);

        var tooFew = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards", new
        {
            name = "Solo",
            allowUserStatusUpdate = true,
            swimlanes = new[] { new { statusId = statuses[0].StatusId, order = 0 } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, tooFew.StatusCode);

        var ok = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards", new
        {
            name = "Roadmap",
            allowUserStatusUpdate = true,
            swimlanes = new[]
            {
                new { statusId = statuses[0].StatusId, order = 0 },
                new { statusId = statuses[1].StatusId, order = 1 }
            }
        });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        var created = await ok.Content.ReadFromJsonAsync<CreateBoardResponse>(Json);
        Assert.Equal(2, created!.Swimlanes.Count);
    }

    [Fact]
    public async Task Board_Create_Rejects_Status_From_Another_Organization()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var orgA = await CreateOrganizationAsync(client, "Org A Boards", "Board org A.");
        var orgB = await CreateOrganizationAsync(client, "Org B Boards", "Board org B.");

        // Read as the Site Admin: rule 25 restricts mutation only, and the Site Admin is the one
        // actor that can see both organizations' statuses — an Org Admin of either sees just its own.
        var statusesA = await ListStatusesAsync(client, orgA.OrganizationId);
        var statusesB = await ListStatusesAsync(client, orgB.OrganizationId);

        // The create itself must run as an in-scope Org Admin of orgA, so that what the endpoint
        // rejects is the foreign status in the swimlane rather than the caller's identity.
        await ViewAsAuth.ActAsOrgAdminAsync(client, orgA.OrganizationId);

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{orgA.OrganizationId}/boards", new
        {
            name = "Cross-org",
            allowUserStatusUpdate = false,
            swimlanes = new[]
            {
                new { statusId = statusesA[0].StatusId, order = 0 },
                new { statusId = statusesB[0].StatusId, order = 1 } // foreign status
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
    }

    [Fact]
    public async Task Board_Update_Supports_A_Subset_Of_Organization_Statuses()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Subset Boards", "Subset org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var statuses = await ListStatusesAsync(client, org.OrganizationId);

        // Default board starts with all 5 statuses; narrow it to 3.
        var subset = statuses.Take(3).ToList();
        var update = await client.PutAsJsonAsync($"/api/v1/boards/{org.DefaultBoardId}", new
        {
            name = "Ideas",
            allowUserStatusUpdate = true,
            swimlanes = subset.Select((s, i) => new { statusId = s.StatusId, order = i }).ToArray()
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<BoardDetailResponse>(Json);
        Assert.Equal(3, updated!.Swimlanes.Count);

        var detail = await client.GetFromJsonAsync<BoardDetailResponse>($"/api/v1/boards/{org.DefaultBoardId}", Json);
        Assert.Equal(3, detail!.Swimlanes.Count);
        Assert.All(detail.Swimlanes, sl => Assert.Contains(subset, s => s.StatusId == sl.StatusId));
    }

    [Fact]
    public async Task Board_Swimlane_Reorder_Is_Persisted()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Reorder Boards", "Reorder org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var statuses = await ListStatusesAsync(client, org.OrganizationId);

        var s0 = statuses[0];
        var s1 = statuses[1];
        var s2 = statuses[2];

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards", new
        {
            name = "Delivery",
            allowUserStatusUpdate = true,
            swimlanes = new[]
            {
                new { statusId = s0.StatusId, order = 0 },
                new { statusId = s1.StatusId, order = 1 },
                new { statusId = s2.StatusId, order = 2 }
            }
        });
        var board = await create.Content.ReadFromJsonAsync<CreateBoardResponse>(Json);

        // Reorder to s2, s0, s1 (same set, new positions) — must be saved immediately (T024).
        var reorder = await client.PostAsJsonAsync($"/api/v1/boards/{board!.BoardId}/swimlanes/reorder", new
        {
            swimlanes = new[]
            {
                new { statusId = s2.StatusId, order = 0 },
                new { statusId = s0.StatusId, order = 1 },
                new { statusId = s1.StatusId, order = 2 }
            }
        });
        Assert.Equal(HttpStatusCode.NoContent, reorder.StatusCode);

        var detail = await client.GetFromJsonAsync<BoardDetailResponse>($"/api/v1/boards/{board.BoardId}", Json);
        var ordered = detail!.Swimlanes.OrderBy(sl => sl.Order).Select(sl => sl.StatusId).ToList();
        Assert.Equal(new[] { s2.StatusId, s0.StatusId, s1.StatusId }, ordered);
    }

    [Fact]
    public async Task Board_Reorder_Rejected_When_Set_Does_Not_Match_Current_Swimlanes()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "Reorder Guard Boards", "Reorder guard org.");
        await ViewAsAuth.ActAsOrgAdminAsync(client, org.OrganizationId);
        var statuses = await ListStatusesAsync(client, org.OrganizationId);

        var create = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/boards", new
        {
            name = "Guarded",
            allowUserStatusUpdate = false,
            swimlanes = new[]
            {
                new { statusId = statuses[0].StatusId, order = 0 },
                new { statusId = statuses[1].StatusId, order = 1 }
            }
        });
        var board = await create.Content.ReadFromJsonAsync<CreateBoardResponse>(Json);

        // A reorder cannot add a status that isn't already a swimlane.
        var reorder = await client.PostAsJsonAsync($"/api/v1/boards/{board!.BoardId}/swimlanes/reorder", new
        {
            swimlanes = new[]
            {
                new { statusId = statuses[0].StatusId, order = 0 },
                new { statusId = statuses[2].StatusId, order = 1 }
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, reorder.StatusCode);
    }

    [Fact]
    public async Task Board_List_Returns_Default_Board_With_Swimlane_Count()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "List Boards", "List org.");

        var boards = await client.GetFromJsonAsync<IReadOnlyList<BoardListItemResponse>>($"/api/v1/organizations/{org.OrganizationId}/boards", Json);
        Assert.NotNull(boards);
        var defaultBoard = Assert.Single(boards!);
        Assert.Equal(org.DefaultBoardId, defaultBoard.BoardId);
        Assert.Equal(5, defaultBoard.SwimlaneCount); // opens with all 5 default statuses
    }

    // ---- Authorization ----

    [Fact]
    public async Task Non_Admin_User_Cannot_Create_Status()
    {
        using var client = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(client);
        var org = await CreateOrganizationAsync(client, "RBAC Statuses", "RBAC org.");

        var userEmail = $"user-{Guid.NewGuid():N}@rbac.test";
        const string password = "Str0ng!Pass";
        var createUser = await client.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/users", new
        {
            firstName = "Casey",
            lastName = "Ng",
            email = userEmail,
            role = "User",
            initialPassword = password
        });
        Assert.Equal(HttpStatusCode.Created, createUser.StatusCode);

        using var userClient = _factory.CreateClient();
        await LoginAndForcePasswordChangeAsync(userClient, userEmail, password, "N3w!Passw0rd");

        var create = await userClient.PostAsJsonAsync($"/api/v1/organizations/{org.OrganizationId}/statuses", new
        {
            name = "Sneaky"
        });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
    }

    // ---- Helpers ----

    private async Task<IReadOnlyList<StatusItemResponse>> ListStatusesAsync(HttpClient client, Guid organizationId, bool includeDeleted = false)
    {
        var url = $"/api/v1/organizations/{organizationId}/statuses";
        if (includeDeleted)
        {
            url += "?includeDeleted=true";
        }

        var result = await client.GetFromJsonAsync<IReadOnlyList<StatusItemResponse>>(url, Json);
        return result!;
    }

    private async Task SetDefaultBoardSwimlanesAsync(HttpClient client, Guid boardId, IEnumerable<StatusItemResponse> statuses)
    {
        var swimlanes = statuses.Select((s, i) => new { statusId = s.StatusId, order = i }).ToArray();
        var update = await client.PutAsJsonAsync($"/api/v1/boards/{boardId}", new
        {
            name = "Ideas",
            allowUserStatusUpdate = true,
            swimlanes
        });
        update.EnsureSuccessStatusCode();
    }

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient client, string title, string description)
    {
        // Bootstrap runs as the Site Admin, so any session left open by a previous test in this
        // class must be closed first — sessions are non-nestable and outlive a single test because
        // the InMemory database is shared. Exit is idempotent by contract, so this is safe
        // unconditionally.
        await ViewAsAuth.StopActingAsync(client);
        var response = await client.PostAsJsonAsync("/api/v1/organizations", new { title, description });
        response.EnsureSuccessStatusCode();
        // Leaves the client acting as the Site Admin. Rule 25 means the caller cannot yet mutate
        // this organization's content — a test that needs to must opt in with an explicit
        // ViewAsAuth.ActAsOrgAdminAsync naming the organization it means. See ViewAsAuth's remarks
        // for why this is opt-in rather than automatic.
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private static async Task LoginAndForcePasswordChangeAsync(HttpClient client, string email, string currentPassword, string newPassword)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = currentPassword });
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginBody!.AccessToken);

        if (loginBody.RequiresPasswordChange)
        {
            var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword, newPassword });
            change.EnsureSuccessStatusCode();

            var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password = newPassword });
            var reBody = await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reBody!.AccessToken);
        }
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record StatusItemResponse(Guid StatusId, Guid OrganizationId, string Name, string Color, int SortOrder, bool IsDeleted);
    private sealed record CreateStatusResponse(Guid StatusId, string Name, string Color, int SortOrder);
    private sealed record BoardListItemResponse(Guid BoardId, Guid OrganizationId, string Name, bool AllowUserStatusUpdate, int SwimlaneCount);
    private sealed record SwimlaneDetailResponse(Guid StatusId, string StatusName, string StatusColor, int Order, bool StatusIsDeleted);
    private sealed record BoardDetailResponse(Guid BoardId, Guid OrganizationId, string Name, bool AllowUserStatusUpdate, IReadOnlyList<SwimlaneDetailResponse> Swimlanes);
    private sealed record CreateBoardResponse(Guid BoardId, string Name, IReadOnlyList<SwimlaneDetailResponse> Swimlanes);
}
