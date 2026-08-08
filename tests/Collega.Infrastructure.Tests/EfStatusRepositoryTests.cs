using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfStatusRepositoryTests
{
    [Fact]
    public async Task AddRangeAndListByOrganization_OrdersBySortOrder()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var repo = new EfStatusRepository(ctx);

        await repo.AddRangeAsync(new[]
        {
            Build.Status(orgId, "Third", sortOrder: 30),
            Build.Status(orgId, "First", sortOrder: 10),
            Build.Status(orgId, "Second", sortOrder: 20)
        });
        await ctx.SaveChangesAsync();

        var list = await repo.ListByOrganizationAsync(orgId, includeDeleted: false, default);

        Assert.Equal(new[] { "First", "Second", "Third" }, list.Select(s => s.Name));
    }

    [Fact]
    public async Task ListByOrganization_ExcludesDeletedUnlessRequested()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var repo = new EfStatusRepository(ctx);
        var active = Build.Status(orgId, "Active", sortOrder: 10);
        var deleted = Build.Status(orgId, "Deleted", sortOrder: 20);
        deleted.SoftDelete(TestClock.Default, null);
        await repo.AddRangeAsync(new[] { active, deleted });
        await ctx.SaveChangesAsync();

        Assert.Single(await repo.ListByOrganizationAsync(orgId, includeDeleted: false, default));
        Assert.Equal(2, (await repo.ListByOrganizationAsync(orgId, includeDeleted: true, default)).Count);
    }

    [Fact]
    public async Task ListActiveByOrganization_ScopesAndExcludesDeleted()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var otherOrg = Guid.NewGuid();
        var repo = new EfStatusRepository(ctx);
        await repo.AddAsync(Build.Status(orgId, "Mine", sortOrder: 10));
        await repo.AddAsync(Build.Status(otherOrg, "Theirs", sortOrder: 10));
        await ctx.SaveChangesAsync();

        var list = await repo.ListActiveByOrganizationAsync(orgId, default);

        Assert.Single(list);
        Assert.Equal("Mine", list[0].Name);
    }

    [Fact]
    public async Task GetById_ReturnsTrackedEntity_SoMutationsPersist()
    {
        var dbName = Guid.NewGuid().ToString();
        var orgId = Guid.NewGuid();
        Guid statusId;

        using (var ctx = InMemoryContext.Create(dbName))
        {
            var repo = new EfStatusRepository(ctx);
            var status = Build.Status(orgId, "Original", sortOrder: 10);
            await repo.AddAsync(status);
            await ctx.SaveChangesAsync();
            statusId = status.Id;

            var loaded = await repo.GetByIdAsync(status.Id);
            loaded!.Update("Renamed", "#000000", 15, TestClock.Default, null);
            await ctx.SaveChangesAsync();
        }

        // A fresh context on the same in-memory database observes the committed change.
        using var verifyCtx = InMemoryContext.Create(dbName);
        var again = await new EfStatusRepository(verifyCtx).GetByIdAsync(statusId);
        Assert.Equal("Renamed", again!.Name);
    }

    [Fact]
    public async Task CountActiveByOrganization_CountsOnlyActive()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var repo = new EfStatusRepository(ctx);
        await repo.AddAsync(Build.Status(orgId, "A", sortOrder: 10));
        await repo.AddAsync(Build.Status(orgId, "B", sortOrder: 20));
        var deleted = Build.Status(orgId, "C", sortOrder: 30);
        deleted.SoftDelete(TestClock.Default, null);
        await repo.AddAsync(deleted);
        await ctx.SaveChangesAsync();

        Assert.Equal(2, await repo.CountActiveByOrganizationAsync(orgId, default));
    }
}
