using Collega.Domain.Boards;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;
using Collega.Domain.Users;

namespace Collega.Application.Tests.TestDoubles;

/// <summary>Factory helpers for domain entities used across the use-case tests.</summary>
internal static class Build
{
    private static DateTime Now => TestClock.Default;

    public static Organization Organization(string title = "Acme", string inviteCode = "ACME-001", bool archived = false)
    {
        var org = Domain.Organizations.Organization.Create(title, $"{title} description", inviteCode, Now);
        if (archived)
        {
            org.Archive(Now, null);
        }

        return org;
    }

    public static User SiteAdmin(string email = "admin@collega.local") =>
        Domain.Users.User.CreateSiteAdmin("Site", "Admin", email, FakePasswordHasher.Prefix + "pw", Now);

    public static User User(
        Guid organizationId,
        Role role = Role.User,
        UserStatus status = UserStatus.Active,
        string? email = null,
        string firstName = "Pat",
        string lastName = "Jones",
        string password = "Secret1!",
        bool mustChangePassword = false) =>
        Domain.Users.User.CreateOrganizationUser(
            organizationId,
            firstName,
            lastName,
            email ?? $"{Guid.NewGuid():N}@example.com",
            FakePasswordHasher.Prefix + password,
            role,
            status,
            mustChangePassword,
            Now);

    public static Status Status(Guid organizationId, string name = "New", string color = "#64748B", int sortOrder = 10)
    {
        var status = Domain.Statuses.Status.Create(organizationId, name, color, sortOrder, Now);
        return status;
    }

    public static Board Board(
        Guid organizationId,
        IReadOnlyList<Guid> orderedStatusIds,
        string name = "Ideas",
        bool allowUserStatusUpdate = true) =>
        Domain.Boards.Board.Create(organizationId, name, allowUserStatusUpdate, orderedStatusIds, Now);

    public static Idea Idea(
        Guid organizationId,
        Guid boardId,
        Guid statusId,
        Guid authorUserId,
        string title = "Improve onboarding",
        Priority priority = Priority.Medium,
        IReadOnlyCollection<Guid>? assignees = null,
        IReadOnlyCollection<Guid>? tags = null,
        IReadOnlyCollection<Guid>? mentions = null) =>
        Domain.Ideas.Idea.Create(
            organizationId,
            boardId,
            statusId,
            title,
            "A description long enough to pass validation.",
            priority,
            null,
            authorUserId,
            assignees ?? Array.Empty<Guid>(),
            tags ?? Array.Empty<Guid>(),
            mentions ?? Array.Empty<Guid>(),
            Now);
}
