using System.Security.Cryptography;
using Collega.Application.Abstractions;
using Collega.Application.Organizations;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Users;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Seeding;

/// <summary>
/// Idempotent startup seeding (auth requirements #8-11). Each part runs only when the caller
/// requests it (see <see cref="SeedAsync"/> parameters), and each is a no-op when its data
/// already exists:
/// 1. The global Site Admin, from environment-provided credentials, on first run only.
/// 2. 3 demo organizations, each provisioned with the default statuses and one default board,
///    plus one Org Admin, one User, and one Read Only account at password `Abc123!`, none forced
///    to change it, and the default board populated with one idea per swimlane plus a few example
///    comments so a fresh Development environment has something to look at.
/// </summary>
public sealed class StartupSeeder : IStartupSeeder
{
    private const string DemoPassword = "Abc123!";

    private static readonly (string Title, string Slug, string Description)[] DemoOrganizations =
    {
        ("Acme Robotics", "acme-robotics", "Industrial robotics and automation manufacturer."),
        ("Blue Harbor Logistics", "blue-harbor", "Regional freight and warehousing operator."),
        ("Crestline Health Group", "crestline-health", "Outpatient clinics and specialty care network.")
    };

    private readonly CollegaDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOrganizationBootstrapService _bootstrapService;
    private readonly IClock _clock;

