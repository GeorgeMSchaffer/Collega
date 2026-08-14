using System.Security.Cryptography;
using Collega.Application.Abstractions;
using Collega.Application.Organizations;
using Collega.Domain.Boards;
using Collega.Domain.Comments;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Collega.Infrastructure.Seeding;

/// <summary>
/// Idempotent startup seeding (auth requirements #8-11). Each part runs only when the caller
/// requests it (see <see cref="SeedAsync"/> parameters), and each is a no-op when its data
/// already exists:
/// 1. The global Site Admin, from environment-provided credentials, on first run only.
/// 2. 2 demo organizations, each provisioned with the default statuses and two demo boards,
///    plus one Org Admin and two User accounts at password `Abc123!`, none forced to change it.
///    Every demo board is populated with 11 ideas distributed 3/2/2/1/3 across its swimlanes.
/// 3. A Development-only convenience Site Admin (siteadmin@demo.collega.test / `Abc123!`, no forced
///    change) so the platform-admin perspective can be tested without the configured Site Admin secret.
/// </summary>
public sealed class StartupSeeder : IStartupSeeder
{
    private const string DemoPassword = "Abc123!";
    private const string SecondDemoBoardName = "Opportunities";

    // Development-only convenience Site Admin (see EnsureDemoSiteAdminAsync). Distinct from the
    // environment-configured Site Admin so seeding never disturbs that account.
    private const string DemoSiteAdminEmail = "siteadmin@demo.collega.test";

    private static readonly int[] IdeasPerStatus = { 3, 2, 2, 1, 3 };

    private static readonly DemoIdeaScenario[] IdeaScenarios =
    {
        new("Reduce manual handoffs", "Map the current handoffs and automate the highest-friction transition."),
        new("Add proactive alerts", "Notify the responsible team before a preventable delay becomes customer-visible."),
        new("Standardize the intake checklist", "Use one concise checklist so requests arrive complete and ready for action."),
        new("Pilot a faster review path", "Trial a lightweight review path for low-risk changes and measure cycle time."),
        new("Improve exception visibility", "Surface recurring exceptions with enough context for rapid ownership."),
        new("Automate weekly reporting", "Generate the weekly operating summary from source data instead of spreadsheets."),
        new("Create a shared playbook", "Capture the approved response steps and escalation points in one maintained playbook."),
        new("Validate the customer feedback loop", "Close the loop with requesters and record whether the change solved the problem."),
        new("Roll out the proven workflow", "Extend the successful pilot to the remaining teams with clear adoption measures."),
        new("Measure time saved", "Compare the new workflow with the baseline and publish the verified time savings."),
        new("Retire the legacy step", "Remove the superseded process step after confirming all dependencies have moved."),
    };

    private static readonly DemoOrganizationScenario[] DemoOrganizations =
    {
        new(
            "Acme Robotics",
            "acme-robotics",
            "Industrial robotics and automation manufacturer.",
            new[]
            {
                new DemoBoardScenario(OrganizationDefaults.DefaultBoardName, "Assembly cell reliability", new[] { "automation", "safety", "quality", "cycle-time" }),
                new DemoBoardScenario(SecondDemoBoardName, "Field service enablement", new[] { "service", "diagnostics", "customer-impact", "parts" }),
            }),
        new(
            "Blue Harbor Logistics",
            "blue-harbor",
            "Regional freight and warehousing operator.",
            new[]
            {
                new DemoBoardScenario(OrganizationDefaults.DefaultBoardName, "Warehouse throughput", new[] { "warehouse", "safety", "inventory", "cycle-time" }),
                new DemoBoardScenario(SecondDemoBoardName, "Route and delivery performance", new[] { "routing", "fleet", "customer-impact", "scheduling" }),
            }),
    };

    private readonly CollegaDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IOrganizationBootstrapService _bootstrapService;
    private readonly IClock _clock;
    private readonly ILogger<StartupSeeder> _logger;

