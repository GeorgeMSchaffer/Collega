using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Domain.Comments;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfCommentRepositoryTests
{
    private readonly Guid _ideaId = Guid.NewGuid();
    private readonly Guid _author = Guid.NewGuid();

    private Comment NewComment(string body, DateTime when, IReadOnlyCollection<Guid>? mentions = null) =>
        Comment.Create(_ideaId, _author, body, mentions ?? Array.Empty<Guid>(), when);

    [Fact]
    public async Task AddAndGetById_IncludesMentions()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);
        var comment = NewComment("Hello @x", TestClock.Default, new[] { Guid.NewGuid() });

        await repo.AddAsync(comment);
        await ctx.SaveChangesAsync();

        var loaded = await repo.GetByIdAsync(comment.Id);
        Assert.NotNull(loaded);
        Assert.Single(loaded!.Mentions);
    }

    [Fact]
    public async Task Remove_DeletesComment()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);
        var comment = NewComment("Body", TestClock.Default);
        await repo.AddAsync(comment);
        await ctx.SaveChangesAsync();

        repo.Remove(comment);
        await ctx.SaveChangesAsync();

        Assert.Null(await repo.GetByIdAsync(comment.Id));
    }

    [Fact]
    public async Task ListByIdea_OrdersChronologically_AndPages()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);
        var first = NewComment("first", TestClock.Default);
        var second = NewComment("second", TestClock.Default.AddMinutes(1));
        var third = NewComment("third", TestClock.Default.AddMinutes(2));
        await repo.AddAsync(third);
        await repo.AddAsync(first);
        await repo.AddAsync(second);
        await ctx.SaveChangesAsync();

        var page = await repo.ListByIdeaAsync(new CommentListFilter(_ideaId, new PageRequest(1, 2), "asc"), default);

        Assert.Equal(3, page.TotalCount);
        Assert.Equal(new[] { "first", "second" }, page.Items.Select(c => c.Body));
        Assert.Equal("asc", page.SortDirection);
    }

    [Fact]
    public async Task ListByIdea_Descending_ReversesOrder()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);
        await repo.AddAsync(NewComment("first", TestClock.Default));
        await repo.AddAsync(NewComment("second", TestClock.Default.AddMinutes(1)));
        await ctx.SaveChangesAsync();

        var page = await repo.ListByIdeaAsync(new CommentListFilter(_ideaId, new PageRequest(1, 50), "desc"), default);

        Assert.Equal("second", page.Items[0].Body);
    }

    [Fact]
    public async Task CountByIdea_AndCountByIdeaIds()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);
        var otherIdea = Guid.NewGuid();
        await repo.AddAsync(NewComment("a", TestClock.Default));
        await repo.AddAsync(NewComment("b", TestClock.Default));
        await repo.AddAsync(Comment.Create(otherIdea, _author, "c", Array.Empty<Guid>(), TestClock.Default));
        await ctx.SaveChangesAsync();

        Assert.Equal(2, await repo.CountByIdeaAsync(_ideaId));

        var counts = await repo.CountByIdeaIdsAsync(new[] { _ideaId, otherIdea });
        Assert.Equal(2, counts[_ideaId]);
        Assert.Equal(1, counts[otherIdea]);
    }

    [Fact]
    public async Task CountByIdeaIds_EmptyInput_ReturnsEmpty()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfCommentRepository(ctx);

        Assert.Empty(await repo.CountByIdeaIdsAsync(Array.Empty<Guid>()));
    }
}
