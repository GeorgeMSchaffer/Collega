using Collega.Domain.Upvotes;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfIdeaUpvoteRepositoryTests
{
    private readonly Guid _ideaId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task AddAndGet_RoundTripsByIdeaAndUser()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);

        await repo.AddAsync(IdeaUpvote.Create(_ideaId, _userId, TestClock.Default));
        await ctx.SaveChangesAsync();

        Assert.NotNull(await repo.GetAsync(_ideaId, _userId));
        Assert.Null(await repo.GetAsync(_ideaId, Guid.NewGuid()));
    }

    [Fact]
    public async Task Remove_DeletesUpvote()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);
        var upvote = IdeaUpvote.Create(_ideaId, _userId, TestClock.Default);
        await repo.AddAsync(upvote);
        await ctx.SaveChangesAsync();

        repo.Remove(upvote);
        await ctx.SaveChangesAsync();

        Assert.Null(await repo.GetAsync(_ideaId, _userId));
    }

    [Fact]
    public async Task CountByIdea_CountsAllCasters()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);
        await repo.AddAsync(IdeaUpvote.Create(_ideaId, Guid.NewGuid(), TestClock.Default));
        await repo.AddAsync(IdeaUpvote.Create(_ideaId, Guid.NewGuid(), TestClock.Default));
        await ctx.SaveChangesAsync();

        Assert.Equal(2, await repo.CountByIdeaAsync(_ideaId));
    }

    [Fact]
    public async Task CountByIdeaIds_GroupsCounts()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);
        var other = Guid.NewGuid();
        await repo.AddAsync(IdeaUpvote.Create(_ideaId, Guid.NewGuid(), TestClock.Default));
        await repo.AddAsync(IdeaUpvote.Create(_ideaId, Guid.NewGuid(), TestClock.Default));
        await repo.AddAsync(IdeaUpvote.Create(other, Guid.NewGuid(), TestClock.Default));
        await ctx.SaveChangesAsync();

        var counts = await repo.CountByIdeaIdsAsync(new[] { _ideaId, other });

        Assert.Equal(2, counts[_ideaId]);
        Assert.Equal(1, counts[other]);
    }

    [Fact]
    public async Task GetUpvotedIdeaIds_ReturnsOnlyCallersUpvotes()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);
        var ideaB = Guid.NewGuid();
        var ideaC = Guid.NewGuid();
        await repo.AddAsync(IdeaUpvote.Create(_ideaId, _userId, TestClock.Default));
        await repo.AddAsync(IdeaUpvote.Create(ideaB, _userId, TestClock.Default));
        await repo.AddAsync(IdeaUpvote.Create(ideaC, Guid.NewGuid(), TestClock.Default)); // someone else
        await ctx.SaveChangesAsync();

        var result = await repo.GetUpvotedIdeaIdsAsync(_userId, new[] { _ideaId, ideaB, ideaC });

        Assert.Equal(2, result.Count);
        Assert.Contains(_ideaId, result);
        Assert.Contains(ideaB, result);
        Assert.DoesNotContain(ideaC, result);
    }

    [Fact]
    public async Task CountAndUpvoted_EmptyInputs_ReturnEmpty()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfIdeaUpvoteRepository(ctx);

        Assert.Empty(await repo.CountByIdeaIdsAsync(Array.Empty<Guid>()));
        Assert.Empty(await repo.GetUpvotedIdeaIdsAsync(_userId, Array.Empty<Guid>()));
    }
}
