using Collega.Application.Organizations;
using Collega.Domain.Enums;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Seeding;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Tests;

public sealed class StartupSeederTests
{
    private const string SiteAdminEmail = "admin@collega.local";
    private const string SiteAdminPassword = "Sup3r!Secret";

    private static StartupSeeder CreateSeeder(CollegaDbContext ctx)
    {
        var bootstrap = new OrganizationBootstrapService(new EfStatusRepository(ctx), new EfBoardRepository(ctx), new EfIdeaTypeRepository(ctx), new EfBusinessImpactRepository(ctx));
        return new StartupSeeder(ctx, new FakePasswordHasher(), bootstrap, new TestClock());
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

        Assert.Equal(1, await ctx.Users.CountAsync(u => u.Role == Role.SiteAdmin));
        Assert.Null((await ctx.Users.SingleAsync(u => u.Role == Role.SiteAdmin)).OrganizationId);
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
        Assert.Equal(7, await verify.Users.CountAsync()); // 1 global Site Admin + 6 organization users
    }

    [Fact]
    public async Task Seed_Development_PopulatesEachBoardWithIdeasAcrossEverySwimlane()
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
            var ideas = await ctx.Ideas.Where(i => i.BoardId == board.Id).ToListAsync();

            // One idea per default swimlane (status), each carrying a required Idea Type / Business Impact.
            Assert.Equal(OrganizationDefaults.Statuses.Count, ideas.Count);
            Assert.All(ideas, i => Assert.NotEqual(Guid.Empty, i.IdeaTypeId));
            Assert.All(ideas, i => Assert.NotEqual(Guid.Empty, i.BusinessImpactId));

            var boardStatusIds = await ctx.Statuses
                .Where(s => s.OrganizationId == board.OrganizationId)
                .Select(s => s.Id)
                .ToListAsync();
            var ideaStatusIds = ideas.Select(i => i.StatusId).Distinct().ToList();

            // Every swimlane is represented exactly once.
            Assert.Equal(boardStatusIds.Count, ideaStatusIds.Count);
            Assert.All(ideaStatusIds, id => Assert.Contains(id, boardStatusIds));
        }
    }

    [Fact]
    public async Task Seed_Development_AddsExampleCommentsToDemoBoards()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        // 3 comments per demo board (see StartupSeeder.SeedDemoBoardContentAsync).
        Assert.Equal(12, await ctx.Comments.CountAsync());

        // Every comment hangs off a seeded idea.
        var ideaIds = await ctx.Ideas.Select(i => i.Id).ToListAsync();
        var comments = await ctx.Comments.ToListAsync();
        Assert.All(comments, c => Assert.Contains(c.IdeaId, ideaIds));
    }

    [Fact]
    public async Task Seed_NonDevelopment_CreatesNoDemoIdeasOrComments()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: false);

        Assert.Equal(0, await ctx.Ideas.CountAsync());
        Assert.Equal(0, await ctx.Comments.CountAsync());
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

        // 2 orgs x 2 boards x 5 swimlanes = 20 ideas; 4 boards x 3 comments = 12 comments.
        Assert.Equal(4 * OrganizationDefaults.Statuses.Count, await verify.Ideas.CountAsync());
        Assert.Equal(12, await verify.Comments.CountAsync());
    }
}
