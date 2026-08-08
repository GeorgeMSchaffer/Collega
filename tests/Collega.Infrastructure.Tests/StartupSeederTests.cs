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
    public async Task Seed_Development_CreatesThreeOrganizationsWithDefaultsAndRoleAccounts()
    {
        using var ctx = InMemoryContext.Create();

        await CreateSeeder(ctx).SeedAsync(SiteAdminEmail, SiteAdminPassword, seedSiteAdmin: true, seedDemoData: true);

        Assert.Equal(3, await ctx.Organizations.CountAsync());
        Assert.Equal(3 * OrganizationDefaults.Statuses.Count, await ctx.Statuses.CountAsync());
        Assert.Equal(3, await ctx.Boards.CountAsync());

        // Each org has an Org Admin, a User, and a Read Only account (plus the global Site Admin).
        Assert.Equal(3, await ctx.Users.CountAsync(u => u.Role == Role.OrgAdmin));
        Assert.Equal(3, await ctx.Users.CountAsync(u => u.Role == Role.User));
        Assert.Equal(3, await ctx.Users.CountAsync(u => u.Role == Role.ReadOnly));
        Assert.Equal(1, await ctx.Users.CountAsync(u => u.Role == Role.SiteAdmin));
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
        Assert.Equal(3, await verify.Organizations.CountAsync());
        Assert.Equal(3 * OrganizationDefaults.Statuses.Count, await verify.Statuses.CountAsync());
        Assert.Equal(3, await verify.Boards.CountAsync());
        Assert.Equal(10, await verify.Users.CountAsync()); // 1 site admin + 9 demo accounts
    }
}
