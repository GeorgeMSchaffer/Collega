using Collega.Domain.Boards;

namespace Collega.Domain.Tests;

public sealed class BoardTests
{
    private static readonly Guid OrgId = Guid.NewGuid();
    private static readonly Guid S1 = Guid.NewGuid();
    private static readonly Guid S2 = Guid.NewGuid();
    private static readonly Guid S3 = Guid.NewGuid();

    private static Board NewBoard(params Guid[] statusIds) =>
        Board.Create(OrgId, "Ideas", allowUserStatusUpdate: true, statusIds, TestClock.Now);

    [Fact]
    public void Create_WithTwoSwimlanes_SetsOrderedLanes()
    {
        var board = NewBoard(S1, S2);

        Assert.Equal(2, board.Swimlanes.Count);
        Assert.Equal(S1, board.Swimlanes[0].StatusId);
        Assert.Equal(0, board.Swimlanes[0].DisplayOrder);
        Assert.Equal(1, board.Swimlanes[1].DisplayOrder);
    }

    [Fact]
    public void Create_RejectsFewerThanTwoSwimlanes()
    {
        Assert.Throws<ArgumentException>(() => NewBoard(S1));
    }

    [Fact]
    public void Create_RejectsDuplicateStatuses()
    {
        Assert.Throws<ArgumentException>(() => NewBoard(S1, S1));
    }

    [Fact]
    public void Update_CanAddAndRemoveSwimlanes()
    {
        var board = NewBoard(S1, S2);
        board.Update("Ideas", false, new[] { S2, S3 }, TestClock.Now.AddMinutes(1), Guid.NewGuid());

        Assert.Equal(new[] { S2, S3 }, board.Swimlanes.OrderBy(s => s.DisplayOrder).Select(s => s.StatusId));
        Assert.False(board.AllowUserStatusUpdate);
    }

    [Fact]
    public void Update_RejectsDroppingBelowTwoSwimlanes()
    {
        var board = NewBoard(S1, S2);
        Assert.Throws<ArgumentException>(() =>
            board.Update("Ideas", true, new[] { S1 }, TestClock.Now.AddMinutes(1), Guid.NewGuid()));
    }

    [Fact]
    public void ReorderSwimlanes_MustListExactlyCurrentStatuses()
    {
        var board = NewBoard(S1, S2);
        Assert.Throws<ArgumentException>(() =>
            board.ReorderSwimlanes(new[] { S1, S3 }, TestClock.Now.AddMinutes(1), Guid.NewGuid()));
    }

    [Fact]
    public void ReorderSwimlanes_UpdatesDisplayOrderInPlace()
    {
        var board = NewBoard(S1, S2);
        board.ReorderSwimlanes(new[] { S2, S1 }, TestClock.Now.AddMinutes(1), Guid.NewGuid());

        Assert.Equal(S2, board.Swimlanes.Single(s => s.DisplayOrder == 0).StatusId);
        Assert.Equal(S1, board.Swimlanes.Single(s => s.DisplayOrder == 1).StatusId);
    }
}
