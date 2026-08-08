using Collega.Domain.IdeaFields;

namespace Collega.Domain.Tests;

public sealed class IdeaTypeTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    [Fact]
    public void Create_TrimsName()
    {
        var option = IdeaType.Create(OrgId, "  Continuous Improvement  ", 10, TestClock.Now);
        Assert.Equal("Continuous Improvement", option.Name);
        Assert.Equal(10, option.SortOrder);
        Assert.False(option.IsDeleted);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_RejectsEmptyName(string name)
    {
        Assert.Throws<ArgumentException>(() => IdeaType.Create(OrgId, name, 0, TestClock.Now));
    }

    [Fact]
    public void Update_RejectedAfterSoftDelete()
    {
        var option = IdeaType.Create(OrgId, "Process Revision", 10, TestClock.Now);
        option.SoftDelete(TestClock.Now, Guid.NewGuid());
        Assert.Throws<InvalidOperationException>(() => option.Update("Renamed", 20, TestClock.Now, Guid.NewGuid()));
    }

    [Fact]
    public void SoftDelete_IsIdempotent()
    {
        var option = IdeaType.Create(OrgId, "Process Revision", 10, TestClock.Now);
        option.SoftDelete(TestClock.Now, Guid.NewGuid());
        option.SoftDelete(TestClock.Now.AddDays(1), Guid.NewGuid());
        Assert.True(option.IsDeleted);
    }

    [Fact]
    public void MinimumActivePerOrganization_IsOne()
    {
        Assert.Equal(1, IdeaType.MinimumActivePerOrganization);
    }
}

public sealed class BusinessImpactTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    [Fact]
    public void Create_TrimsNameAndColor()
    {
        var option = BusinessImpact.Create(OrgId, "  High  ", "  #D97706 ", 30, TestClock.Now);
        Assert.Equal("High", option.Name);
        Assert.Equal("#D97706", option.Color);
        Assert.Equal(30, option.SortOrder);
    }

    [Theory]
    [InlineData("", "#fff")]
    [InlineData("Name", "")]
    public void Create_RejectsMissingNameOrColor(string name, string color)
    {
        Assert.Throws<ArgumentException>(() => BusinessImpact.Create(OrgId, name, color, 0, TestClock.Now));
    }

    [Fact]
    public void Update_RecolorsAndReorders()
    {
        var option = BusinessImpact.Create(OrgId, "Low", "#16A34A", 10, TestClock.Now);
        option.Update("Low", "#000000", 15, TestClock.Now.AddMinutes(1), Guid.NewGuid());
        Assert.Equal("#000000", option.Color);
        Assert.Equal(15, option.SortOrder);
    }

    [Fact]
    public void Update_RejectedAfterSoftDelete()
    {
        var option = BusinessImpact.Create(OrgId, "Low", "#16A34A", 10, TestClock.Now);
        option.SoftDelete(TestClock.Now, Guid.NewGuid());
        Assert.Throws<InvalidOperationException>(() => option.Update("Low", "#fff", 20, TestClock.Now, Guid.NewGuid()));
    }
}
