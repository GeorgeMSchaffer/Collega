using Collega.Application.Organizations;
using Collega.Domain.Enums;
using Collega.Domain.Users;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Seeding;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Collega.Infrastructure.Tests;

public sealed class StartupSeederTests
{
    private const string SiteAdminEmail = "admin@collega.local";
    private const string SiteAdminPassword = "Sup3r!Secret";

    private static StartupSeeder CreateSeeder(CollegaDbContext ctx)
    {
        var bootstrap = new OrganizationBootstrapService(new EfStatusRepository(ctx), new EfBoardRepository(ctx), new EfIdeaTypeRepository(ctx), new EfBusinessImpactRepository(ctx));
        // NullLogger: the seeder's account-roster output is an operator convenience, not behaviour
        // under test, and it is guarded by IsEnabled so a null logger skips the query entirely.
        return new StartupSeeder(ctx, new FakePasswordHasher(), bootstrap, new TestClock(), NullLogger<StartupSeeder>.Instance);
    }

    [Fact]
    public async Task Seed_FirstRun_CreatesSiteAdmin_ForcedToChangePassword()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        var admin = await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin);
        Assert.Equal(SiteAdminEmail, admin.Email);
        Assert.Null(admin.OrganizationId);
        Assert.True(admin.MustChangePassword);
    }

    [Fact]
    public async Task Seed_NonDevelopment_DoesNotCreateDemoData()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        Assert.Empty(ctx.Organizations);
        Assert.Equal(1, await ctx.Users.CountAsync()); // only the site admin
    }

    [Fact]
    public async Task Seed_SiteAdmin_IsIdempotentAcrossRuns()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);
        }

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);
        }

        using var verify = InMemoryContext.Create(dbName);
        Assert.Equal(1, await verify.Users.CountAsync(u => u.Role == Role.SiteAdmin));
    }

    [Fact]
    public async Task Seed_ResetFalse_LeavesExistingChangedSiteAdminUntouched()
    {
        using var ctx = InMemoryContext.Create();
        var seeder = CreateSeeder(ctx);

        await seeder.SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        // Simulate a Site Admin who has completed the forced first-login password change.
        var admin = await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin);
        var changedHash = FakePasswordHasher.Prefix + "Changed!123";
        admin.ChangePassword(changedHash, TestClock.Default);
        await ctx.SaveChangesAsync();

        await seeder.SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false, resetSiteAdmin: false);

        var admins = await ctx.Users.Where(u => u.Role == Role.SiteAdmin).ToListAsync();
        Assert.Single(admins);
        Assert.Equal(changedHash, admins[0].PasswordHash);
        Assert.False(admins[0].MustChangePassword);
    }

    [Fact]
    public async Task Seed_ResetTrue_RecreatesExistingSiteAdminWithForcedPasswordChange()
    {
        using var ctx = InMemoryContext.Create();
        var seeder = CreateSeeder(ctx);

        await seeder.SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);
        var original = await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin);
        var originalId = original.Id;
        original.ChangePassword(FakePasswordHasher.Prefix + "Changed!123", TestClock.Default);
        await ctx.SaveChangesAsync();

        await seeder.SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false, resetSiteAdmin: true);

        var admins = await ctx.Users.Where(u => u.Role == Role.SiteAdmin).ToListAsync();
        Assert.Single(admins);
        Assert.Equal(SiteAdminEmail, admins[0].Email);
        Assert.Equal(FakePasswordHasher.Prefix + SiteAdminPassword, admins[0].PasswordHash);
        Assert.True(admins[0].MustChangePassword);
        Assert.NotEqual(originalId, admins[0].Id); // genuinely recreated, not updated in place
    }

    [Fact]
    public async Task Seed_ResetTrue_WithNoExistingSiteAdmin_CreatesOne()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false, resetSiteAdmin: true);

        var admin = await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin);
        Assert.Equal(SiteAdminEmail, admin.Email);
        Assert.Equal(FakePasswordHasher.Prefix + SiteAdminPassword, admin.PasswordHash);
        Assert.True(admin.MustChangePassword);
    }

    [Fact]
    public async Task Seed_ResetTrue_DoesNotTouchManuallyPromotedSiteAdminWithDifferentEmail()
    {
        using var ctx = InMemoryContext.Create();

        // A second Site Admin promoted manually, on a different email, past their forced change.
        var promoted = User.CreateSiteAdmin("Other", "Admin", "other-admin@collega.local", FakePasswordHasher.Prefix + "Other!123", TestClock.Default);
        promoted.ChangePassword(FakePasswordHasher.Prefix + "Other!123", TestClock.Default);
        await ctx.Users.AddAsync(promoted);
        await ctx.SaveChangesAsync();
        var promotedId = promoted.Id;

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false, resetSiteAdmin: true);

        var survivor = await ctx.Users.SingleAsync(u => u.Id == promotedId);
        Assert.Equal(Role.SiteAdmin, survivor.Role);
        Assert.False(survivor.MustChangePassword); // untouched by the reset

        Assert.Equal(2, await ctx.Users.CountAsync(u => u.Role == Role.SiteAdmin));
        var normalized = EmailNormalizer.Normalize(SiteAdminEmail);
        var configured = await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin && u.NormalizedEmail == normalized);
        Assert.True(configured.MustChangePassword);
    }

    [Fact]
    public async Task Seed_Development_CreatesTwoOrganizationsWithDefaultsAndThreeUsersEach()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        var organizations = await ctx.Organizations.ToListAsync();
        Assert.Equal(2, organizations.Count);
        Assert.Equal(2 * OrganizationDefaults.Statuses.Count, await ctx.Statuses.CountAsync());
        Assert.Equal(4, await ctx.Boards.CountAsync());

        foreach (var organization in organizations)
        {
            var users = await ctx.Users.Where(u => u.OrganizationId == organization.Id).ToListAsync();
            Assert.Equal(3, users.Count);
            Assert.Single(users, u => u.Role == Role.OrgAdmin);
            Assert.Equal(2, users.Count(u => u.Role == Role.User));
            Assert.DoesNotContain(users, u => u.Role is Role.SiteAdmin or Role.ReadOnly);
        }

        // 2 Site Admins in demo mode: the configured global one + the Development-only demo login.
        var siteAdmins = await ctx.Users.Where(u => u.Role == Role.SiteAdmin).ToListAsync();
        Assert.Equal(2, siteAdmins.Count);
        Assert.All(siteAdmins, a => Assert.Null(a.OrganizationId));
    }

    [Fact]
    public async Task Seed_Development_CreatesDemoSiteAdmin_NotForcedToChangePassword()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        var normalized = EmailNormalizer.Normalize("siteadmin@demo.collega.test");
        var demoSiteAdmin = await ctx.Users.SingleAsync(u => u.NormalizedEmail == normalized);
        Assert.Equal(Role.SiteAdmin, demoSiteAdmin.Role);
        Assert.Null(demoSiteAdmin.OrganizationId);
        Assert.False(demoSiteAdmin.MustChangePassword);
    }

    [Fact]
    public async Task Seed_Production_DoesNotCreateDemoSiteAdmin()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        var normalized = EmailNormalizer.Normalize("siteadmin@demo.collega.test");
        Assert.False(await ctx.Users.AnyAsync(u => u.NormalizedEmail == normalized));
    }

    [Fact]
    public async Task Seed_Development_DemoUsersAreNotForcedToChangePassword()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        var demoUsers = await ctx.Users.Where(u => u.Role != Role.SiteAdmin).ToListAsync();
        Assert.All(demoUsers, u => Assert.False(u.MustChangePassword));
    }

    [Fact]
    public async Task Seed_Development_IsIdempotent_NoDuplicateGraph()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);
        }

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);
        }

        using var verify = InMemoryContext.Create(dbName);
        Assert.Equal(2, await verify.Organizations.CountAsync());
        Assert.Equal(2 * OrganizationDefaults.Statuses.Count, await verify.Statuses.CountAsync());
        Assert.Equal(4, await verify.Boards.CountAsync());
        Assert.Equal(8, await verify.Users.CountAsync()); // 2 Site Admins (configured + demo) + 6 organization users
        Assert.Equal(44, await verify.Ideas.CountAsync());
        Assert.Equal(16, await verify.Tags.CountAsync());
        Assert.Equal(12, await verify.Comments.CountAsync());
        Assert.Equal(40, await verify.IdeaUpvotes.CountAsync());
    }

    [Fact]
    public async Task Seed_Development_PopulatesEachBoardWithExpectedStatusDistributionAndVariation()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        var boards = await ctx.Boards.ToListAsync();
        Assert.Equal(4, boards.Count);

        var organizations = await ctx.Organizations.ToListAsync();
        Assert.All(organizations, organization =>
            Assert.Equal(2, boards.Count(board => board.OrganizationId == organization.Id)));

        foreach (var board in boards)
        {
            var ideas = await ctx.Ideas
                .Include(i => i.Assignees)
                .Include(i => i.Tags)
                .Where(i => i.BoardId == board.Id)
                .ToListAsync();

            Assert.Equal(11, ideas.Count);
            Assert.All(ideas, i => Assert.NotEqual(Guid.Empty, i.IdeaTypeId));
            Assert.All(ideas, i => Assert.NotEqual(Guid.Empty, i.BusinessImpactId));

            var boardStatuses = await ctx.Statuses
                .Where(s => s.OrganizationId == board.OrganizationId)
                .OrderBy(s => s.SortOrder)
                .ToListAsync();

            Assert.Equal(new[] { 3, 2, 2, 1, 3 }, boardStatuses.Select(status => ideas.Count(idea => idea.StatusId == status.Id)));
            Assert.True(ideas.Select(idea => idea.AuthorUserId).Distinct().Count() >= 3);
            Assert.True(ideas.Select(idea => idea.Priority).Distinct().Count() >= 4);
            Assert.True(ideas.Select(idea => idea.IdeaTypeId).Distinct().Count() >= 2);
            Assert.True(ideas.Select(idea => idea.BusinessImpactId).Distinct().Count() >= 4);
            Assert.Contains(ideas, idea => idea.DueDate is null);
            Assert.Contains(ideas, idea => idea.DueDate is not null);
            Assert.Equal(new[] { 0, 1, 2 }, ideas.Select(idea => idea.Assignees.Count).Distinct().OrderBy(count => count));
            Assert.Equal(new[] { 0, 1, 2 }, ideas.Select(idea => idea.Tags.Count).Distinct().OrderBy(count => count));
        }
    }

    [Fact]
    public async Task Seed_Development_RelationshipsRemainInsideEachOrganization()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        var ideas = await ctx.Ideas
            .Include(idea => idea.Assignees)
            .Include(idea => idea.Tags)
            .ToListAsync();
        var boards = await ctx.Boards.ToDictionaryAsync(board => board.Id);
        var users = await ctx.Users.Where(user => user.OrganizationId != null).ToDictionaryAsync(user => user.Id);
        var tags = await ctx.Tags.ToDictionaryAsync(tag => tag.Id);
        var ideasById = ideas.ToDictionary(idea => idea.Id);

        Assert.All(ideas, idea =>
        {
            Assert.Equal(idea.OrganizationId, boards[idea.BoardId].OrganizationId);
            Assert.Equal(idea.OrganizationId, users[idea.AuthorUserId].OrganizationId);
            Assert.All(idea.Assignees, assignee => Assert.Equal(idea.OrganizationId, users[assignee.UserId].OrganizationId));
            Assert.All(idea.Tags, ideaTag => Assert.Equal(idea.OrganizationId, tags[ideaTag.TagId].OrganizationId));
        });

        Assert.Equal(12, await ctx.Comments.CountAsync());
        var comments = await ctx.Comments.ToListAsync();
        Assert.All(comments, comment => Assert.Equal(
            ideasById[comment.IdeaId].OrganizationId,
            users[comment.AuthorUserId].OrganizationId));

        Assert.Equal(40, await ctx.IdeaUpvotes.CountAsync());
        var upvotes = await ctx.IdeaUpvotes.ToListAsync();
        Assert.Equal(upvotes.Count, upvotes.Select(upvote => new { upvote.IdeaId, upvote.UserId }).Distinct().Count());
        Assert.All(upvotes, upvote => Assert.Equal(
            ideasById[upvote.IdeaId].OrganizationId,
            users[upvote.UserId].OrganizationId));
    }

    [Fact]
    public async Task Seed_NonDevelopment_CreatesNoDemoIdeasOrComments()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        Assert.Equal(0, await ctx.Ideas.CountAsync());
        Assert.Equal(0, await ctx.Comments.CountAsync());
        Assert.Equal(0, await ctx.Tags.CountAsync());
        Assert.Equal(0, await ctx.IdeaUpvotes.CountAsync());
    }

    [Fact]
    public async Task Seed_Development_IsIdempotent_NoDuplicateIdeasOrComments()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);
        }

        using (var ctx = InMemoryContext.Create(dbName))
        {
            await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);
        }

        using var verify = InMemoryContext.Create(dbName);

        Assert.Equal(44, await verify.Ideas.CountAsync());
        Assert.Equal(16, await verify.Tags.CountAsync());
        Assert.Equal(12, await verify.Comments.CountAsync());
        Assert.Equal(40, await verify.IdeaUpvotes.CountAsync());
    }
}
