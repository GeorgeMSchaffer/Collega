using Collega.Domain.Enums;
using Collega.Domain.Ideas;

namespace Collega.Domain.Tests;

public sealed class IdeaTests
{
    private static readonly Guid OrgId = Guid.NewGuid();
    private static readonly Guid BoardId = Guid.NewGuid();
    private static readonly Guid StatusId = Guid.NewGuid();
    private static readonly Guid AuthorId = Guid.NewGuid();

    private static Idea NewIdea(
        string? title = "Improve onboarding",
        string? description = "We should streamline the first-run flow.",
        IReadOnlyCollection<Guid>? assignees = null,
        IReadOnlyCollection<Guid>? tags = null) =>
        Idea.Create(
            OrgId, BoardId, StatusId, title!, description!, Priority.Medium, dueDate: null, AuthorId,
            assignees ?? Array.Empty<Guid>(), tags ?? Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Now);

    [Fact]
    public void Create_SetsCoreFields()
    {
        var idea = NewIdea();

        Assert.Equal(OrgId, idea.OrganizationId);
        Assert.Equal(StatusId, idea.StatusId);
        Assert.Equal(Priority.Medium, idea.Priority);
        Assert.False(idea.IsDeleted);
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
}
