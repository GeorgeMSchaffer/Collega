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

    [Fact]
    public void DefaultFieldMode_IsAllActiveFields()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        Assert.Equal(IdeaTypeFieldMode.AllActiveFields, option.FieldMode);
        Assert.Empty(option.Fields);
        Assert.Null(option.ColorHex);
        Assert.Null(option.Icon);
    }

    [Fact]
    public void SetAppearance_StoresTrimmedColorAndIcon()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        option.SetAppearance("  #1D4ED8 ", "  rocket ", TestClock.Now, Guid.NewGuid());
        Assert.Equal("#1D4ED8", option.ColorHex);
        Assert.Equal("rocket", option.Icon);
    }

    [Fact]
    public void SetAppearance_NullsClearBadge()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        option.SetAppearance("#1D4ED8", "rocket", TestClock.Now, Guid.NewGuid());
        option.SetAppearance(null, null, TestClock.Now, Guid.NewGuid());
        Assert.Null(option.ColorHex);
        Assert.Null(option.Icon);
    }

    [Theory]
    [InlineData("1D4ED8")]
    [InlineData("#12345")]
    [InlineData("#GGGGGG")]
    public void SetAppearance_RejectsInvalidColor(string color)
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        Assert.Throws<ArgumentException>(() => option.SetAppearance(color, null, TestClock.Now, Guid.NewGuid()));
    }

    [Fact]
    public void SetFieldSelection_SwitchesToCuratedAndStoresLinks()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var f1 = Guid.NewGuid();
        var f2 = Guid.NewGuid();

        option.SetFieldSelection(new[]
        {
            new IdeaTypeFieldInput(f1, 2, IsRequired: true),
            new IdeaTypeFieldInput(f2, 1, IsRequired: false),
        }, TestClock.Now, Guid.NewGuid());

        Assert.Equal(IdeaTypeFieldMode.Curated, option.FieldMode);
        Assert.Equal(2, option.Fields.Count);
        Assert.Contains(option.Fields, l => l.FieldDefinitionId == f1 && l.IsRequired && l.DisplayOrder == 2);
    }

    [Fact]
    public void SetFieldSelection_RejectsDuplicateField()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var f1 = Guid.NewGuid();
        Assert.Throws<InvalidOperationException>(() => option.SetFieldSelection(new[]
        {
            new IdeaTypeFieldInput(f1, 1, false),
            new IdeaTypeFieldInput(f1, 2, true),
        }, TestClock.Now, Guid.NewGuid()));
    }

    [Fact]
    public void SetFieldSelection_EmptyList_ClearsToAllActiveFields()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        option.SetFieldSelection(new[] { new IdeaTypeFieldInput(Guid.NewGuid(), 1, false) }, TestClock.Now, Guid.NewGuid());

        option.SetFieldSelection(Array.Empty<IdeaTypeFieldInput>(), TestClock.Now, Guid.NewGuid());

        Assert.Equal(IdeaTypeFieldMode.AllActiveFields, option.FieldMode);
        Assert.Empty(option.Fields);
    }

    [Fact]
    public void ClearFieldSelection_ReturnsToAllActiveFields()
    {
        var option = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        option.SetFieldSelection(new[] { new IdeaTypeFieldInput(Guid.NewGuid(), 1, false) }, TestClock.Now, Guid.NewGuid());

        option.ClearFieldSelection(TestClock.Now, Guid.NewGuid());

        Assert.Equal(IdeaTypeFieldMode.AllActiveFields, option.FieldMode);
        Assert.Empty(option.Fields);
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
