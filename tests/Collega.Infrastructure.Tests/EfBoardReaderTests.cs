using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfBoardReaderTests
{
    [Fact]
    public async Task GetBoardContext_ReturnsNullForUnknownBoard()
    {
        using var ctx = InMemoryContext.Create();
        var reader = new EfBoardReader(ctx);

        Assert.Null(await reader.GetBoardContextAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetBoardContext_ProjectsSwimlanesAndLeftMostStatus()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var s1 = Guid.NewGuid();
        var s2 = Guid.NewGuid();
        var board = Build.Board(orgId, new[] { s1, s2 }, allowUserStatusUpdate: true);
        ctx.Boards.Add(board);
        await ctx.SaveChangesAsync();

        var context = await new EfBoardReader(ctx).GetBoardContextAsync(board.Id);

        Assert.NotNull(context);
        Assert.Equal(orgId, context!.OrganizationId);
        Assert.True(context.AllowUserStatusUpdate);
        Assert.Equal(s1, context.LeftMostStatusId);
        Assert.True(context.HasSwimlaneForStatus(s2));
        Assert.False(context.HasSwimlaneForStatus(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetStatusInfo_IncludesDeletedStatusesForHistoricalReferences()
    {
        using var ctx = InMemoryContext.Create();
        var orgId = Guid.NewGuid();
        var active = Build.Status(orgId, "Active", sortOrder: 10);
        var deleted = Build.Status(orgId, "Deleted", sortOrder: 20);
        deleted.SoftDelete(TestClock.Default, null);
        ctx.Statuses.AddRange(active, deleted);
        await ctx.SaveChangesAsync();

        var info = await new EfBoardReader(ctx).GetStatusInfoAsync(orgId);

        Assert.Equal(2, info.Count);
        Assert.True(info[deleted.Id].IsDeleted);
        Assert.Equal("Active", info[active.Id].Name);
    }
}
