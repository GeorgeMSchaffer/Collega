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
            Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 1, 1), _author, Array.Empty<Guid>(), Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Default);
        var late = Domain.Ideas.Idea.Create(_orgId, _boardId, _statusA, "Late", "desc that is long enough", Priority.Medium,
            Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 12, 31), _author, Array.Empty<Guid>(), Array.Empty<Guid>(), Array.Empty<Guid>(), TestClock.Default);
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

    // --- Organization list: UDF field filters + search scan (T059) -------------------------------

    private OrganizationIdeaListFilter OrgFilter(
        string? search = null,
        IReadOnlyList<IdeaFieldValueFilter>? fieldFilters = null,
        IReadOnlyList<Guid>? searchTextFieldIds = null,
        int pageSize = 50) =>
        new(_orgId, null, null, new PageRequest(1, pageSize), search, null, null, fieldFilters, searchTextFieldIds);

    private Idea IdeaWithField(string title, Guid fieldId, string value)
    {
        var idea = Build.Idea(_orgId, _boardId, _statusA, _author, title: title);
        idea.ReplaceFieldValues(
            new[] { new Domain.Fields.IdeaFieldValueInput(fieldId, value) },
            new[] { fieldId },
            TestClock.Default,
            _author);
        return idea;
    }

    [Fact]
    public async Task ListByOrganization_ContainsFieldFilter_MatchesSubstring()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var field = Guid.NewGuid();
        ctx.Ideas.Add(IdeaWithField("A", field, "Platform Team"));
        ctx.Ideas.Add(IdeaWithField("B", field, "Design Team"));
        await ctx.SaveChangesAsync();

        var filter = OrgFilter(fieldFilters: new[] { new IdeaFieldValueFilter(field, IdeaFieldFilterKind.Contains, Value: "platform") });
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal("A", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_NumberRangeFieldFilter_MatchesWithinBounds()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var field = Guid.NewGuid();
        ctx.Ideas.Add(IdeaWithField("low", field, "100"));
        ctx.Ideas.Add(IdeaWithField("mid", field, "5000"));
        ctx.Ideas.Add(IdeaWithField("high", field, "99999"));
        await ctx.SaveChangesAsync();

        var filter = OrgFilter(fieldFilters: new[] { new IdeaFieldValueFilter(field, IdeaFieldFilterKind.NumberRange, Min: 1000m, Max: 10000m) });
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal("mid", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_DateRangeFieldFilter_MatchesWithinIsoBounds()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var field = Guid.NewGuid();
        ctx.Ideas.Add(IdeaWithField("jan", field, "2026-01-01"));
        ctx.Ideas.Add(IdeaWithField("jun", field, "2026-06-15"));
        ctx.Ideas.Add(IdeaWithField("dec", field, "2026-12-31"));
        await ctx.SaveChangesAsync();

        var filter = OrgFilter(fieldFilters: new[] { new IdeaFieldValueFilter(field, IdeaFieldFilterKind.DateRange, MinText: "2026-03-01", MaxText: "2026-09-01") });
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal("jun", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_MultiSelectFieldFilter_MatchesAnyOf()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var field = Guid.NewGuid();
        var optA = Guid.NewGuid().ToString();
        var optB = Guid.NewGuid().ToString();
        var optC = Guid.NewGuid().ToString();
        ctx.Ideas.Add(IdeaWithField("has-b", field, $"{optA},{optB}"));
        ctx.Ideas.Add(IdeaWithField("no-b", field, $"{optA},{optC}"));
        await ctx.SaveChangesAsync();

        var filter = OrgFilter(fieldFilters: new[] { new IdeaFieldValueFilter(field, IdeaFieldFilterKind.MultiSelectContains, Value: optB) });
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal("has-b", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_Search_ScansTextFieldValues()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var field = Guid.NewGuid();
        ctx.Ideas.Add(IdeaWithField("Untitled work", field, "find the needle here"));
        ctx.Ideas.Add(IdeaWithField("Unrelated", field, "nothing to see"));
        await ctx.SaveChangesAsync();

        // "needle" is only in a Text field value, not the title, so the scan must find it.
        var filter = OrgFilter(search: "needle", searchTextFieldIds: new[] { field });
        var page = await repo.ListByOrganizationAsync(filter, default);

        Assert.Equal("Untitled work", Assert.Single(page.Items).Title);
    }
}
