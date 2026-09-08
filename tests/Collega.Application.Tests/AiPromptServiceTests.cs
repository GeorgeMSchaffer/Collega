using Collega.Application.Ai;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Ai;

namespace Collega.Application.Tests;

/// <summary>
/// Site-Admin management of the idea-assist prompt (SPEC/20-feature-ai-idea-assist.md rules 34–38).
/// </summary>
public sealed class AiPromptServiceTests
{
    private const string ValidBody =
        "Draft ideas for this organization.\n\n{{SCOPE_STATEMENT}}\n\n{{ORGANIZATION_CATALOG}}\n";

    private readonly FakeAiPromptVersionRepository _versions = new();
    private readonly FakeIdeaDraftModel _model = new();
    private readonly FakeAiUsageRepository _usageRepository = new();
    private readonly FakeUnitOfWork _unitOfWork = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly TestClock _clock = new();

    private AiPromptService CreateService(FakeCurrentUserContext currentUser, long dailyTokenLimit = 500_000)
    {
        var limits = new AiUsageLimits
        {
            DailyTokenLimit = dailyTokenLimit,
            PerUserCallsPerWindow = 0,
            PerOrganizationCallsPerWindow = 0,
        };

        var usage = new AiUsageService(_usageRepository, currentUser, _unitOfWork, _clock, limits);

        return new AiPromptService(
            _versions, _model, usage, new FakeUserRepository(), currentUser, _audit, _unitOfWork, _clock);
    }

    private static PublishAiPromptCommand Command(string body = ValidBody) =>
        new(body, "Only ideas, please.", "Let's continue on the form.");

    // ---- Authorization (rule 34) ----

