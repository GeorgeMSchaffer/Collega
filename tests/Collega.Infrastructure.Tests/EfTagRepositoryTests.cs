using Collega.Domain.Tags;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;

namespace Collega.Infrastructure.Tests;

public sealed class EfTagRepositoryTests
{
    private readonly Guid _orgId = Guid.NewGuid();

    [Fact]
    public async Task GetOrCreate_CreatesNewTags_AndCommits()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);

        var result = await repo.GetOrCreateAsync(_orgId, new[] { "Alpha", "Beta" }, TestClock.Default, null);

        Assert.Equal(2, result.Count);
        Assert.Equal(2, ctx.Tags.Count());
    }

    [Fact]
    public async Task GetOrCreate_ReusesExistingByNormalizedName_CaseInsensitively()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);
        var existing = Tag.Create(_orgId, "Urgent", TestClock.Default);
        ctx.Tags.Add(existing);
        await ctx.SaveChangesAsync();

        var result = await repo.GetOrCreateAsync(_orgId, new[] { "  urgent  " }, TestClock.Default, null);

        Assert.Single(result);
        Assert.Equal(existing.Id, result[0].Id);
        Assert.Equal(1, ctx.Tags.Count());
    }

    [Fact]
    public async Task GetOrCreate_MergesDuplicateSpellingsInRequest()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);

        var result = await repo.GetOrCreateAsync(_orgId, new[] { "Tag", "tag", "TAG" }, TestClock.Default, null);

        Assert.Single(result);
        Assert.Equal(1, ctx.Tags.Count());
    }

    [Fact]
    public async Task GetOrCreate_ScopesReuseToOrganization()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);
        ctx.Tags.Add(Tag.Create(Guid.NewGuid(), "shared", TestClock.Default)); // another org
        await ctx.SaveChangesAsync();

        var result = await repo.GetOrCreateAsync(_orgId, new[] { "shared" }, TestClock.Default, null);

        Assert.Single(result);
        Assert.Equal(_orgId, result[0].OrganizationId);
        Assert.Equal(2, ctx.Tags.Count()); // a new tag for this org
    }

    [Fact]
    public async Task ListByIds_ReturnsRequestedTags()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);
        var a = Tag.Create(_orgId, "a", TestClock.Default);
        var b = Tag.Create(_orgId, "b", TestClock.Default);
        ctx.Tags.AddRange(a, b);
        await ctx.SaveChangesAsync();

        var result = await repo.ListByIdsAsync(new[] { a.Id });

        Assert.Single(result);
        Assert.Equal(a.Id, result[0].Id);
    }

    [Fact]
    public async Task SearchByPrefix_MatchesNormalizedPrefix_OrdersAndLimits()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);
        ctx.Tags.Add(Tag.Create(_orgId, "Urgent", TestClock.Default));
        ctx.Tags.Add(Tag.Create(_orgId, "urban", TestClock.Default));
        ctx.Tags.Add(Tag.Create(_orgId, "backlog", TestClock.Default));
        await ctx.SaveChangesAsync();

        var all = await repo.SearchByPrefixAsync(_orgId, "ur", 10, default);
        Assert.Equal(new[] { "urban", "Urgent" }, all);

        var limited = await repo.SearchByPrefixAsync(_orgId, "ur", 1, default);
        Assert.Single(limited);
    }

    [Fact]
    public async Task SearchByPrefix_ScopesToOrganization()
    {
        using var ctx = InMemoryContext.Create();
        var repo = new EfTagRepository(ctx);
        ctx.Tags.Add(Tag.Create(_orgId, "mine", TestClock.Default));
        ctx.Tags.Add(Tag.Create(Guid.NewGuid(), "mine-other", TestClock.Default));
        await ctx.SaveChangesAsync();

        var result = await repo.SearchByPrefixAsync(_orgId, "min", 10, default);

        Assert.Equal(new[] { "mine" }, result);
    }
}
