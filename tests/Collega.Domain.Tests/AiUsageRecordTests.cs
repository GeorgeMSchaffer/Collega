using Collega.Domain.Ai;

namespace Collega.Domain.Tests;

/// <summary>
/// Invariants of the AI consumption meter (SPEC/20-feature-ai-idea-assist.md rule 28c). The entity's
/// job is to make an unattributable or under-counted row impossible to construct, and to price itself
/// from the rates it was created with.
/// </summary>
public class AiUsageRecordTests
{
    private static readonly Guid OrganizationId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    [Fact]
    public void Create_RecordsAttribution_AndDefaultsToThePlatformKey()
    {
        var actor = Guid.NewGuid();
        var board = Guid.NewGuid();

        var record = Create(actorUserId: actor, boardId: board);

        Assert.Equal(OrganizationId, record.OrganizationId);
        Assert.Equal(actor, record.ActorUserId);
        Assert.Equal(board, record.BoardId);
        Assert.Equal(TestClock.Now, record.OccurredAtUtc);
        Assert.Equal(AiKeySource.Platform, record.KeySource);
    }

    /// <summary>
    /// An unattributed row is spend nobody can be billed for, so the entity refuses to exist without
    /// an organization — unlike <c>AuditEvent</c>, where a platform-level action legitimately has none.
    /// </summary>
    [Fact]
    public void Create_Rejects_AnEmptyOrganizationId()
    {
        Assert.Throws<ArgumentException>(() => Create(organizationId: Guid.Empty));
    }

    [Fact]
    public void Create_Rejects_AMissingModel()
    {
        Assert.Throws<ArgumentException>(() => Create(model: "   "));
    }

    /// <summary>
    /// A provider reporting a negative count would corrupt the daily total in the direction of
    /// under-counting — the direction that lets spend run past the ceiling.
    /// </summary>
    [Theory]
    [InlineData(-1, 0, 0, 0)]
    [InlineData(0, -1, 0, 0)]
    [InlineData(0, 0, -1, 0)]
    [InlineData(0, 0, 0, -1)]
    public void Create_Rejects_NegativeTokenCounts(int input, int output, int cacheRead, int cacheWrite)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Create(inputTokens: input, outputTokens: output, cacheRead: cacheRead, cacheWrite: cacheWrite));
    }

    [Fact]
    public void TotalTokens_CountsEveryKind_IncludingCacheTraffic()
    {
        var record = Create(inputTokens: 1_000, outputTokens: 200, cacheRead: 50, cacheWrite: 10);

        Assert.Equal(1_260, record.TotalTokens);
    }

    /// <summary>
    /// Cache reads bill at 0.1x the input rate and cache writes at 1.25x — the provider's published
    /// multipliers, and the reason a busy organization's cost can be lower than its token count reads.
    /// </summary>
    [Fact]
    public void EstimatedCost_PricesEachTokenKindAtItsOwnMultiplier()
    {
        var record = Create(
            inputTokens: 1_000_000,   // $3.00
            outputTokens: 1_000_000,  // $15.00
            cacheRead: 1_000_000,     // $0.30
            cacheWrite: 1_000_000);   // $3.75

        Assert.Equal(22.05m, record.EstimatedCost());
    }

    [Fact]
    public void EstimatedCost_UsesTheRatesTheRecordWasCreatedWith()
    {
        var cheap = Create(inputTokens: 1_000_000, inputRate: 1.00m);
        var dear = Create(inputTokens: 1_000_000, inputRate: 5.00m);

        Assert.Equal(1.00m, cheap.EstimatedCost());
        Assert.Equal(5.00m, dear.EstimatedCost());
    }

    [Fact]
    public void Create_TrimsTheModelId()
    {
        Assert.Equal("claude-sonnet-5", Create(model: "  claude-sonnet-5  ").Model);
    }

    private static AiUsageRecord Create(
        Guid? organizationId = null,
        string model = "claude-sonnet-5",
        int inputTokens = 0,
        int outputTokens = 0,
        decimal inputRate = 3.00m,
        decimal outputRate = 15.00m,
        AiCallOutcome outcome = AiCallOutcome.Succeeded,
        Guid? actorUserId = null,
        Guid? onBehalfOfUserId = null,
        Guid? boardId = null,
        int cacheRead = 0,
        int cacheWrite = 0) =>
        AiUsageRecord.Create(
            organizationId ?? OrganizationId,
            model,
            TestClock.Now,
            inputTokens,
            outputTokens,
            inputRate,
            outputRate,
            outcome,
            actorUserId,
            onBehalfOfUserId,
            boardId,
            cacheRead,
            cacheWrite);
}
