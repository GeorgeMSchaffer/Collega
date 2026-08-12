using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfUserRepositoryTests
{
    private static async Task<Guid> SeedOrgAsync(CollegaDbContext ctx)
    {
        var org = Build.Organization();
        ctx.Organizations.Add(org);
        await ctx.SaveChangesAsync();
        return org.Id;
    }

    [Fact]
    public async Task AddAndGetById_RoundTrips()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        var user = Build.User(orgId, email: "pat@example.com");

        await repo.AddAsync(user);
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByIdAsync(user.Id);
        Assert.NotNull(loaded);
        Assert.Equal("pat@example.com", loaded!.Email);
    }

    [Fact]
    public async Task GetByNormalizedEmail_FindsByNormalizedForm()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, email: "Pat@Example.COM"));
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByNormalizedEmailAsync("pat@example.com");

        Assert.NotNull(loaded);
    }

    [Fact]
    public async Task ExistsByNormalizedEmail_ReflectsPresence()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, email: "here@example.com"));
        await ctx.SaveChangesAsync();

        Assert.True(await repo.ExistsByNormalizedEmailAsync("here@example.com"));
        Assert.False(await repo.ExistsByNormalizedEmailAsync("nope@example.com"));
    }

    [Fact]
    public async Task AnySiteAdmin_TrueOnlyWhenSiteAdminExists()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, role: Role.OrgAdmin));
        await ctx.SaveChangesAsync();
        Assert.False(await repo.AnySiteAdminAsync());

        ctx.Users.Add(Collega.Domain.Users.User.CreateSiteAdmin("Site", "Admin", "admin@collega.local", "hash", TestClock.Default));
        await ctx.SaveChangesAsync();
        Assert.True(await repo.AnySiteAdminAsync());
    }

    [Fact]
    public async Task CountActiveOrgAdmins_CountsOnlyActiveAdmins_AndCanExcludeOne()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        var admin1 = Build.User(orgId, role: Role.OrgAdmin, email: "a1@example.com");
        var admin2 = Build.User(orgId, role: Role.OrgAdmin, email: "a2@example.com");
        await repo.AddAsync(admin1);
        await repo.AddAsync(admin2);
        await repo.AddAsync(Build.User(orgId, role: Role.OrgAdmin, status: UserStatus.Inactive, email: "inactive@example.com"));
        await repo.AddAsync(Build.User(orgId, role: Role.User, email: "u@example.com"));
        await ctx.SaveChangesAsync();

        Assert.Equal(2, await repo.CountActiveOrgAdminsAsync(orgId));
        Assert.Equal(1, await repo.CountActiveOrgAdminsAsync(orgId, excludingUserId: admin1.Id));
    }

    [Fact]
    public async Task ListByIds_ReturnsOnlyRequested_AndEmptyForNoIds()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        var a = Build.User(orgId, email: "a@example.com");
        var b = Build.User(orgId, email: "b@example.com");
        await repo.AddAsync(a);
        await repo.AddAsync(b);
        await ctx.SaveChangesAsync();

        var result = await repo.ListByIdsAsync(new[] { a.Id });
        Assert.Single(result);
        Assert.Equal(a.Id, result[0].Id);

        Assert.Empty(await repo.ListByIdsAsync(Array.Empty<Guid>()));
    }

    [Fact]
    public async Task ListByOrganization_ScopesFiltersAndPages()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var otherOrgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);

        for (var i = 0; i < 3; i++)
        {
            await repo.AddAsync(Build.User(orgId, role: Role.User, email: $"u{i}@example.com", lastName: $"L{i}"));
        }

        await repo.AddAsync(Build.User(orgId, role: Role.OrgAdmin, email: "admin@example.com", lastName: "Zeta"));
        await repo.AddAsync(Build.User(otherOrgId, email: "elsewhere@example.com"));
        await ctx.SaveChangesAsync();

        var filter = new UserListFilter(orgId, new PageRequest(1, 2), null, null, null, null, null);
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal(4, page.TotalCount); // 4 in this org, not 5
        Assert.Equal(2, page.Items.Count); // page size 2

        var adminsOnly = await repo.ListByOrganizationAsync(
            new UserListFilter(orgId, new PageRequest(1, 50), null, Role.OrgAdmin, null, null, null), default);
        Assert.Single(adminsOnly.Items);
    }

    [Fact]
    public async Task ListByOrganization_SearchMatchesNameOrEmailSubstring()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, firstName: "Alice", lastName: "Smith", email: "alice@example.com"));
        await repo.AddAsync(Build.User(orgId, firstName: "Bob", lastName: "Jones", email: "bob@example.com"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(
            new UserListFilter(orgId, new PageRequest(1, 50), "alice", null, null, null, null), default);

        Assert.Single(page.Items);
        Assert.Equal("alice@example.com", page.Items[0].Email);
    }

    /// <summary>
    /// A search term is data, not pattern syntax. Interpolated straight into <c>$"%{term}%"</c>, an
    /// underscore is a single-character wildcard, so searching "a_b" used to match "axb" — the term
    /// could not be searched literally at all, and matched rows the user never asked for.
    /// </summary>
    [Fact]
    public async Task ListByOrganization_SearchTreatsWildcardCharactersLiterally()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, firstName: "A_B", lastName: "Literal", email: "underscore@example.com"));
        await repo.AddAsync(Build.User(orgId, firstName: "AxB", lastName: "Wildcard", email: "wildcard@example.com"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(
            new UserListFilter(orgId, new PageRequest(1, 50), "A_B", null, null, null, null), default);

        Assert.Single(page.Items);
        Assert.Equal("underscore@example.com", page.Items[0].Email);
    }

    /// <summary>A term of only wildcards matches nothing rather than everything.</summary>
    [Theory]
    [InlineData("%")]
    [InlineData("%%")]
    [InlineData("_")]
    public async Task ListByOrganization_BareWildcardTermMatchesNothing(string term)
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, firstName: "Alice", lastName: "Smith", email: "alice@example.com"));
        await repo.AddAsync(Build.User(orgId, firstName: "Bob", lastName: "Jones", email: "bob@example.com"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(
            new UserListFilter(orgId, new PageRequest(1, 50), term, null, null, null, null), default);

        Assert.Empty(page.Items);
    }

    [Fact]
    public async Task ListByOrganization_SortsByEmailDescending()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);
        await repo.AddAsync(Build.User(orgId, email: "aaa@example.com"));
        await repo.AddAsync(Build.User(orgId, email: "zzz@example.com"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(
            new UserListFilter(orgId, new PageRequest(1, 50), null, null, null, "email", "desc"), default);

        Assert.Equal("zzz@example.com", page.Items[0].Email);
        Assert.Equal("desc", page.SortDirection);
    }
}
