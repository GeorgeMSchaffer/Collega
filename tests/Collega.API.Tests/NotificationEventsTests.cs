using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;
using Collega.Domain.Notifications;
using Collega.Infrastructure.Notifications;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the Events slice (T037-T039): a notification event is persisted for each
/// collaboration trigger (idea mention, comment mention, idea comment, idea status change), every row
/// carries the canonical <c>/ideas/{ideaId}/edit</c> link (T038), self-notifications are suppressed,
/// and the notification path performs no outbound delivery (T039). Events have no read API in MVP, so
/// assertions query the InMemory <see cref="CollegaDbContext"/> directly.
/// </summary>
public sealed class NotificationEventsTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string StrongPassword = "Str0ng!Pass";
    private const string ChangedPassword = "N3w!Passw0rd";

    private readonly CollegaApiFactory _factory;

    public NotificationEventsTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    // T037 / T038: idea mention ------------------------------------------------------------------

    [Fact]
    public async Task Idea_Mention_Persists_Event_With_Canonical_Link()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var mentioned = await CreateUserAsync(admin, org.OrganizationId, "User");

        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Mention me", description = "d", priority = "Low", mentionEmails = new[] { mentioned.Email } });

        var events = GetEvents(idea.IdeaId, NotificationEventType.IdeaMention);
        var evt = Assert.Single(events);
        Assert.Equal(mentioned.UserId, evt.RecipientUserId);
        Assert.Equal($"/ideas/{idea.IdeaId}/edit", evt.Link);
        Assert.Equal(idea.IdeaId, evt.IdeaId);
        Assert.Equal(org.OrganizationId, evt.OrganizationId);
    }

    // T037 / T038: comment mention ---------------------------------------------------------------

    [Fact]
    public async Task Comment_Mention_Persists_Event_With_Canonical_Link()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var mentioned = await CreateUserAsync(admin, org.OrganizationId, "User");
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId, new { title = "Discuss", description = "d", priority = "Low" });

        var comment = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments",
            new { body = "Ping", mentionEmails = new[] { mentioned.Email } });
        comment.EnsureSuccessStatusCode();

        var events = GetEvents(idea.IdeaId, NotificationEventType.CommentMention);
        var evt = Assert.Single(events);
        Assert.Equal(mentioned.UserId, evt.RecipientUserId);
        Assert.Equal($"/ideas/{idea.IdeaId}/edit", evt.Link);
    }

    // T037 / T038: idea comment (notifies author + assignees) ------------------------------------

    [Fact]
    public async Task Comment_Added_Notifies_Idea_Author_With_Canonical_Link()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);

        // The idea author differs from the commenter so there is a non-suppressed recipient.
        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);
        var idea = await CreateIdeaAsync(authorClient, org.DefaultBoardId, new { title = "Owned", description = "d", priority = "Low" });

        var comment = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments", new { body = "Nice idea" });
        comment.EnsureSuccessStatusCode();

        var events = GetEvents(idea.IdeaId, NotificationEventType.CommentAdded);
        var evt = Assert.Single(events);
        Assert.Equal(author.UserId, evt.RecipientUserId);
        Assert.Equal($"/ideas/{idea.IdeaId}/edit", evt.Link);
    }

    // T037 / T038: idea status change (notifies author + assignees) ------------------------------

    [Fact]
    public async Task Status_Change_Notifies_Idea_Author_With_Canonical_Link()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var statusIds = GetBoardStatusIds(org.DefaultBoardId);

        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);
        var idea = await CreateIdeaAsync(authorClient, org.DefaultBoardId, new { title = "Movable", description = "d", priority = "Low" });

        // A different actor (Site Admin) moves the idea, so the author receives the notification.
        var move = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[1] });
        move.EnsureSuccessStatusCode();

        var events = GetEvents(idea.IdeaId, NotificationEventType.IdeaStatusChanged);
        var evt = Assert.Single(events);
        Assert.Equal(author.UserId, evt.RecipientUserId);
        Assert.Equal($"/ideas/{idea.IdeaId}/edit", evt.Link);
    }

    [Fact]
    public async Task Status_Change_Notifies_Assignees()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var statusIds = GetBoardStatusIds(org.DefaultBoardId);
        var assignee = await CreateUserAsync(admin, org.OrganizationId, "User");

        // Admin authors and moves, so the author (admin) is suppressed and only the assignee is notified.
        var idea = await CreateIdeaAsync(admin, org.DefaultBoardId,
            new { title = "Assigned", description = "d", priority = "Low", assigneeUserIds = new[] { assignee.UserId } });
        var move = await admin.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[1] });
        move.EnsureSuccessStatusCode();

        var events = GetEvents(idea.IdeaId, NotificationEventType.IdeaStatusChanged);
        var evt = Assert.Single(events);
        Assert.Equal(assignee.UserId, evt.RecipientUserId);
    }

    // Self-notification suppression --------------------------------------------------------------

    [Fact]
    public async Task Self_Actions_Do_Not_Notify_The_Actor()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var org = await CreateOrganizationAsync(admin);
        var statusIds = GetBoardStatusIds(org.DefaultBoardId);

        // Author == actor for both the comment and the status move: no event should be written.
        var author = await CreateUserAsync(admin, org.OrganizationId, "User");
        using var authorClient = await LoginAsync(author.Email);
        var idea = await CreateIdeaAsync(authorClient, org.DefaultBoardId, new { title = "Solo", description = "d", priority = "Low" });

        var selfComment = await authorClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/comments", new { body = "Note to self" });
        selfComment.EnsureSuccessStatusCode();

        var selfMove = await authorClient.PostAsJsonAsync($"/api/v1/ideas/{idea.IdeaId}/status", new { statusId = statusIds[1] });
        selfMove.EnsureSuccessStatusCode();

        Assert.Empty(GetEvents(idea.IdeaId));
    }

    // T039: no outbound delivery -----------------------------------------------------------------

    [Fact]
    public void Notification_Path_Is_Database_Only_No_Delivery_Dependencies()
    {
        using var scope = _factory.Services.CreateScope();

        // The registered writer is the EF (database) implementation.
        var writer = scope.ServiceProvider.GetRequiredService<Collega.Application.Abstractions.INotificationEventWriter>();
        Assert.IsType<EfNotificationEventWriter>(writer);

        // The notification path takes no SMTP/HTTP delivery dependency — only persistence + a clock.
        var ctor = Assert.Single(typeof(EfNotificationEventWriter).GetConstructors());
        foreach (var parameter in ctor.GetParameters())
        {
            var typeName = parameter.ParameterType.FullName ?? parameter.ParameterType.Name;
            Assert.DoesNotContain("Smtp", typeName, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("HttpClient", typeName, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("Mail", typeName, StringComparison.OrdinalIgnoreCase);
        }
    }

    // Helpers ------------------------------------------------------------------------------------

    private List<NotificationEvent> GetEvents(Guid ideaId, NotificationEventType? eventType = null)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        var query = db.NotificationEvents.AsNoTracking().Where(e => e.IdeaId == ideaId);
        if (eventType is not null)
        {
            query = query.Where(e => e.EventType == eventType);
        }

        return query.ToList();
    }

    private List<Guid> GetBoardStatusIds(Guid boardId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CollegaDbContext>();
        var board = db.Boards.Include(b => b.Swimlanes).First(b => b.Id == boardId);
        return board.Swimlanes.OrderBy(s => s.DisplayOrder).Select(s => s.StatusId).ToList();
    }

    private async Task<IdeaCreatedResponse> CreateIdeaAsync(HttpClient client, Guid boardId, object body)
    {
        var payload = WithClassification(body, OrganizationIdForBoard(boardId));
        var response = await client.PostAsJsonAsync($"/api/v1/boards/{boardId}/ideas", payload);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<IdeaCreatedResponse>(Json))!;
    }

    /// <summary>Merges the organization's canonical Idea Type / Business Impact defaults into an idea body.</summary>
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

    private async Task<CreateOrgResponse> CreateOrganizationAsync(HttpClient admin)
    {
        var response = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Notification test organization."
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;
    }

    private async Task<CreatedUser> CreateUserAsync(HttpClient admin, Guid organizationId, string role)
    {
        var email = $"{role.ToLowerInvariant()}-{Guid.NewGuid():N}@notify.test";
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

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record CreateUserResponse(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);
    private sealed record CreatedUser(Guid UserId, string Email);
    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record IdeaCreatedResponse(Guid IdeaId, Guid BoardId, Guid StatusId, string Title, string Priority, string? DueDate);
}
