using Collega.Application.Ai;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Ai;

namespace Collega.Application.Tests;

/// <summary>
/// The AI cost controls (SPEC/20-feature-ai-idea-assist.md rules 28a–28e, SPEC/40-test-strategy.md §7).
/// Covers the daily budget gate, per-organization attribution — including through a View As session,
/// which is the case Sprint 6.5 item 13 proved is easy to get wrong — and the read authorization matrix.
/// </summary>
public class AiUsageServiceTests
{
    private static readonly Guid AcmeId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid HarborId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private readonly FakeAiUsageRepository _usage = new();
    private readonly FakeUnitOfWork _unitOfWork = new();
    private readonly TestClock _clock = new();

    public AiUsageServiceTests()
    {
        _usage.Names[AcmeId] = "Acme Robotics";
        _usage.Names[HarborId] = "Blue Harbor Logistics";
    }

    // ---- Daily budget gate (rule 28a) ----

    [Fact]
    public async Task IsWithinDailyBudget_IsTrue_WhenTodaysConsumptionIsUnderTheLimit()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 400_000);

        Assert.True(await service.IsWithinDailyBudgetAsync());
    }

    [Theory]
    [InlineData(500_000)]  // exactly at the ceiling — the comparison is strictly less-than
    [InlineData(750_000)]  // over, which one large turn can do in a single step
    public async Task IsWithinDailyBudget_IsFalse_AtOrOverTheLimit(int consumed)
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: consumed);

        Assert.False(await service.IsWithinDailyBudgetAsync());
    }

    /// <summary>
    /// The pool is shared across every organization — one org exhausting it stops the others too.
    /// That is the deliberate v1 shape (one deployment key, one global ceiling), not an oversight.
    /// </summary>
    [Fact]
    public async Task IsWithinDailyBudget_SumsEveryOrganization_NotJustTheCallers()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 300_000);
        GivenUsage(HarborId, _clock.UtcNow, inputTokens: 300_000);

        Assert.False(await service.IsWithinDailyBudgetAsync());
    }

    [Fact]
    public async Task IsWithinDailyBudget_ResetsOnTheUtcDayBoundary()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);

        // Spent late on the 8th, right up against the ceiling.
        _clock.UtcNow = new DateTime(2026, 8, 8, 23, 59, 0, DateTimeKind.Utc);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 600_000);
        Assert.False(await service.IsWithinDailyBudgetAsync());

        // One minute later it is a new UTC day, and yesterday's spend no longer counts.
        _clock.UtcNow = new DateTime(2026, 8, 9, 0, 0, 0, DateTimeKind.Utc);
        Assert.True(await service.IsWithinDailyBudgetAsync());
    }

    /// <summary>
    /// A non-positive limit disables the gate — the local-development escape hatch. Asserted so the
    /// disabling cannot be removed by accident, and so it is unmistakably a deliberate branch.
    /// </summary>
    [Fact]
    public async Task IsWithinDailyBudget_IsAlwaysTrue_WhenTheLimitIsNotEnforced()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 0);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 10_000_000);

        Assert.True(await service.IsWithinDailyBudgetAsync());
    }

    // ---- Attribution (rule 28c) ----

    [Fact]
    public async Task Record_AttributesTheCallToTheOrganization_AndPersists()
    {
        var actor = Guid.NewGuid();
        var service = CreateService(FakeCurrentUserContext.User(AcmeId, actor));

        await service.RecordAsync(AcmeId, AiCallOutcome.Succeeded, inputTokens: 1_200, outputTokens: 300);

        var record = Assert.Single(_usage.Records);
        Assert.Equal(AcmeId, record.OrganizationId);
        Assert.Equal(actor, record.ActorUserId);
        Assert.Null(record.OnBehalfOfUserId);
        Assert.Equal(_clock.UtcNow, record.OccurredAtUtc);
        Assert.Equal(1, _unitOfWork.SaveChangesCount);
    }

    /// <summary>
    /// The case that matters. A Site Admin acting as an Acme member spends <b>Acme's</b> budget: the
    /// caller passes <c>ICurrentUserContext.OrganizationId</c>, which during a View As session is the
    /// impersonated user's organization. The actor stays the real administrator, so the row can never
    /// read as though the impersonated user did it unaided.
    /// </summary>
    [Fact]
    public async Task Record_AttributesToTheImpersonatedUsersOrganization_DuringViewAs()
    {
        var realAdmin = Guid.NewGuid();
        var impersonated = Guid.NewGuid();
        var context = FakeCurrentUserContext.User(AcmeId, impersonated);
        context.ImpersonatingRealUserId = realAdmin;

        var service = CreateService(context);
        await service.RecordAsync(AcmeId, AiCallOutcome.Succeeded, inputTokens: 800, outputTokens: 200);

        var record = Assert.Single(_usage.Records);
        Assert.Equal(AcmeId, record.OrganizationId);
        Assert.Equal(realAdmin, record.ActorUserId);
        Assert.Equal(impersonated, record.OnBehalfOfUserId);
    }

    [Theory]
    [InlineData(AiCallOutcome.Refused)]
    [InlineData(AiCallOutcome.Failed)]
    public async Task Record_MetersRefusedAndFailedTurns_BecauseTheyConsumedTokensToo(AiCallOutcome outcome)
    {
        var service = CreateService(FakeCurrentUserContext.User(AcmeId));

        await service.RecordAsync(AcmeId, outcome, inputTokens: 900, outputTokens: 40);

        var record = Assert.Single(_usage.Records);
        Assert.Equal(outcome, record.Outcome);
        Assert.Equal(940, record.TotalTokens);
    }

    /// <summary>
    /// Rates are captured on the row. Re-pricing history when configuration changes would silently
    /// restate what an organization owes, which is the whole reason the columns exist.
    /// </summary>
    [Fact]
    public async Task Record_CapturesTheRatesInEffect_SoLaterRepricingDoesNotRestateHistory()
    {
        var service = CreateService(
            FakeCurrentUserContext.User(AcmeId),
            new AiUsageLimits { InputRatePerMillion = 3.00m, OutputRatePerMillion = 15.00m });

        await service.RecordAsync(AcmeId, AiCallOutcome.Succeeded, inputTokens: 1_000_000, outputTokens: 0);

        // Pricing is reconfigured afterwards. The report reads rates off the row, never off the
        // options, so what Acme already owes is unchanged.
        var repriced = CreateService(
            FakeCurrentUserContext.SiteAdmin(),
            new AiUsageLimits { InputRatePerMillion = 99m, OutputRatePerMillion = 99m });

        var record = Assert.Single(_usage.Records);
        Assert.Equal(3.00m, record.InputRatePerMillion);
        Assert.Equal(15.00m, record.OutputRatePerMillion);
        Assert.Equal(3.00m, record.EstimatedCost());

        var report = await repriced.GetPlatformUsageAsync();
        Assert.Equal(3.00m, Assert.Single(report.Organizations).EstimatedCost);
    }

    [Fact]
    public async Task Record_StampsTheConfiguredModel_SoAModelChangeCannotMislabelHistory()
    {
        var service = CreateService(
            FakeCurrentUserContext.User(AcmeId),
            new AiUsageLimits { Model = "claude-sonnet-5" });

        await service.RecordAsync(AcmeId, AiCallOutcome.Succeeded, inputTokens: 10, outputTokens: 5);

        Assert.Equal("claude-sonnet-5", Assert.Single(_usage.Records).Model);
    }

    // ---- Reporting and authorization (rule 28d) ----

    [Fact]
    public async Task GetPlatformUsage_ReturnsEveryOrganization_WithTodaysConsumptionAgainstTheCap()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin(), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 30_000, outputTokens: 5_000);
        GivenUsage(HarborId, _clock.UtcNow, inputTokens: 2_000, outputTokens: 500);

        var report = await service.GetPlatformUsageAsync();

        Assert.Equal(2, report.Organizations.Count);
        Assert.Equal("Acme Robotics", report.Organizations[0].OrganizationName);  // ordered by consumption
        Assert.Equal(500_000, report.DailyTokenLimit);
        Assert.Equal(37_500, report.TokensUsedToday);
        Assert.Equal(37_500, report.TotalTokens);
        Assert.Equal(2, report.TotalCalls);
    }

    [Theory]
    [InlineData("OrgAdmin")]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task GetPlatformUsage_IsRefused_ForEveryRoleBelowSiteAdmin(string role)
    {
        var service = CreateService(ContextFor(role, AcmeId));

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.GetPlatformUsageAsync());
    }

    [Fact]
    public async Task GetPlatformUsage_IsUnauthorized_WhenTheCallerIsAnonymous()
    {
        var service = CreateService(FakeCurrentUserContext.Anonymous());

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => service.GetPlatformUsageAsync());
    }

    [Fact]
    public async Task GetOrganizationUsage_ReturnsOwnOrganization_ForAnOrgAdmin()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 4_000);
        GivenUsage(HarborId, _clock.UtcNow, inputTokens: 9_000);

        var report = await service.GetOrganizationUsageAsync(AcmeId);

        var only = Assert.Single(report.Organizations);
        Assert.Equal(AcmeId, only.OrganizationId);
        Assert.Equal(4_000, only.TotalTokens);
    }

    /// <summary>
    /// The ceiling is platform-wide and is not an individual organization's business, so the
    /// org-scoped report omits it rather than leaking the shared pool's state.
    /// </summary>
    [Fact]
    public async Task GetOrganizationUsage_OmitsTheDailyCeiling()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId), limit: 500_000);
        GivenUsage(AcmeId, _clock.UtcNow, inputTokens: 4_000);

        var report = await service.GetOrganizationUsageAsync(AcmeId);

        Assert.Null(report.DailyTokenLimit);
        Assert.Null(report.TokensUsedToday);
    }

    /// <summary>404, not 403 — a wrong-org request must not confirm that the organization exists.</summary>
    [Fact]
    public async Task GetOrganizationUsage_IsNotFound_WhenAnOrgAdminAsksForAnotherOrganization()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(AcmeId));

        await Assert.ThrowsAsync<NotFoundAppException>(() => service.GetOrganizationUsageAsync(HarborId));
    }

    [Fact]
    public async Task GetOrganizationUsage_AllowsASiteAdminToReadAnyOrganization()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());
        GivenUsage(HarborId, _clock.UtcNow, inputTokens: 1_000);

        var report = await service.GetOrganizationUsageAsync(HarborId);

        Assert.Equal(HarborId, Assert.Single(report.Organizations).OrganizationId);
    }

    [Theory]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task GetOrganizationUsage_IsRefused_ForNonAdminMembersOfTheSameOrganization(string role)
    {
        var service = CreateService(ContextFor(role, AcmeId));

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.GetOrganizationUsageAsync(AcmeId));
    }

    [Fact]
    public async Task GetPlatformUsage_DefaultsToTheCurrentUtcMonth()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());
        GivenUsage(AcmeId, new DateTime(2026, 7, 31, 23, 0, 0, DateTimeKind.Utc), inputTokens: 5_000);
        GivenUsage(AcmeId, new DateTime(2026, 8, 2, 9, 0, 0, DateTimeKind.Utc), inputTokens: 700);

        var report = await service.GetPlatformUsageAsync();

        Assert.Equal(new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc), report.FromUtc);
        Assert.Equal(_clock.UtcNow, report.ToUtc);
        Assert.Equal(700, Assert.Single(report.Organizations).TotalTokens);  // July is outside the window
    }

    [Fact]
    public async Task GetPlatformUsage_RejectsAnInvertedRange_RatherThanReturningNothing()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<ValidationAppException>(() => service.GetPlatformUsageAsync(
            fromUtc: new DateTime(2026, 8, 10, 0, 0, 0, DateTimeKind.Utc),
            toUtc: new DateTime(2026, 8, 1, 0, 0, 0, DateTimeKind.Utc)));
    }

    /// <summary>
    /// Rule 28e: the meter carries counts, never content. The record type has no field a prompt or a
    /// transcript could be written into — assert it structurally so adding one is a deliberate act.
    /// </summary>
    [Fact]
    public void UsageRecord_ExposesNoPromptOrTranscriptText()
    {
        var stringProperties = typeof(AiUsageRecord)
            .GetProperties()
            .Where(p => p.PropertyType == typeof(string))
            .Select(p => p.Name)
            .ToList();

        Assert.Equal(new[] { "Model" }, stringProperties);
    }

    private AiUsageService CreateService(FakeCurrentUserContext currentUser, AiUsageLimits limits) =>
        new(_usage, currentUser, _unitOfWork, _clock, limits);

    private AiUsageService CreateService(FakeCurrentUserContext currentUser, long? limit = null) =>
        CreateService(currentUser, limit is null
            ? new AiUsageLimits()
            : new AiUsageLimits { DailyTokenLimit = limit.Value });

    private static FakeCurrentUserContext ContextFor(string role, Guid organizationId) => role switch
    {
        "OrgAdmin" => FakeCurrentUserContext.OrgAdmin(organizationId),
        "User" => FakeCurrentUserContext.User(organizationId),
        "ReadOnly" => FakeCurrentUserContext.ReadOnly(organizationId),
        _ => throw new ArgumentOutOfRangeException(nameof(role), role, "Unhandled role."),
    };

    private void GivenUsage(Guid organizationId, DateTime occurredAtUtc, int inputTokens = 0, int outputTokens = 0) =>
        _usage.Records.Add(AiUsageRecord.Create(
            organizationId,
            "claude-sonnet-5",
            occurredAtUtc,
            inputTokens,
            outputTokens,
            inputRatePerMillion: 3.00m,
            outputRatePerMillion: 15.00m,
            AiCallOutcome.Succeeded));
}
