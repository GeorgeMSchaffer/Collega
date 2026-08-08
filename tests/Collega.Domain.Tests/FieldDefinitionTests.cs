using Collega.Domain.Fields;

namespace Collega.Domain.Tests;

public sealed class FieldDefinitionTests
{
    private static readonly DateTime Now = new(2026, 8, 8, 12, 0, 0, DateTimeKind.Utc);
    private static readonly Guid OrgId = Guid.NewGuid();

    private static FieldDefinition CreateText(bool required = false) =>
        FieldDefinition.Create(OrgId, "Budget", null, FieldType.Text, required, 10, Array.Empty<FieldOptionInput>(), Now);

    private static FieldDefinition CreateDropdown(params string[] labels) =>
        FieldDefinition.Create(
            OrgId, "Department", null, FieldType.Dropdown, false, 10,
            labels.Select((l, i) => new FieldOptionInput(null, l, i)).ToList(), Now);

    [Fact]
    public void Create_Text_TrimsNameAndStampsCreated()
    {
        var definition = FieldDefinition.Create(OrgId, "  Budget  ", "  desc  ", FieldType.Number, true, 5, Array.Empty<FieldOptionInput>(), Now);

        Assert.Equal("Budget", definition.Name);
        Assert.Equal("desc", definition.Description);
        Assert.Equal(FieldType.Number, definition.FieldType);
        Assert.True(definition.IsRequired);
        Assert.Equal(Now, definition.CreatedAtUtc);
        Assert.Empty(definition.Options);
    }

    [Fact]
    public void Create_Dropdown_WithoutOptions_Throws()
    {
        Assert.Throws<InvalidOperationException>(() =>
            FieldDefinition.Create(OrgId, "Dept", null, FieldType.Dropdown, false, 10, Array.Empty<FieldOptionInput>(), Now));
    }

    [Fact]
    public void Create_NonOptionType_WithOptions_Throws()
    {
        Assert.Throws<InvalidOperationException>(() =>
            FieldDefinition.Create(OrgId, "Budget", null, FieldType.Text, false, 10, new[] { new FieldOptionInput(null, "x", 0) }, Now));
    }

    [Fact]
    public void Create_Dropdown_WithDuplicateLabels_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => CreateDropdown("Sales", "sales"));
    }

    [Fact]
    public void Create_Dropdown_AssignsFreshOptionIds()
    {
        var definition = CreateDropdown("Sales", "Engineering");

        Assert.Equal(2, definition.Options.Count);
        Assert.All(definition.Options, o => Assert.NotEqual(Guid.Empty, o.Id));
    }

    [Fact]
    public void SetOptions_MatchingId_PreservesOptionIdentity()
    {
        var definition = CreateDropdown("Sales", "Engineering");
        var salesId = definition.Options.Single(o => o.Label == "Sales").Id;

        definition.SetOptions(new[]
        {
            new FieldOptionInput(salesId, "Sales EMEA", 0),   // rename, keep id
            new FieldOptionInput(null, "Marketing", 1)         // new option
        }, Now);

        var renamed = definition.Options.Single(o => o.Id == salesId);
        Assert.Equal("Sales EMEA", renamed.Label);
        Assert.DoesNotContain(definition.Options, o => o.Label == "Engineering"); // removed
        Assert.Contains(definition.Options, o => o.Label == "Marketing");
    }

    [Fact]
    public void SetOptions_ToEmpty_Throws()
    {
        var definition = CreateDropdown("Sales");
        Assert.Throws<InvalidOperationException>(() => definition.SetOptions(Array.Empty<FieldOptionInput>(), Now));
    }

    [Fact]
    public void SoftDelete_IsIdempotent_AndRecordsMetadata()
    {
        var definition = CreateText();
        var actor = Guid.NewGuid();

        definition.SoftDelete(Now, actor);
        definition.SoftDelete(Now.AddHours(1), Guid.NewGuid());

        Assert.True(definition.IsDeleted);
        Assert.Equal(Now, definition.DeletedAtUtc);
        Assert.Equal(actor, definition.DeletedByUserId);
    }

    [Fact]
    public void Update_OnDeletedDefinition_Throws()
    {
        var definition = CreateText();
        definition.SoftDelete(Now, null);

        Assert.Throws<InvalidOperationException>(() => definition.Update("Renamed", null, false, 10, Now, null));
    }

    [Fact]
    public void Create_NameTooLong_Throws()
    {
        var longName = new string('x', FieldDefinition.NameMaxLength + 1);
        Assert.Throws<ArgumentException>(() =>
            FieldDefinition.Create(OrgId, longName, null, FieldType.Text, false, 10, Array.Empty<FieldOptionInput>(), Now));
    }
}
