using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;

namespace Collega.Domain.Tests;

public sealed class IdeaTypeFieldResolverTests
{
    private static readonly Guid OrgId = Guid.NewGuid();

    private static FieldDefinition Field(string name, bool required, int displayOrder) =>
        FieldDefinition.Create(OrgId, name, null, FieldType.Text, required, displayOrder, Array.Empty<FieldOptionInput>(), TestClock.Now);

    [Fact]
    public void AllActiveFields_ReturnsEveryActiveFieldOrderedByDisplayThenName_WithGlobalRequired()
    {
        var type = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var budget = Field("Budget", required: true, displayOrder: 20);
        var owner = Field("Owner", required: false, displayOrder: 10);

        var resolved = IdeaTypeFieldResolver.ResolveEffectiveFields(type, new[] { budget, owner });

        Assert.Equal(new[] { "Owner", "Budget" }, resolved.Select(r => r.Field.Name));
        Assert.False(resolved[0].Required);          // Owner, global not-required
        Assert.True(resolved[1].Required);           // Budget, global required
    }

    [Fact]
    public void Curated_ReturnsOnlyMappedFields_OrderedByLinkOrder_WithPerTypeRequired()
    {
        var type = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var budget = Field("Budget", required: false, displayOrder: 10);   // global not-required
        var owner = Field("Owner", required: true, displayOrder: 20);      // global required
        var notes = Field("Notes", required: false, displayOrder: 30);

        // Map only budget (required per type) and owner (optional per type); leave notes off.
        type.SetFieldSelection(new[]
        {
            new IdeaTypeFieldInput(owner.Id, 1, IsRequired: false),
            new IdeaTypeFieldInput(budget.Id, 2, IsRequired: true),
        }, TestClock.Now, Guid.NewGuid());

        var resolved = IdeaTypeFieldResolver.ResolveEffectiveFields(type, new[] { budget, owner, notes });

        Assert.Equal(new[] { "Owner", "Budget" }, resolved.Select(r => r.Field.Name));  // link order
        Assert.False(resolved[0].Required);   // Owner: per-type override wins over global required
        Assert.True(resolved[1].Required);    // Budget: per-type required overrides global optional
        Assert.DoesNotContain(resolved, r => r.Field.Name == "Notes");
    }

    [Fact]
    public void Curated_SoftDeletedFieldIsFilteredOutEvenIfLinkRemains()
    {
        var type = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var budget = Field("Budget", required: false, displayOrder: 10);
        var owner = Field("Owner", required: false, displayOrder: 20);

        type.SetFieldSelection(new[]
        {
            new IdeaTypeFieldInput(budget.Id, 1, false),
            new IdeaTypeFieldInput(owner.Id, 2, false),
        }, TestClock.Now, Guid.NewGuid());

        // Owner is archived; only active definitions are passed in — the link is retained but filtered.
        var resolved = IdeaTypeFieldResolver.ResolveEffectiveFields(type, new[] { budget });

        Assert.Single(resolved);
        Assert.Equal("Budget", resolved[0].Field.Name);
    }

    [Fact]
    public void AllActiveFields_NeverSurfacesASoftDeletedDefinition()
    {
        var type = IdeaType.Create(OrgId, "Improvement", 10, TestClock.Now);
        var active = Field("Budget", required: false, displayOrder: 10);
        var archived = Field("Legacy", required: false, displayOrder: 20);
        archived.SoftDelete(TestClock.Now, Guid.NewGuid());

        var resolved = IdeaTypeFieldResolver.ResolveEffectiveFields(type, new[] { active, archived });

        Assert.Single(resolved);
        Assert.Equal("Budget", resolved[0].Field.Name);
    }
}
