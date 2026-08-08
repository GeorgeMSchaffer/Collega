using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfBoardRepositoryTests
{
    [Fact]
    public async Task AddAndGetById_IncludesSwimlanes()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var s1 = Guid.NewGuid();
        var s2 = Guid.NewGuid();
        var repo = new EfBoardRepository(ctx);
        var board = Build.Board(orgId, new[] { s1, s2 });

        await repo.AddAsync(board);
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByIdAsync(board.Id);
        Assert.NotNull(loaded);
        Assert.Equal(2, loaded!.Swimlanes.Count);
        Assert.Equal(new[] { s1, s2 }, loaded.Swimlanes.OrderBy(sl => sl.DisplayOrder).Select(sl => sl.StatusId));
    }

    [Fact]
    public async Task ListByOrganization_ScopesAndOrdersByName()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var otherOrg = Guid.NewGuid();
        var repo = new EfBoardRepository(ctx);
        await repo.AddAsync(Build.Board(orgId, new[] { Guid.NewGuid(), Guid.NewGuid() }, name: "Zeta"));
        await repo.AddAsync(Build.Board(orgId, new[] { Guid.NewGuid(), Guid.NewGuid() }, name: "Alpha"));
        await repo.AddAsync(Build.Board(otherOrg, new[] { Guid.NewGuid(), Guid.NewGuid() }, name: "Elsewhere"));
        await ctx.SaveChangesAsync();

        var boards = await repo.ListByOrganizationAsync(orgId, default);

        Assert.Equal(new[] { "Alpha", "Zeta" }, boards.Select(b => b.Name));
    }

    [Fact]
    public async Task IsStatusReferenced_TrueOnlyWhenUsedAsSwimlane()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var referenced = Guid.NewGuid();
        var unreferenced = Guid.NewGuid();
        var repo = new EfBoardRepository(ctx);
        await repo.AddAsync(Build.Board(orgId, new[] { referenced, Guid.NewGuid() }));
        await ctx.SaveChangesAsync();

        Assert.True(await repo.IsStatusReferencedAsync(referenced));
        Assert.False(await repo.IsStatusReferencedAsync(unreferenced));
    }
}
