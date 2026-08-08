using Collega.Domain.Enums;
using Collega.Domain.Fields;
using Collega.Domain.Ideas;

namespace Collega.Domain.Tests;

public sealed class IdeaTests
{
    private static readonly Guid OrgId = Guid.NewGuid();
    private static readonly Guid BoardId = Guid.NewGuid();
    private static readonly Guid StatusId = Guid.NewGuid();
    private static readonly Guid AuthorId = Guid.NewGuid();
    private static readonly Guid IdeaTypeId = Guid.NewGuid();
    private static readonly Guid BusinessImpactId = Guid.NewGuid();

    private static Idea NewIdea(
        string? title = "Improve onboarding",
        string? description = "We should streamline the first-run flow.",
        IReadOnlyCollection<Guid>? assignees = null,
        IReadOnlyCollection<Guid>? tags = null,
        Guid? ideaTypeId = null,
        Guid? businessImpactId = null) =>
        Idea.Create(
            OrgId, BoardId, StatusId, title!, description!, Priority.Medium,
            ideaTypeId ?? IdeaTypeId, businessImpactId ?? BusinessImpactId, dueDate: null, AuthorId,
            assignees ?? Array.Empty<Guid>(), tags ?? Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Now);

    [Fact]
    public void Create_SetsCoreFields()
    {
        var idea = NewIdea();

        Assert.Equal(OrgId, idea.OrganizationId);
        Assert.Equal(StatusId, idea.StatusId);
        Assert.Equal(Priority.Medium, idea.Priority);
        Assert.Equal(IdeaTypeId, idea.IdeaTypeId);
        Assert.Equal(BusinessImpactId, idea.BusinessImpactId);
        Assert.False(idea.IsDeleted);
    }

    [Fact]
    public void Create_RejectsEmptyIdeaType()
    {
        Assert.Throws<ArgumentException>(() => NewIdea(ideaTypeId: Guid.Empty));
    }

    [Fact]
    public void Create_RejectsEmptyBusinessImpact()
    {
        Assert.Throws<ArgumentException>(() => NewIdea(businessImpactId: Guid.Empty));
    }

    [Fact]
    public void UpdateContent_ChangesClassification()
    {
        var idea = NewIdea();
        var newType = Guid.NewGuid();
        var newImpact = Guid.NewGuid();

        idea.UpdateContent("Retitled", "A revised description.", Priority.High, newType, newImpact, dueDate: null, TestClock.Now.AddMinutes(1), AuthorId);

        Assert.Equal(newType, idea.IdeaTypeId);
        Assert.Equal(newImpact, idea.BusinessImpactId);
    }

    [Fact]
    public void Create_RejectsTitleOverMax()
    {
        var longTitle = new string('x', Idea.TitleMaxLength + 1);
        Assert.Throws<ArgumentException>(() => NewIdea(title: longTitle));
    }

    [Fact]
    public void Create_RejectsDescriptionOverMax()
    {
        var longDesc = new string('x', Idea.DescriptionMaxLength + 1);
        Assert.Throws<ArgumentException>(() => NewIdea(description: longDesc));
    }

    [Fact]
    public void Create_RejectsMoreThanFiveAssignees()
    {
        var six = Enumerable.Range(0, 6).Select(_ => Guid.NewGuid()).ToArray();
        Assert.Throws<ArgumentException>(() => NewIdea(assignees: six));
    }

    [Fact]
    public void Create_AllowsUpToFiveAssignees_AndDeduplicates()
    {
        var dup = Guid.NewGuid();
        var idea = NewIdea(assignees: new[] { dup, dup });
        Assert.Single(idea.Assignees);
    }

    [Fact]
    public void Create_RejectsMoreThanTenTags()
    {
        var eleven = Enumerable.Range(0, 11).Select(_ => Guid.NewGuid()).ToArray();
        Assert.Throws<ArgumentException>(() => NewIdea(tags: eleven));
    }

    [Fact]
    public void ChangeStatus_UpdatesStatusId()
    {
        var idea = NewIdea();
        var newStatus = Guid.NewGuid();
        idea.ChangeStatus(newStatus, TestClock.Now.AddMinutes(1), AuthorId);
        Assert.Equal(newStatus, idea.StatusId);
    }

    [Fact]
    public void SoftDelete_SetsIsDeleted()
    {
        var idea = NewIdea();
        idea.SoftDelete(TestClock.Now.AddMinutes(1), Guid.NewGuid());
        Assert.True(idea.IsDeleted);
    }

    [Fact]
    public void ReplaceTags_RejectsOverLimit()
    {
        var idea = NewIdea();
        var eleven = Enumerable.Range(0, 11).Select(_ => Guid.NewGuid()).ToArray();
        Assert.Throws<ArgumentException>(() => idea.ReplaceTags(eleven, TestClock.Now.AddMinutes(1), AuthorId));
    }

    // ReplaceFieldValues scoping — regression: reconciling one field must not drop values whose
    // definitions are out of the reconciled scope (e.g. archived after they were filled in).
    [Fact]
    public void ReplaceFieldValues_PreservesValuesForOutOfScopeDefinitions()
    {
        var idea = NewIdea();
        var defA = Guid.NewGuid();
        var defB = Guid.NewGuid();

        idea.ReplaceFieldValues(
            new[] { new IdeaFieldValueInput(defA, "a1"), new IdeaFieldValueInput(defB, "b1") },
            new[] { defA, defB },
            TestClock.Now,
            AuthorId);

        // defB is now out of scope (archived); only defA is reconciled, with a changed value.
        idea.ReplaceFieldValues(
            new[] { new IdeaFieldValueInput(defA, "a2") },
            new[] { defA },
            TestClock.Now.AddMinutes(1),
            AuthorId);

        var byDef = idea.FieldValues.ToDictionary(v => v.FieldDefinitionId, v => v.Value);
        Assert.Equal("a2", byDef[defA]);
        Assert.Equal("b1", byDef[defB]); // out-of-scope value preserved, not wiped
    }

    [Fact]
    public void ReplaceFieldValues_ClearsInScopeValueWhenNotResubmitted()
    {
        var idea = NewIdea();
        var defA = Guid.NewGuid();
        var defB = Guid.NewGuid();

        idea.ReplaceFieldValues(
            new[] { new IdeaFieldValueInput(defA, "a1"), new IdeaFieldValueInput(defB, "b1") },
            new[] { defA, defB },
            TestClock.Now,
            AuthorId);

        // Both defs remain in scope, but defA is omitted this time — an in-scope omission clears it.
        idea.ReplaceFieldValues(
            new[] { new IdeaFieldValueInput(defB, "b1") },
            new[] { defA, defB },
            TestClock.Now.AddMinutes(1),
            AuthorId);

        var value = Assert.Single(idea.FieldValues);
        Assert.Equal(defB, value.FieldDefinitionId);
    }
}
