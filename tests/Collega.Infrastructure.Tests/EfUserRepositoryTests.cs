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

    /// <summary>
    /// <see cref="EfUserRepository.SearchForImpersonationAsync"/> orders by first name then last name
    /// then, since the change under test, email - so two users who tie on both names still resolve to
    /// a single, total order instead of an arbitrary one. Under the 200-row cap an arbitrary tie-break
    /// does not just reorder the page, it decides which of the tied rows is even on it.
    /// </summary>
    /// <remarks>
    /// This only proves the tiebreak on the InMemory provider because <c>Enumerable.OrderBy</c>/
    /// <c>ThenBy</c> is a documented <i>stable</i> sort: with no email tiebreak, two tied rows come
    /// back in whatever order the InMemory provider enumerates them in - which, absent removals,
    /// tracks insertion order. Seeding the earlier email second (so insertion order and the wanted
    /// email order disagree) means a correct result can only come from the added
    /// <c>ThenBy(u => u.Email)</c>, not from provider happenstance - the pre-fix query would return
    /// insertion order and fail this assertion.
    /// <para>
    /// What this does <i>not</i> prove: that a real PostgreSQL server, without a full ORDER BY, would
    /// vary its tie-break from run to run - Postgres gives no stability guarantee for ties the way LINQ
    /// does, and that is the actual production failure mode this ordering fixes. That is not
    /// practically reproducible in a unit test (it requires the query planner to pick different
    /// physical scans across runs against the same data) and PostgresProviderTests.cs is reserved for
    /// schema/DDL-level guarantees InMemory cannot model at all, not general query-result behaviour -
    /// see tests/CLAUDE.md. The SQL-shape assertion pattern used for LIKE clauses in
    /// SearchSqlGenerationTests.cs is not available here either without exposing the query as an
    /// internal static helper the way EfUserRepository.ApplySearch already is, which is a production
    /// change outside a QA pass. This test is the closest hermetic proxy: it exercises the real method
    /// and fails without the fix.
    /// </para>
    /// </remarks>
    [Fact]
    public async Task SearchForImpersonation_BreaksNameTiesByEmail_ForATotalOrder()
    {
        using var ctx = InMemoryContext.Create();
        var orgA = await SeedOrgAsync(ctx);
        var orgB = await SeedOrgAsync(ctx);
        var repo = new EfUserRepository(ctx);

        // Same first and last name in two different organizations - ties FirstName/LastName exactly.
        // Inserted with the alphabetically-later email first, so a stable sort with no further
        // tiebreak would return insertion order (zoe, then abby) rather than the wanted email order.
        await repo.AddAsync(Build.User(orgB, firstName: "Jane", lastName: "Smith", email: "zoe@example.com"));
        await repo.AddAsync(Build.User(orgA, firstName: "Jane", lastName: "Smith", email: "abby@example.com"));
        await ctx.SaveChangesAsync();

        var results = await repo.SearchForImpersonationAsync(organizationId: null, search: null);

        Assert.Equal(2, results.Count);
        Assert.Equal("abby@example.com", results[0].Email);
        Assert.Equal("zoe@example.com", results[1].Email);
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