    public StartupSeeder(
        CollegaDbContext dbContext,
        IPasswordHasher passwordHasher,
        IOrganizationBootstrapService bootstrapService,
        IClock clock,
        ILogger<StartupSeeder> logger)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _bootstrapService = bootstrapService;
        _clock = clock;
        _logger = logger;
    }

    public async Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedSiteAdmin,
        bool seedDemoData,
        bool resetSiteAdmin = false,
        CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;

        if (seedSiteAdmin)
        {
            // Match the configured account specifically (normalized email + Site Admin role) rather
            // than "any Site Admin", so a manually promoted Site Admin is never targeted by a reset.
            var normalizedEmail = EmailNormalizer.Normalize(siteAdminEmail);
            var configuredSiteAdmin = await _dbContext.Users.SingleOrDefaultAsync(
                u => u.Role == Role.SiteAdmin && u.NormalizedEmail == normalizedEmail,
                cancellationToken);

            // Dev/ops reset affordance: drop the configured Site Admin so the recreate below restores
            // the configured credentials with MustChangePassword = true. FK-safe — AuditEvent/
            // NotificationEvent.ActorUserId are plain Guid columns (no navigation), and the Site Admin
            // has no org membership or authored org content, so the hard delete has no cascade fallout.
            if (resetSiteAdmin && configuredSiteAdmin is not null)
            {
                _dbContext.Users.Remove(configuredSiteAdmin);
                await _dbContext.SaveChangesAsync(cancellationToken);
                configuredSiteAdmin = null;
            }

            if (configuredSiteAdmin is null)
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

        await EnsureDemoSiteAdminAsync(demoPasswordHash, now, cancellationToken);

        foreach (var scenario in DemoOrganizations)
        {
            var organization = await _dbContext.Organizations.FirstOrDefaultAsync(o => o.Title == scenario.Title, cancellationToken);
            if (organization is null)
            {
                organization = Organization.Create(scenario.Title, scenario.Description, GenerateInviteCode(scenario.Slug), now);
                await _dbContext.Organizations.AddAsync(organization, cancellationToken);

                // Every organization — demo or real — starts with the default statuses and one board.
                await _bootstrapService.ProvisionDefaultsAsync(organization.Id, now, actorUserId: null, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);

                await AddDemoUserAsync(organization.Id, "Olivia", "Administer", $"orgadmin@{scenario.Slug}.demo.collega.test", demoPasswordHash, Role.OrgAdmin, now, cancellationToken);
                await AddDemoUserAsync(organization.Id, "Noah", "Contributor", $"user@{scenario.Slug}.demo.collega.test", demoPasswordHash, Role.User, now, cancellationToken);
                await AddDemoUserAsync(organization.Id, "Maya", "Collaborator", $"user2@{scenario.Slug}.demo.collega.test", demoPasswordHash, Role.User, now, cancellationToken);

                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await EnsureSecondDemoBoardAsync(organization.Id, now, cancellationToken);
            await SeedDemoBoardContentAsync(organization.Id, scenario, now, cancellationToken);
        }

        await LogSeededAccountsAsync(cancellationToken);
    }

    /// <summary>
    /// Writes the resulting account roster to the log so the seeded users can actually be found
    /// (Sprint 6.5, requested 2026-08-14 — the seed created them silently, which made testing and
    /// debugging guesswork).
    /// </summary>
    /// <remarks>
    /// <para>Logs the <i>resulting</i> roster rather than only what this run created. The seed is
    /// idempotent, so on every run after the first it creates nothing — a "what I just created"
    /// list would be empty exactly when someone is trying to find out what exists.</para>
    ///
    /// <para><b>Runs only when demo seeding is on</b>, which is Development. It prints the shared
    /// demo password because that is a compile-time constant in this file and already documented in
    /// <c>CLAUDE.md</c>, so the log reveals nothing the repository does not. It deliberately never
    /// prints the configured Site Admin password, which comes from configuration or user-secrets.</para>
    /// </remarks>
    private async Task LogSeededAccountsAsync(CancellationToken cancellationToken)
    {
        if (!_logger.IsEnabled(LogLevel.Information))
        {
            return;
        }

        var accounts = await _dbContext.Users
            .AsNoTracking()
            .OrderBy(u => u.Role)
            .ThenBy(u => u.Email)
            .Select(u => new { u.Email, u.Role, u.OrganizationId, u.MustChangePassword })
            .ToListAsync(cancellationToken);

        var organizations = await _dbContext.Organizations
            .AsNoTracking()
            .ToDictionaryAsync(o => o.Id, o => o.Title, cancellationToken);

        var lines = accounts.Select(a =>
        {
            var scope = a.OrganizationId is Guid orgId && organizations.TryGetValue(orgId, out var title)
                ? title
                : "(global — no organization)";
            var mustChange = a.MustChangePassword ? "  [must change password at first sign-in]" : string.Empty;
            return $"  {a.Role,-9}  {a.Email,-46}  {scope}{mustChange}";
        });

        _logger.LogInformation(
            "Seeded accounts ({Count}). Demo accounts sign in with password {DemoPassword}; the configured Site Admin uses its own configured password.\n{Accounts}",
            accounts.Count,
            DemoPassword,
            string.Join(Environment.NewLine, lines));
    }

    /// <summary>
    /// Development-only convenience account: a Site Admin that signs in with the standard demo
    /// password and is NOT forced to change it, so the platform-admin perspective can be exercised
    /// without the environment-configured Site Admin secret (which forces a first-login change).
    /// Runs only inside the demo seed (Development), uses a distinct email from the configured Site
    /// Admin, and is idempotent. The forced-change flag that <see cref="User.CreateSiteAdmin"/> always
    /// sets is cleared via <see cref="User.ChangePassword"/> with the same demo hash.
    /// </summary>
    private async Task EnsureDemoSiteAdminAsync(string passwordHash, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var normalizedEmail = EmailNormalizer.Normalize(DemoSiteAdminEmail);
        var exists = await _dbContext.Users.AnyAsync(
            u => u.Role == Role.SiteAdmin && u.NormalizedEmail == normalizedEmail,
            cancellationToken);
        if (exists)
        {
            return;
        }

        var demoSiteAdmin = User.CreateSiteAdmin("Sam", "Sitewide", DemoSiteAdminEmail, passwordHash, nowUtc);
        demoSiteAdmin.ChangePassword(passwordHash, nowUtc);
        await _dbContext.Users.AddAsync(demoSiteAdmin, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureSecondDemoBoardAsync(Guid organizationId, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var exists = await _dbContext.Boards.AnyAsync(
            b => b.OrganizationId == organizationId && b.Name == SecondDemoBoardName,
            cancellationToken);
        if (exists)
        {
            return;
        }

        var statusIds = await _dbContext.Statuses
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .Select(s => s.Id)
            .ToListAsync(cancellationToken);

        var board = Board.Create(
            organizationId,
            SecondDemoBoardName,
            allowUserStatusUpdate: true,
            statusIds,
            nowUtc);
        await _dbContext.Boards.AddAsync(board, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
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
    /// Fills every empty demo board from the fixed scenario catalog. Boards that already hold ideas
    /// are left untouched so reruns remain idempotent and never replace user data.
    /// </summary>
    private async Task SeedDemoBoardContentAsync(
        Guid organizationId,
        DemoOrganizationScenario organizationScenario,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var boards = await _dbContext.Boards
            .Where(b => b.OrganizationId == organizationId)
            .OrderBy(b => b.Name)
            .ToListAsync(cancellationToken);
        if (boards.Count == 0)
        {
            return;
        }

        var statuses = await _dbContext.Statuses
            .Where(s => s.OrganizationId == organizationId && !s.IsDeleted)
            .OrderBy(s => s.SortOrder)
            .ToListAsync(cancellationToken);

        var ideaTypes = await _dbContext.IdeaTypes
            .Where(t => t.OrganizationId == organizationId && !t.IsDeleted)
            .OrderBy(t => t.SortOrder)
            .ToListAsync(cancellationToken);

        var businessImpacts = await _dbContext.BusinessImpacts
            .Where(b => b.OrganizationId == organizationId && !b.IsDeleted)
            .OrderBy(b => b.SortOrder)
            .ToListAsync(cancellationToken);

        var users = await _dbContext.Users
            .Where(u => u.OrganizationId == organizationId)
            .OrderBy(u => u.Role == Role.OrgAdmin ? 0 : 1)
            .ThenBy(u => u.Email)
            .ToListAsync(cancellationToken);

        // Nothing to hang ideas off if the org's provisioned defaults are incomplete.
        if (statuses.Count != IdeasPerStatus.Length || ideaTypes.Count == 0 || businessImpacts.Count == 0 || users.Count != 3)
        {
            return;
        }

        var priorities = new[] { Priority.Low, Priority.Medium, Priority.High, Priority.Critical };
        var noIds = Array.Empty<Guid>();
        var seededBoardIds = await _dbContext.Ideas
            .Where(i => i.OrganizationId == organizationId)
            .Select(i => i.BoardId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (boards.All(board => seededBoardIds.Contains(board.Id)))
        {
            return;
        }

        var tagNames = organizationScenario.Boards.SelectMany(board => board.TagNames).Distinct().ToList();
        var tags = await _dbContext.Tags
            .Where(tag => tag.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);
        var existingTagNames = tags.Select(tag => tag.NormalizedName).ToHashSet();
        foreach (var tagName in tagNames.Where(name => !existingTagNames.Contains(Tag.Normalize(name))))
        {
            var tag = Tag.Create(organizationId, tagName, nowUtc);
            tags.Add(tag);
            await _dbContext.Tags.AddAsync(tag, cancellationToken);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var board in boards)
        {
            if (seededBoardIds.Contains(board.Id))
            {
                continue;
            }

            var boardScenario = organizationScenario.Boards.SingleOrDefault(candidate => candidate.Name == board.Name);
            if (boardScenario is null)
            {
                continue;
            }

            var boardTags = tags.Where(tag => boardScenario.TagNames.Contains(tag.Name)).ToList();
            var ideas = new List<Idea>(IdeaScenarios.Length);
            var statusIndex = 0;
            var ideasInStatus = 0;

            for (var i = 0; i < IdeaScenarios.Length; i++)
            {
                if (ideasInStatus == IdeasPerStatus[statusIndex])
                {
                    statusIndex++;
                    ideasInStatus = 0;
                }

                var ideaScenario = IdeaScenarios[i];
                var assigneeCount = i % 3;
                var tagCount = i % 3;
                var assigneeIds = Enumerable.Range(1, assigneeCount)
                    .Select(offset => users[(i + offset) % users.Count].Id)
                    .ToArray();
                var tagIds = Enumerable.Range(0, tagCount)
                    .Select(offset => boardTags[(i + offset) % boardTags.Count].Id)
                    .ToArray();

                var idea = Idea.Create(
                    organizationId,
                    board.Id,
                    statuses[statusIndex].Id,
                    title: $"{boardScenario.Focus}: {ideaScenario.Title}",
                    description: $"{ideaScenario.Description} This scenario supports {boardScenario.Focus.ToLowerInvariant()} at {organizationScenario.Title}.",
                    priority: priorities[i % priorities.Length],
                    ideaTypeId: ideaTypes[i % ideaTypes.Count].Id,
                    businessImpactId: businessImpacts[i % businessImpacts.Count].Id,
                    dueDate: i % 3 == 0 ? null : DateOnly.FromDateTime(nowUtc).AddDays(7 + i),
                    authorUserId: users[i % users.Count].Id,
                    assigneeUserIds: assigneeIds,
                    tagIds,
                    mentionUserIds: i % 4 == 0 ? new[] { users[(i + 1) % users.Count].Id } : noIds,
                    nowUtc);

                ideas.Add(idea);
                await _dbContext.Ideas.AddAsync(idea, cancellationToken);

                for (var upvoteIndex = 0; upvoteIndex < i % 3; upvoteIndex++)
                {
                    await _dbContext.IdeaUpvotes.AddAsync(
                        IdeaUpvote.Create(idea.Id, users[(i + upvoteIndex + 1) % users.Count].Id, nowUtc),
                        cancellationToken);
                }

                ideasInStatus++;
            }

            await AddDemoCommentAsync(ideas[0].Id, users[1].Id, "Thanks for raising this - I'll take a first look.", nowUtc, cancellationToken);
            await AddDemoCommentAsync(ideas[0].Id, users[0].Id, "Agreed, let's prioritize it for the next review.", nowUtc, cancellationToken);
            await AddDemoCommentAsync(ideas[1].Id, users[2].Id, "Following along - this would help my team too.", nowUtc, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
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

    private sealed record DemoOrganizationScenario(
        string Title,
        string Slug,
        string Description,
        IReadOnlyList<DemoBoardScenario> Boards);

    private sealed record DemoBoardScenario(string Name, string Focus, IReadOnlyList<string> TagNames);

    private sealed record DemoIdeaScenario(string Title, string Description);
}
