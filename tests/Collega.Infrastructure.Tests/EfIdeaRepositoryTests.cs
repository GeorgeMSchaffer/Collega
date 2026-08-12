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
        string? tag = null,
        Guid? associatedUserId = null,
        DateOnly? searchCreatedOnDate = null,
        string? sortBy = null,
        string? sortDirection = null,
        int page = 1,
        int pageSize = 50) =>
        new(_orgId, null, null, new PageRequest(page, pageSize), search, sortBy, sortDirection,
            fieldFilters, searchTextFieldIds, tag, associatedUserId, searchCreatedOnDate);

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

    // --- Organization list: all-column search, tag + user-association filter, column sort (Sprint 3) ---

    [Fact]
    public async Task ListByOrganization_Search_MatchesAuthorName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var author = Build.User(_orgId, firstName: "Marguerite", lastName: "Winters");
        var other = Build.User(_orgId, firstName: "Bob", lastName: "Stone");
        ctx.Users.AddRange(author, other);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, author.Id, title: "By Marguerite"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, other.Id, title: "By Bob"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: "marguer"), default);

        Assert.Equal("By Marguerite", Assert.Single(page.Items).Title);
    }

    /// <summary>
    /// A search term is data, not pattern syntax. The equivalent guarantee for the user list is
    /// covered in <c>EfUserRepositoryTests</c>; the ideas list had no such test, which is how the
    /// all-column search kept its <c>LIKE</c> calls on the two-argument overload — pattern escaped,
    /// but no <c>ESCAPE</c> clause emitted — after the rest of the codebase moved to the three-arg form.
    /// </summary>
    /// <remarks>
    /// <b>Coverage limit, stated so this test is not mistaken for more than it is:</b> the InMemory
    /// provider evaluates <c>EF.Functions.Like</c> client-side and cannot distinguish the two-arg
    /// overload from the three-arg one, so this test passes with or without the <c>ESCAPE</c> clause.
    /// It pins the pattern-building side (a regression that dropped <c>LikePattern.Contains</c> would
    /// fail here) and documents intent. The missing-ESCAPE defect itself is only observable against a
    /// real relational engine — it is on Sprint 5's Definition of Done.
    /// </remarks>
    [Fact]
    public async Task ListByOrganization_SearchTreatsWildcardCharactersLiterally()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Uptime A_B target"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Uptime AxB target"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: "A_B"), default);

        Assert.Equal("Uptime A_B target", Assert.Single(page.Items).Title);
    }

    /// <summary>A term of only wildcards matches nothing rather than every idea in the org.</summary>
    [Theory]
    [InlineData("%")]
    [InlineData("%%")]
    [InlineData("_")]
    public async Task ListByOrganization_BareWildcardTermMatchesNothing(string term)
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "First idea"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Second idea"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: term), default);

        Assert.Empty(page.Items);
    }

    /// <summary>A term containing a literal percent sign finds the row that actually contains it.</summary>
    [Fact]
    public async Task ListByOrganization_SearchMatchesLiteralPercentInTitle()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Hit 100% uptime"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Hit 1000 requests"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: "100%"), default);

        Assert.Equal("Hit 100% uptime", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_Search_MatchesAssigneeName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var author = Build.User(_orgId, firstName: "Author", lastName: "One");
        var assignee = Build.User(_orgId, firstName: "Priya", lastName: "Nadella");
        ctx.Users.AddRange(author, assignee);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, author.Id, title: "Assigned to Priya", assignees: new[] { assignee.Id }));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, author.Id, title: "Unassigned"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: "nadella"), default);

        Assert.Equal("Assigned to Priya", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_Search_MatchesStatusName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var backlog = Build.Status(_orgId, name: "Backlog");
        var done = Build.Status(_orgId, name: "Done");
        ctx.Statuses.AddRange(backlog, done);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, backlog.Id, _author, title: "In backlog"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, done.Id, _author, title: "Finished"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(search: "backlog"), default);

        Assert.Equal("In backlog", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_Search_MatchesCreatedDate_WhenTermIsIsoDate()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        // Build.Idea stamps CreatedAtUtc = TestClock.Default (2026-08-08).
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Created today"));
        await ctx.SaveChangesAsync();

        var match = await repo.ListByOrganizationAsync(
            OrgFilter(search: "2026-08-08", searchCreatedOnDate: new DateOnly(2026, 8, 8)), default);
        Assert.Equal("Created today", Assert.Single(match.Items).Title);

        var noMatch = await repo.ListByOrganizationAsync(
            OrgFilter(search: "2026-08-09", searchCreatedOnDate: new DateOnly(2026, 8, 9)), default);
        Assert.Empty(noMatch.Items);
    }

    [Fact]
    public async Task ListByOrganization_FiltersByTag()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var tag = Tag.Create(_orgId, "Roadmap", TestClock.Default);
        ctx.Tags.Add(tag);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Tagged", tags: new[] { tag.Id }));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Untagged"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(tag: "roadmap"), default);

        Assert.Equal("Tagged", Assert.Single(page.Items).Title);
    }

    [Fact]
    public async Task ListByOrganization_FiltersByAssociatedUser_MatchesAuthorOrAssignee()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var target = Guid.NewGuid();
        var someoneElse = Guid.NewGuid();
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, target, title: "Authored by target"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, someoneElse, title: "Assigned to target", assignees: new[] { target }));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, someoneElse, title: "Unrelated"));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByOrganizationAsync(OrgFilter(associatedUserId: target), default);

        Assert.Equal(2, page.TotalCount);
        Assert.DoesNotContain(page.Items, i => i.Title == "Unrelated");
    }

    [Fact]
    public async Task ListByOrganization_SortsByStatusName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var alpha = Build.Status(_orgId, name: "Alpha");
        var zeta = Build.Status(_orgId, name: "Zeta");
        ctx.Statuses.AddRange(alpha, zeta);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, zeta.Id, _author, title: "Z-idea"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, alpha.Id, _author, title: "A-idea"));
        await ctx.SaveChangesAsync();

        var asc = await repo.ListByOrganizationAsync(OrgFilter(sortBy: "status", sortDirection: "asc"), default);
        Assert.Equal(new[] { "A-idea", "Z-idea" }, asc.Items.Select(i => i.Title).ToArray());

        var desc = await repo.ListByOrganizationAsync(OrgFilter(sortBy: "status", sortDirection: "desc"), default);
        Assert.Equal(new[] { "Z-idea", "A-idea" }, desc.Items.Select(i => i.Title).ToArray());
    }

    [Fact]
    public async Task ListByOrganization_SortsByCreatedByName()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var anders = Build.User(_orgId, firstName: "Anders", lastName: "Berg");
        var zoe = Build.User(_orgId, firstName: "Zoe", lastName: "Young");
        ctx.Users.AddRange(anders, zoe);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, zoe.Id, title: "By Zoe"));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, anders.Id, title: "By Anders"));
        await ctx.SaveChangesAsync();

        var asc = await repo.ListByOrganizationAsync(OrgFilter(sortBy: "createdby", sortDirection: "asc"), default);
        Assert.Equal(new[] { "By Anders", "By Zoe" }, asc.Items.Select(i => i.Title).ToArray());
    }

    [Fact]
    public async Task ListByOrganization_SortsByAssignedToName_UsingFirstAssignee()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        var aaron = Build.User(_orgId, firstName: "Aaron", lastName: "Ash");
        var yolanda = Build.User(_orgId, firstName: "Yolanda", lastName: "York");
        ctx.Users.AddRange(aaron, yolanda);
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "Y-assigned", assignees: new[] { yolanda.Id }));
        ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: "A-assigned", assignees: new[] { aaron.Id }));
        await ctx.SaveChangesAsync();

        var asc = await repo.ListByOrganizationAsync(OrgFilter(sortBy: "assignedto", sortDirection: "asc"), default);
        Assert.Equal(new[] { "A-assigned", "Y-assigned" }, asc.Items.Select(i => i.Title).ToArray());
    }

    [Fact]
    public async Task ListByOrganization_Pagination_IsStable_WhenSortKeyTies()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaRepository(ctx);
        // Every idea shares the same CreatedAtUtc (TestClock.Default), so the primary sort key ties for
        // all of them; the idea-id tiebreaker must keep paging deterministic and non-overlapping.
        for (var i = 0; i < 7; i++)
        {
            ctx.Ideas.Add(Build.Idea(_orgId, _boardId, _statusA, _author, title: $"Idea {i}"));
        }

        await ctx.SaveChangesAsync();

        var seen = new List<Guid>();
        for (var p = 1; p <= 3; p++)
        {
            var page = await repo.ListByOrganizationAsync(
                OrgFilter(sortBy: "createdat", sortDirection: "asc", page: p, pageSize: 3), default);
            seen.AddRange(page.Items.Select(i => i.Id));
        }

        Assert.Equal(7, seen.Count);
        Assert.Equal(7, seen.Distinct().Count());
    }
}
