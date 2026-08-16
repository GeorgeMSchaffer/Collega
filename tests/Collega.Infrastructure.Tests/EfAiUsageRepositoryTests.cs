using Collega.Domain.Ai;
using Collega.Infrastructure.Persistence;
using Collega.Infrastructure.Persistence.Repositories;
using Collega.Infrastructure.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Tests;

/// <summary>
/// The AI consumption meter's reads (SPEC/20-feature-ai-idea-assist.md rules 28a, 28c–28d): the
/// platform-wide daily total the budget gate compares against, and the per-organization roll-up
/// behind the usage surface.
/// </summary>
public sealed class EfAiUsageRepositoryTests
{
    private static readonly DateTime Noon = TestClock.Default;

    [Fact]
    public async Task GetTotalTokensSince_SumsEveryOrganization_AndEveryTokenKind()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        Given(ctx, Guid.NewGuid(), Noon, input: 1_000, output: 200, cacheRead: 50, cacheWrite: 10);
        Given(ctx, Guid.NewGuid(), Noon, input: 400, output: 100);
        await ctx.SaveChangesAsync();

        Assert.Equal(1_760, await repository.GetTotalTokensSinceAsync(Noon.Date));
    }

    [Fact]
    public async Task GetTotalTokensSince_ExcludesRowsBeforeTheWindow()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);
        var org = Guid.NewGuid();

        Given(ctx, org, Noon.Date.AddMinutes(-1), input: 900_000);  // yesterday, just before midnight
        Given(ctx, org, Noon.Date, input: 100);                     // midnight exactly — inside
        await ctx.SaveChangesAsync();

        Assert.Equal(100, await repository.GetTotalTokensSinceAsync(Noon.Date));
    }

    [Fact]
    public async Task GetTotalTokensSince_IsZero_WhenNothingHasBeenRecorded()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        Assert.Equal(0, await repository.GetTotalTokensSinceAsync(Noon.Date));
    }

    [Fact]
    public async Task GetUsageByOrganization_GroupsPerOrganization_HeaviestFirst()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        var light = Build.Organization("Blue Harbor", "HARBOR-1");
        var heavy = Build.Organization("Acme Robotics", "ACME-1");
        ctx.Organizations.AddRange(light, heavy);

        Given(ctx, light.Id, Noon, input: 500, output: 100);
        Given(ctx, heavy.Id, Noon, input: 40_000, output: 8_000);
        Given(ctx, heavy.Id, Noon, input: 1_000, output: 250);
        await ctx.SaveChangesAsync();

        var summaries = await repository.GetUsageByOrganizationAsync(Noon.AddDays(-1), Noon.AddDays(1));

        Assert.Collection(
            summaries,
            first =>
            {
                Assert.Equal("Acme Robotics", first.OrganizationName);
                Assert.Equal(2, first.Calls);
                Assert.Equal(41_000, first.InputTokens);
                Assert.Equal(8_250, first.OutputTokens);
                Assert.Equal(49_250, first.TotalTokens);
            },
            second =>
            {
                Assert.Equal("Blue Harbor", second.OrganizationName);
                Assert.Equal(1, second.Calls);
                Assert.Equal(600, second.TotalTokens);
            });
    }

    [Fact]
    public async Task GetUsageByOrganization_ScopesToOneOrganization_WhenAsked()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        var mine = Build.Organization("Acme Robotics", "ACME-1");
        var theirs = Build.Organization("Blue Harbor", "HARBOR-1");
        ctx.Organizations.AddRange(mine, theirs);

        Given(ctx, mine.Id, Noon, input: 300);
        Given(ctx, theirs.Id, Noon, input: 90_000);
        await ctx.SaveChangesAsync();

        var summaries = await repository.GetUsageByOrganizationAsync(Noon.AddDays(-1), Noon.AddDays(1), mine.Id);

        var only = Assert.Single(summaries);
        Assert.Equal(mine.Id, only.OrganizationId);
        Assert.Equal(300, only.TotalTokens);
    }

    /// <summary>
    /// Cost comes from the rates on each row, and cache traffic is priced off the input rate at the
    /// provider's multipliers — 0.1x for a read, 1.25x for a write.
    /// </summary>
    [Fact]
    public async Task GetUsageByOrganization_PricesFromTheRatesStoredOnEachRow()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        var org = Build.Organization();
        ctx.Organizations.Add(org);

        // 1M input @ $3 = $3.00; 1M output @ $15 = $15.00; 1M cache read = $0.30; 1M cache write = $3.75.
        Given(ctx, org.Id, Noon, input: 1_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000);
        await ctx.SaveChangesAsync();

        var only = Assert.Single(await repository.GetUsageByOrganizationAsync(Noon.AddDays(-1), Noon.AddDays(1)));

        Assert.Equal(22.05m, only.EstimatedCost);
    }

    /// <summary>
    /// Usage rows carry no foreign key to Organization, so removing an organization cannot take its
    /// spend history with it — the row survives and reports under a placeholder name.
    /// </summary>
    [Fact]
    public async Task GetUsageByOrganization_StillReportsSpend_ForAnOrganizationThatNoLongerExists()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        Given(ctx, Guid.NewGuid(), Noon, input: 5_000, output: 1_000);
        await ctx.SaveChangesAsync();

        var only = Assert.Single(await repository.GetUsageByOrganizationAsync(Noon.AddDays(-1), Noon.AddDays(1)));

        Assert.Equal("(deleted organization)", only.OrganizationName);
        Assert.Equal(6_000, only.TotalTokens);
    }

    [Fact]
    public async Task GetUsageByOrganization_ExcludesRowsOutsideTheWindow()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        var org = Build.Organization();
        ctx.Organizations.Add(org);

        Given(ctx, org.Id, Noon.AddDays(-10), input: 700_000);
        Given(ctx, org.Id, Noon, input: 42);
        await ctx.SaveChangesAsync();

        var only = Assert.Single(await repository.GetUsageByOrganizationAsync(Noon.AddDays(-1), Noon.AddDays(1)));

        Assert.Equal(42, only.TotalTokens);
    }

    // ---- Rate-limit counts (rule 26) ----

    [Fact]
    public async Task CountCallsSince_ReturnsOrganizationAndActorTallies()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);
        var org = Guid.NewGuid();
        var me = Guid.NewGuid();
        var colleague = Guid.NewGuid();

        Given(ctx, org, Noon, actorUserId: me);
        Given(ctx, org, Noon, actorUserId: me);
        Given(ctx, org, Noon, actorUserId: colleague);
        await ctx.SaveChangesAsync();

        var counts = await repository.CountCallsSinceAsync(org, me, Noon.AddMinutes(-1));

        Assert.Equal(3, counts.OrganizationCalls);
        Assert.Equal(2, counts.ActorCalls);
    }

    [Fact]
    public async Task CountCallsSince_ExcludesOtherOrganizations()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);
        var mine = Guid.NewGuid();
        var actor = Guid.NewGuid();

        Given(ctx, mine, Noon, actorUserId: actor);
        Given(ctx, Guid.NewGuid(), Noon, actorUserId: actor);
        await ctx.SaveChangesAsync();

        var counts = await repository.CountCallsSinceAsync(mine, actor, Noon.AddMinutes(-1));

        Assert.Equal(1, counts.OrganizationCalls);
        Assert.Equal(1, counts.ActorCalls);
    }

    [Fact]
    public async Task CountCallsSince_ExcludesCallsBeforeTheWindow()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);
        var org = Guid.NewGuid();
        var actor = Guid.NewGuid();

        Given(ctx, org, Noon.AddMinutes(-5), actorUserId: actor);
        Given(ctx, org, Noon, actorUserId: actor);
        await ctx.SaveChangesAsync();

        var counts = await repository.CountCallsSinceAsync(org, actor, Noon.AddMinutes(-1));

        Assert.Equal(1, counts.OrganizationCalls);
    }

    [Fact]
    public async Task CountCallsSince_IsZero_WhenNothingIsInTheWindow()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);

        var counts = await repository.CountCallsSinceAsync(Guid.NewGuid(), Guid.NewGuid(), Noon);

        Assert.Equal(0, counts.OrganizationCalls);
        Assert.Equal(0, counts.ActorCalls);
    }

    /// <summary>A null actor still yields the organization tally — the org limit applies regardless.</summary>
    [Fact]
    public async Task CountCallsSince_HandlesANullActor()
    {
        using var ctx = InMemoryContext.Create();
        var repository = new EfAiUsageRepository(ctx);
        var org = Guid.NewGuid();

        Given(ctx, org, Noon, actorUserId: Guid.NewGuid());
        await ctx.SaveChangesAsync();

        var counts = await repository.CountCallsSinceAsync(org, null, Noon.AddMinutes(-1));

        Assert.Equal(1, counts.OrganizationCalls);
        Assert.Equal(0, counts.ActorCalls);
    }

    [Fact]
    public async Task Add_StagesTheRecord_ForTheCallersUnitOfWork()
    {
        var dbName = Guid.NewGuid().ToString();

        using (var ctx = InMemoryContext.Create(dbName))
        {
            var repository = new EfAiUsageRepository(ctx);
            await repository.AddAsync(Record(Guid.NewGuid(), Noon, input: 10, output: 5));

            // The repository stages; it deliberately does not commit — the use case owns the boundary.
            Assert.Empty(await InMemoryContext.Create(dbName).AiUsageRecords.ToListAsync());

            await ctx.SaveChangesAsync();
        }

        using var verify = InMemoryContext.Create(dbName);
        Assert.Equal(15, (await verify.AiUsageRecords.SingleAsync()).TotalTokens);
    }

    private static void Given(
        CollegaDbContext ctx,
        Guid organizationId,
        DateTime occurredAtUtc,
        int input = 0,
        int output = 0,
        int cacheRead = 0,
        int cacheWrite = 0,
        Guid? actorUserId = null) =>
        ctx.AiUsageRecords.Add(Record(organizationId, occurredAtUtc, input, output, cacheRead, cacheWrite, actorUserId));

    private static AiUsageRecord Record(
        Guid organizationId,
        DateTime occurredAtUtc,
        int input = 0,
        int output = 0,
        int cacheRead = 0,
        int cacheWrite = 0,
        Guid? actorUserId = null) =>
        AiUsageRecord.Create(
            organizationId,
            "claude-sonnet-5",
            occurredAtUtc,
            input,
            output,
            inputRatePerMillion: 3.00m,
            outputRatePerMillion: 15.00m,
            AiCallOutcome.Succeeded,
            actorUserId,
            cacheReadInputTokens: cacheRead,
            cacheCreationInputTokens: cacheWrite);
}
