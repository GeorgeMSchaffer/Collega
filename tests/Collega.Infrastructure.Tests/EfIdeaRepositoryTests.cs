using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Domain.Ideas;
using Collega.Domain.Tags;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfIdeaRepositoryTests
{
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _boardId = Guid.NewGuid();
    private readonly Guid _statusA = Guid.NewGuid();
    private readonly Guid _statusB = Guid.NewGuid();
    private readonly Guid _author = Guid.NewGuid();

    private static IdeaListFilter Filter(
        Guid boardId,
        Guid? statusId = null,
        string? search = null,
        Priority? priority = null,
        string? tag = null,
        DateOnly? dueBefore = null,
        string? sortBy = null,
        string? sortDirection = null,
        int pageSize = 50) =>
        new(boardId, new PageRequest(1, pageSize), search, statusId, tag, priority, dueBefore, sortBy, sortDirection);

    [Fact]
    public async Task GetById_ExcludesDeletedUnlessRequested_AndIncludesCollections()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var idea = Build.Idea(_orgId, _boardId, _statusA, _author, assignees: new[] { Guid.NewGuid() });
        ctx.Ideas.Add(idea);
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByIdAsync(idea.Id);
        Assert.NotNull(loaded);
        Assert.Single(loaded!.Assignees);

        idea.SoftDelete(TestClock.Default, _author);
        await ctx.SaveChangesAsync();

        Assert.Null(await repo.GetByIdAsync(idea.Id));
        Assert.NotNull(await repo.GetByIdAsync(idea.Id, includeDeleted: true));
    }

    [Fact]
    public async Task ListByBoard_ExcludesDeleted_AndScopesToBoard()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Keep"));
        var deleted = Build.Idea(_orgId, _boardId, _statusA, _author, title: "Gone");
        deleted.SoftDelete(TestClock.Default, _author);
        ctx.Ideas.Add(deleted);
        ctx.Ideas.Add(Build.Idea(_orgId, Guid.NewGuid(), _statusA, _author, title: "OtherBoard"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByBoardAsync(Filter(_boardId), default);

        Assert.Single(page.Items);
        Assert.Equal("Keep", page.Items[0].Title);
    }

    [Fact]
    public async Task ListByBoard_FiltersByStatusAndPriority()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "A", priority: Priority.High));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusB, _author, title: "B", priority: Priority.Low));
        await ctx.SaveChangesAsync();

        var byStatus = await repo.ListByBoardAsync(Filter(_boardId, statusId: _statusA), default);
        Assert.Single(byStatus.Items);
        Assert.Equal("A", byStatus.Items[0].Title);

        var byPriority = await repo.ListByBoardAsync(Filter(_boardId, priority: Priority.Low), default);
        Assert.Single(byPriority.Items);
        Assert.Equal("B", byPriority.Items[0].Title);
    }

    [Fact]
    public async Task ListByBoard_FiltersByTagName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var tag = Tag.Create(_orgId, "Urgent", TestClock.Default);
        ctx.Tags.Add(tag);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Tagged", tags: new[] { tag.Id }));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Untagged"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByBoardAsync(Filter(_boardId, tag: "urgent"), default);

        Assert.Single(page.Items);
        Assert.Equal("Tagged", page.Items[0].Title);
    }

    [Fact]
    public async Task ListByBoard_FiltersByDueBefore()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var early = Domain.Ideas.Idea.Create(_orgId, _boardId, _statusA, "Early", "desc that is long enough", Priority.Medium,
            new DateOnly(2026, 1, 1), _author, Array.Empty<Guid>(), Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Default);
        var late = Domain.Ideas.Idea.Create(_orgId, _boardId, _statusA, "Late", "desc that is long enough", Priority.Medium,
            new DateOnly(2026, 12, 31), _author, Array.Empty<Guid>(), Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Default);
        ctx.Ideas.AddRange(early, late);
        await ctx.SaveChangesAsync();

        var page = await repo.ListByBoardAsync(Filter(_boardId, dueBefore: new DateOnly(2026, 6, 1)), default);

        Assert.Single(page.Items);
        Assert.Equal("Early", page.Items[0].Title);
    }

    [Fact]
    public async Task ListByBoard_SortsByUpvoteCountDescending()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var popular = Build.Idea(_orgId, _boardId, _statusA, _author, title: "Popular");
        var quiet = Build.Idea(_orgId, _boardId, _statusA, _author, title: "Quiet");
        ctx.Ideas.AddRange(popular, quiet);
        ctx.IdeaUpvotes.Add(Domain.Upvotes.IdeaUpvote.Create(popular.Id, Guid.NewGuid(), TestClock.Default));
        ctx.IdeaUpvotes.Add(Domain.Upvotes.IdeaUpvote.Create(popular.Id, Guid.NewGuid(), TestClock.Default));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByBoardAsync(Filter(_boardId, sortBy: "upvotecount", sortDirection: "desc"), default);

        Assert.Equal("Popular", page.Items[0].Title);
    }

    [Fact]
    public async Task ListByBoard_Pages()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        for (var i = 0; i < 5; i++)
        {
            ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: $"Idea {i}"));
        }

        await ctx.SaveChangesAsync();

        var page = await repo.ListByBoardAsync(Filter(_boardId, pageSize: 2), default);

        Assert.Equal(5, page.TotalCount);
        Assert.Equal(2, page.Items.Count);
    }

    [Fact]
    public async Task ExistsByTitleOnBoard_IsCaseInsensitive_AndIgnoresDeleted()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Improve Onboarding"));
        await ctx.SaveChangesAsync();

        Assert.True(await repo.ExistsByTitleOnBoardAsync(_boardId, "improve onboarding"));
        Assert.False(await repo.ExistsByTitleOnBoardAsync(_boardId, "different"));
    }
}