    public StartupSeeder(
        CollegaDbContext dbContext,
        IPasswordHasher passwordHasher,
        IOrganizationBootstrapService bootstrapService,
        IClock clock)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _bootstrapService = bootstrapService;
        _clock = clock;
    }

    public async Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedSiteAdmin,
        bool seedDemoData,
        CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;

        if (seedSiteAdmin)
        {
            var hasSiteAdmin = await _dbContext.Users.AnyAsync(u => u.Role == Role.SiteAdmin, cancellationToken);
            if (!hasSiteAdmin)
            {
                var passwordHash = _passwordHasher.Hash(siteAdminPassword);
                var siteAdmin = User.CreateSiteAdmin("Site", "Admin", siteAdminEmail, passwordHash, now);
                await _dbContext.Users.AddAsync(siteAdmin, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        if (!seedDemoData)
        {
            return;
        }

        var demoPasswordHash = _passwordHasher.Hash(DemoPassword);

        foreach (var (title, slug, description) in DemoOrganizations)
        {
            var organization = await _dbContext.Organizations.FirstOrDefaultAsync(o => o.Title == title, cancellationToken);
            if (organization is null)
            {
                organization = Organization.Create(title, description, GenerateInviteCode(slug), now);
                await _dbContext.Organizations.AddAsync(organization, cancellationToken);

                // Every organization — demo or real — starts with the default statuses and one board.
                await _bootstrapService.ProvisionDefaultsAsync(organization.Id, now, actorUserId: null, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);

                await AddDemoUserAsync(organization.Id, "Olivia", "Administer", $"orgadmin@{slug}.demo.collega.test", demoPasswordHash, Role.OrgAdmin, now, cancellationToken);
                await AddDemoUserAsync(organization.Id, "Noah", "Contributor", $"user@{slug}.demo.collega.test", demoPasswordHash, Role.User, now, cancellationToken);
                await AddDemoUserAsync(organization.Id, "Ivy", "Viewer", $"readonly@{slug}.demo.collega.test", demoPasswordHash, Role.ReadOnly, now, cancellationToken);

                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            // Populate the default board with an idea per swimlane and a few comments. Idempotent:
            // a no-op once the board already has ideas, so a second boot never duplicates the graph.
            await SeedDemoBoardContentAsync(organization.Id, now, cancellationToken);
        }
    }

    private async Task AddDemoUserAsync(
        Guid organizationId,
        string firstName,
        string lastName,
        string email,
        string passwordHash,
        Role role,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var user = User.CreateOrganizationUser(organizationId, firstName, lastName, email, passwordHash, role, UserStatus.Active, mustChangePassword: false, nowUtc);
        await _dbContext.Users.AddAsync(user, cancellationToken);
    }

    /// <summary>
    /// Fills the organization's default board with one example idea in each swimlane (spread across
    /// priorities) plus a handful of comments. Skips entirely when the board already holds ideas so
    /// the seed stays idempotent across boots.
    /// </summary>
    private async Task SeedDemoBoardContentAsync(Guid organizationId, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var board = await _dbContext.Boards.FirstOrDefaultAsync(b => b.OrganizationId == organizationId, cancellationToken);
        if (board is null)
        {
            return;
        }

        var alreadySeeded = await _dbContext.Ideas.AnyAsync(i => i.BoardId == board.Id, cancellationToken);
        if (alreadySeeded)
        {
            return;
        }

        var statuses = await _dbContext.Statuses
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .ToListAsync(cancellationToken);

        var ideaType = await _dbContext.IdeaTypes
            .Where(t => t.OrganizationId == organizationId && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .FirstOrDefaultAsync(cancellationToken);

        var businessImpact = await _dbContext.BusinessImpacts
            .Where(b => b.OrganizationId == organizationId && !b.IsDeleted)
            .OrderBy(b => b.SortOrder)
            .FirstOrDefaultAsync(cancellationToken);

        var orgAdmin = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.OrganizationId == organizationId && u.Role == Role.OrgAdmin, cancellationToken);
        var contributor = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.OrganizationId == organizationId && u.Role == Role.User, cancellationToken);
        var readOnly = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.OrganizationId == organizationId && u.Role == Role.ReadOnly, cancellationToken);

        // Nothing to hang ideas off if the org's provisioned defaults are incomplete.
        if (statuses.Count == 0 || ideaType is null || businessImpact is null || orgAdmin is null || contributor is null)
        {
            return;
        }

        var priorities = new[] { Priority.Low, Priority.Medium, Priority.High, Priority.Critical };
        var noIds = Array.Empty<Guid>();
        var ideas = new List<Idea>(statuses.Count);

        for (var i = 0; i < statuses.Count; i++)
        {
            var status = statuses[i];
            // Alternate authorship between the Org Admin and the contributor so the demo shows both.
            var author = (i % 2 == 0 ? orgAdmin : contributor).Id;
            var assignees = new[] { contributor.Id };

            var idea = Idea.Create(
                organizationId,
                board.Id,
                status.Id,
                title: $"[{status.Name}] Example idea {i + 1}",
                description: $"Sample idea seeded in the \"{status.Name}\" swimlane to demonstrate the board.",
                priority: priorities[i % priorities.Length],
                ideaTypeId: ideaType.Id,
                businessImpactId: businessImpact.Id,
                dueDate: null,
                authorUserId: author,
                assigneeUserIds: assignees,
                tagIds: noIds,
                mentionUserIds: noIds,
                nowUtc);

            ideas.Add(idea);
            await _dbContext.Ideas.AddAsync(idea, cancellationToken);
        }

        // A few example comments on the first couple of ideas, authored by different roles
        // (Read Only can comment) to exercise the discussion thread.
        await AddDemoCommentAsync(ideas[0].Id, contributor.Id, "Thanks for raising this — I'll take a first look.", nowUtc, cancellationToken);
        await AddDemoCommentAsync(ideas[0].Id, orgAdmin.Id, "Agreed, let's prioritize it for the next review.", nowUtc, cancellationToken);
        if (ideas.Count > 1)
        {
            var secondCommentAuthor = (readOnly ?? contributor).Id;
            await AddDemoCommentAsync(ideas[1].Id, secondCommentAuthor, "Following along — this would help my team too.", nowUtc, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task AddDemoCommentAsync(
        Guid ideaId,
        Guid authorUserId,
        string body,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var comment = Comment.Create(ideaId, authorUserId, body, Array.Empty<Guid>(), nowUtc);
        await _dbContext.Comments.AddAsync(comment, cancellationToken);
    }

    private static string GenerateInviteCode(string slug)
    {
        var suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
        return $"{slug}-{suffix}".ToUpperInvariant();
    }
}