    [Fact]
    public async Task Get_IsForbidden_ForAnOrgAdmin()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(Guid.NewGuid()));

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.GetAsync());
    }

    /// <summary>
    /// The View As hole this closes. <c>ICurrentUserContext.Role</c> is the <i>effective</i> role, so a
    /// Site Admin who is currently acting as an Org Admin is refused — deployment configuration must not
    /// be editable from inside an impersonation session.
    /// </summary>
    [Fact]
    public async Task Publish_IsForbidden_ForASiteAdminActingAsSomeoneElse()
    {
        var impersonating = FakeCurrentUserContext.OrgAdmin(Guid.NewGuid());
        impersonating.ImpersonatingRealUserId = Guid.NewGuid();

        var service = CreateService(impersonating);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.PublishAsync(Command()));
    }

    [Fact]
    public async Task Get_IsUnauthorized_ForAnonymousCallers()
    {
        var service = CreateService(FakeCurrentUserContext.Anonymous());

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => service.GetAsync());
    }

    // ---- Default fallback (rule 36) ----

    /// <summary>
    /// An empty table is the normal starting state, not a missing row — so this must read as the
    /// built-in default rather than as an error or an empty prompt.
    /// </summary>
    [Fact]
    public async Task Get_ReturnsTheBuiltInDefault_WhenNothingIsPublished()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        var settings = await service.GetAsync();

        Assert.True(settings.IsBuiltInDefault);
        Assert.Null(settings.Version);
        Assert.Equal(AiPromptDefaults.SystemPromptTemplate, settings.Body);
        Assert.Empty(settings.Versions);
    }

    /// <summary>The default must itself satisfy the rule it imposes on every edit.</summary>
    [Fact]
    public void BuiltInDefault_ContainsBothRequiredPlaceholders()
    {
        Assert.Contains(AiPromptVersion.OrganizationCatalogPlaceholder, AiPromptDefaults.SystemPromptTemplate);
        Assert.Contains(AiPromptVersion.ScopeStatementPlaceholder, AiPromptDefaults.SystemPromptTemplate);
    }

    // ---- Publish / restore / reset (rules 35–36) ----

    [Fact]
    public async Task Publish_MakesTheNewVersionActive()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        var settings = await service.PublishAsync(Command());

        Assert.False(settings.IsBuiltInDefault);
        Assert.Equal(1, settings.Version);
        Assert.Single(settings.Versions);
    }

    [Fact]
    public async Task Publish_RejectsABodyMissingAPlaceholder()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.PublishAsync(Command("No placeholders here at all.")));
    }

    [Fact]
    public async Task Publish_DeactivatesThePreviousVersion()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await service.PublishAsync(Command());
        var settings = await service.PublishAsync(Command(ValidBody + "\nSecond."));

        Assert.Equal(2, settings.Version);
        Assert.Single(settings.Versions, v => v.IsActive);
    }

    /// <summary>
    /// Restore appends rather than reactivating. Reactivating the old row would make the history lie
    /// about what was live when — the one question the history exists to answer.
    /// </summary>
    [Fact]
    public async Task Restore_PublishesACopyAsANewVersion()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await service.PublishAsync(Command());
        await service.PublishAsync(Command(ValidBody + "\nSecond."));

        var settings = await service.RestoreAsync(1);

        Assert.Equal(3, settings.Version);
        Assert.Equal(3, settings.Versions.Count);
        Assert.Equal(await BodyOfVersion(1), settings.Body);
        Assert.Single(settings.Versions, v => v.IsActive);
    }

    [Fact]
    public async Task Restore_IsNotFound_ForAnUnknownVersion()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<NotFoundAppException>(() => service.RestoreAsync(42));
    }

    [Fact]
    public async Task Reset_ReturnsToTheBuiltInDefault_WithoutDeletingHistory()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());
        await service.PublishAsync(Command());

        var settings = await service.ResetToDefaultAsync();

        Assert.True(settings.IsBuiltInDefault);
        Assert.Equal(AiPromptDefaults.SystemPromptTemplate, settings.Body);

        // The row survives — resetting is itself a change worth being able to see.
        Assert.Single(settings.Versions);
        Assert.DoesNotContain(settings.Versions, v => v.IsActive);
    }

    /// <summary>Rule 27: the audit trail records the version, never the body.</summary>
    [Fact]
    public async Task Publish_AuditsWithoutStoringTheBody()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await service.PublishAsync(Command());

        var written = Assert.Single(_audit.Events);
        Assert.Equal("AiPromptPublished", written.EventType);
        Assert.DoesNotContain("ORGANIZATION_CATALOG", written.MetadataJson ?? string.Empty);
        Assert.Contains("\"version\":1", written.MetadataJson ?? string.Empty);
    }

    // ---- Probes (rule 37) ----

    [Fact]
    public async Task Probe_RunsEveryProbe_AndReportsRefusals()
    {
        _model.Next = _model.Next with { InScope = false };
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        var report = await service.ProbeAsync(ValidBody);

        Assert.Equal(3, report.TotalCount);
        Assert.Equal(3, report.RefusedCount);
    }

    /// <summary>
    /// The signal the surface exists for: a prompt that stops refusing must show as allowed, not as a
    /// clean run.
    /// </summary>
    [Fact]
    public async Task Probe_ReportsAllowed_WhenThePromptStopsRefusing()
    {
        _model.Next = _model.Next with { InScope = true };
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        var report = await service.ProbeAsync(ValidBody);

        Assert.Equal(0, report.RefusedCount);
        Assert.All(report.Probes, p => Assert.False(p.Refused));
    }

    /// <summary>
    /// A failed call is not a passed probe. Reporting an outage as "refused" would turn unavailability
    /// into a clean bill of health, which is the one wrong answer this surface can give.
    /// </summary>
    [Fact]
    public async Task Probe_IsUnavailable_WhenTheProviderFails()
    {
        _model.ThrowOnCall = true;
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<AiAssistUnavailableException>(() => service.ProbeAsync(ValidBody));
    }

    [Fact]
    public async Task Probe_IsUnavailable_WhenNoKeyIsConfigured()
    {
        _model.IsConfigured = false;
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<AiAssistUnavailableException>(() => service.ProbeAsync(ValidBody));
    }

    [Fact]
    public async Task Probe_RejectsADraftMissingTheCatalogPlaceholder()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<ValidationAppException>(() => service.ProbeAsync("nothing useful here"));
    }

    /// <summary>Probes must never expose one organization's catalog to a platform admin (rule 37a).</summary>
    [Fact]
    public async Task Probe_UsesASyntheticCatalog()
    {
        _model.Next = _model.Next with { InScope = false };
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await service.ProbeAsync(ValidBody);

        Assert.Equal("Probe Organization", _model.LastContext!.OrganizationName);
        Assert.Equal(Guid.Empty, _model.LastContext.OrganizationId);
    }

    private async Task<string> BodyOfVersion(int version) =>
        (await _versions.GetByVersionAsync(version))!.Body;
}
