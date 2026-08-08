using Collega.Domain.Statuses;

namespace Collega.Domain.Tests;

public sealed class StatusTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    [Fact]
    public void Create_TrimsNameAndColor()
    {
        var status = Status.Create(OrgId, "  In Review  ", "  #D97706 ", 20, TestClock.Now);

        Assert.Equal("In Review", status.Name);
        Assert.Equal("#D97706", status.Color);
        Assert.Equal(20, status.SortOrder);
        Assert.False(status.IsDeleted);
    }

    [Theory]
    [InlineData("", "#fff")]
    [InlineData("Name", "")]
    public void Create_RejectsMissingNameOrColor(string name, string color)
    {
        Assert.Throws<ArgumentException>(() => Status.Create(OrgId, name, color, 0, TestClock.Now));
    }

    [Fact]
    public void Update_RejectedAfterSoftDelete()
    {
        var status = Status.Create(OrgId, "In Review", "#fff", 0, TestClock.Now);
        status.SoftDelete(TestClock.Now, Guid.NewGuid());

        Assert.Throws<InvalidOperationException>(() =>
            status.Update("Renamed", "#000", 1, TestClock.Now.AddMinutes(1), Guid.NewGuid()));
    }

    [Fact]
    public void SoftDelete_IsIdempotent()
    {
        var status = Status.Create(OrgId, "In Review", "#fff", 0, TestClock.Now);

        status.SoftDelete(TestClock.Now, Guid.NewGuid());
        status.SoftDelete(TestClock.Now.AddDays(1), Guid.NewGuid());

        Assert.True(status.IsDeleted);
    }

    [Fact]
    public void MinimumActiveStatusesPerOrganization_IsTwo()
    {
        Assert.Equal(2, Status.MinimumActiveStatusesPerOrganization);
    }
}
