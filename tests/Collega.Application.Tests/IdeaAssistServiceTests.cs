using Collega.Application.Ai;
using Collega.Application.Exceptions;
using Collega.Application.Tests.TestDoubles;
using Collega.Domain.Ai;
using Collega.Domain.Enums;
using Collega.Domain.IdeaFields;
using Collega.Domain.Organizations;

namespace Collega.Application.Tests;

/// <summary>
/// AI-assisted idea drafting (SPEC/20-feature-ai-idea-assist.md, SPEC/40-test-strategy.md §7).
/// </summary>
/// <remarks>
/// The provider is always faked — no test may reach a model. That is not only a hermeticity rule: it
/// is the only way to exercise the branches that matter, because a real model would not reliably
/// return a cross-org id or a malformed payload on demand.
/// </remarks>
public class IdeaAssistServiceTests
{
    private readonly FakeIdeaDraftModel _model = new();
    private readonly RecordingAuditEventWriter _audit = new();
    private readonly FakeAiUsageRepository _usageRepository = new();
    private readonly FakeUnitOfWork _unitOfWork = new();
    private readonly TestClock _clock = new();

    private readonly Organization _acme = Build.Organization("Acme Robotics", "ACME-1");
    private readonly Organization _harbor = Build.Organization("Blue Harbor", "HARBOR-1");

    private IdeaType _processType = null!;
    private BusinessImpact _highImpact = null!;
    private Domain.Boards.Board _acmeBoard = null!;
    private Domain.Boards.Board _harborBoard = null!;

    public IdeaAssistServiceTests()
    {
        _processType = IdeaType.Create(_acme.Id, "Process Revision", 10, TestClock.Default);
        _highImpact = BusinessImpact.Create(_acme.Id, "High", "#EF4444", 10, TestClock.Default);

        var acmeStatus = Build.Status(_acme.Id, "New");
        var acmeStatus2 = Build.Status(_acme.Id, "Doing", sortOrder: 20);
        _acmeBoard = Build.Board(_acme.Id, new[] { acmeStatus.Id, acmeStatus2.Id });

        var harborStatus = Build.Status(_harbor.Id, "New");
        var harborStatus2 = Build.Status(_harbor.Id, "Doing", sortOrder: 20);
        _harborBoard = Build.Board(_harbor.Id, new[] { harborStatus.Id, harborStatus2.Id });

        _statuses = new FakeStatusRepository(acmeStatus, acmeStatus2, harborStatus, harborStatus2);
    }

    private readonly FakeStatusRepository _statuses;

    // ---- Availability and degradation (rules 31–32) ----

    [Fact]
    public async Task IsAvailable_IsTrue_WhenConfiguredAndWithinBudget()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        Assert.True(await service.IsAvailableAsync());
    }

    [Fact]
    public async Task IsAvailable_IsFalse_WhenNoKeyIsConfigured()
    {
        _model.IsConfigured = false;
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        Assert.False(await service.IsAvailableAsync());
    }

    /// <summary>
    /// The case the page-load pre-check exists for is the one it cannot see coming: the budget is
    /// exhausted mid-day, not at deploy time. This pins that the probe tracks the budget rather than
    /// only key configuration — a probe that reported only "is a key set" would answer true all day
    /// while every turn 503'd.
    /// </summary>
    [Fact]
    public async Task IsAvailable_IsFalse_WhenTheDailyBudgetIsExhausted()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id), dailyTokenLimit: 1_000);
        GivenTokensSpentToday(1_500);

        Assert.False(await service.IsAvailableAsync());
    }

    /// <summary>The probe makes no provider call, so it must not be billable or rate limited.</summary>
    [Fact]
    public async Task IsAvailable_DoesNotCallTheProvider()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await service.IsAvailableAsync();

        Assert.Equal(0, _model.CallCount);
    }

    [Fact]
    public async Task Continue_IsUnavailable_WhenNoKeyIsConfigured()
    {
        _model.IsConfigured = false;
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await Assert.ThrowsAsync<AiAssistUnavailableException>(() => service.ContinueAsync(Request()));
    }

    /// <summary>
    /// The budget gate runs <b>before</b> the provider — the point of a cap is to not spend. Asserting
    /// the fake was never invoked is the test; a 503 alone would pass even if the call had been made.
    /// </summary>
    [Fact]
    public async Task Continue_DoesNotCallTheProvider_WhenTheDailyBudgetIsExhausted()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id), dailyTokenLimit: 1_000);
        GivenTokensSpentToday(1_500);

        await Assert.ThrowsAsync<AiAssistUnavailableException>(() => service.ContinueAsync(Request()));

        Assert.Equal(0, _model.CallCount);
    }

    /// <summary>
    /// Rate limiting is 429, deliberately not folded into the 503 above: "unavailable" tells a client
    /// to stop asking, "rate limited" tells it to retry shortly. And like the budget gate it runs
    /// before the provider — asserting the fake was never called is the test.
    /// </summary>
    [Fact]
    public async Task Continue_IsRateLimited_BeforeTheProviderIsCalled()
    {
        var actor = Guid.NewGuid();
        var service = CreateService(
            FakeCurrentUserContext.User(_acme.Id, actor),
            limits: new AiUsageLimits { PerUserCallsPerWindow = 2 });

        for (var i = 0; i < 2; i++)
        {
            _usageRepository.Records.Add(AiUsageRecord.Create(
                _acme.Id, "claude-sonnet-5", TestClock.Default, 10, 5, 3.00m, 15.00m,
                AiCallOutcome.Succeeded, actor));
        }

        await Assert.ThrowsAsync<RateLimitedAppException>(() => service.ContinueAsync(Request()));

        Assert.Equal(0, _model.CallCount);
    }

    [Fact]
    public async Task Continue_DegradesAndStillMeters_WhenTheProviderFails()
    {
        _model.ThrowOnCall = true;
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await Assert.ThrowsAsync<AiAssistUnavailableException>(() => service.ContinueAsync(Request()));

        // A failed turn consumed tokens, so it is still recorded — a meter that counted only successes
        // would not bound spend (rule 28c).
        var record = Assert.Single(_usageRepository.Records);
        Assert.Equal(AiCallOutcome.Failed, record.Outcome);
        Assert.Equal(_acme.Id, record.OrganizationId);
    }

    // ---- Containment: ids are re-validated against the retrieved set (rule 16) ----

    /// <summary>
    /// The schema already makes this structurally impossible; this proves the belt as well as the
    /// braces. A cross-org id must never reach a client, whatever the model returns.
    /// </summary>
    [Fact]
    public async Task Continue_DropsAnIdeaTypeIdFromAnotherOrganization()
    {
        var foreignType = IdeaType.Create(_harbor.Id, "Harbor Only", 10, TestClock.Default);
        _model.Next = Response(draft: new IdeaDraft(IdeaTypeId: foreignType.Id));

        var service = CreateService(FakeCurrentUserContext.User(_acme.Id), extraIdeaTypes: foreignType);
        var result = await service.ContinueAsync(Request());

        Assert.Null(result.Draft.IdeaTypeId);
    }

    [Fact]
    public async Task Continue_DropsAnInventedOptionId()
    {
        _model.Next = Response(draft: new IdeaDraft(
            IdeaTypeId: Guid.NewGuid(),
            BusinessImpactId: Guid.NewGuid()));

        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var result = await service.ContinueAsync(Request());

        Assert.Null(result.Draft.IdeaTypeId);
        Assert.Null(result.Draft.BusinessImpactId);
    }

    [Fact]
    public async Task Continue_KeepsIdsThatAreRealActiveOptions()
    {
        _model.Next = Response(draft: new IdeaDraft(
            Title: "Rework intake",
            IdeaTypeId: _processType.Id,
            BusinessImpactId: _highImpact.Id,
            Priority: Priority.High));

        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var result = await service.ContinueAsync(Request());

        Assert.Equal(_processType.Id, result.Draft.IdeaTypeId);
        Assert.Equal(_highImpact.Id, result.Draft.BusinessImpactId);
        Assert.Equal(Priority.High, result.Draft.Priority);
        Assert.Equal("Rework intake", result.Draft.Title);
    }

    /// <summary>A rejected suggestion falls back to what the draft already held, never to null.</summary>
    [Fact]
    public async Task Continue_KeepsThePriorValue_WhenASuggestedIdIsRejected()
    {
        _model.Next = Response(draft: new IdeaDraft(IdeaTypeId: Guid.NewGuid()));
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        var result = await service.ContinueAsync(
            Request(draft: new IdeaDraft(IdeaTypeId: _processType.Id)));

        Assert.Equal(_processType.Id, result.Draft.IdeaTypeId);
    }

    [Fact]
    public async Task Continue_TruncatesTitleAndDescriptionToTheDomainMaxima()
    {
        _model.Next = Response(draft: new IdeaDraft(
            Title: new string('t', Domain.Ideas.Idea.TitleMaxLength + 50),
            Description: new string('d', Domain.Ideas.Idea.DescriptionMaxLength + 50)));

        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var result = await service.ContinueAsync(Request());

        Assert.Equal(Domain.Ideas.Idea.TitleMaxLength, result.Draft.Title!.Length);
        Assert.Equal(Domain.Ideas.Idea.DescriptionMaxLength, result.Draft.Description!.Length);
    }

    // ---- Scope gate (rules 8, 10) ----

    [Fact]
    public async Task Continue_ReturnsTheFixedRedirect_AndLeavesTheDraftUnchanged_WhenRefused()
    {
        _model.Next = Response(inScope: false, nextQuestion: "here is a limerick", draft: new IdeaDraft(Title: "nope"));
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        var existing = new IdeaDraft(Title: "Rework intake", IdeaTypeId: _processType.Id);
        var result = await service.ContinueAsync(Request(draft: existing));

        Assert.False(result.InScope);
        // The model's text is discarded — a model-authored refusal would be a free-text channel by
        // another name, so the redirect is always the server's fixed string.
        Assert.Equal(IdeaAssistService.OutOfScopeRedirect, result.NextQuestion);
        Assert.Equal("Rework intake", result.Draft.Title);
        Assert.Equal(_processType.Id, result.Draft.IdeaTypeId);
    }

    /// <summary>
    /// Three refusals in a row close the chat — counted from the <b>server's own</b> usage records,
    /// which is the only source a probing caller cannot edit.
    /// </summary>
    [Fact]
    public async Task Continue_ClosesTheConversation_OnThreeConsecutiveRefusals()
    {
        var actor = Guid.NewGuid();
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id, actor));

        // Two refusals already on the board, then the third arrives now.
        GivenPriorOutcome(actor, AiCallOutcome.Refused);
        GivenPriorOutcome(actor, AiCallOutcome.Refused);

        var result = await service.ContinueAsync(Request());

        Assert.False(result.InScope);
        Assert.True(result.ConversationClosed);
    }

    /// <summary>
    /// The regression this replaced. The client drops refused turns from the transcript it resends —
    /// by design, so off-topic context never accumulates — which meant a strike count read from that
    /// transcript was always zero in the product and the close never fired, even though a test that
    /// hand-built the redirects passed. A hostile client could erase the evidence just as easily.
    /// </summary>
    [Fact]
    public async Task Continue_StillCloses_WhenTheClientSendsNoTraceOfEarlierRefusals()
    {
        var actor = Guid.NewGuid();
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id, actor));

        GivenPriorOutcome(actor, AiCallOutcome.Refused);
        GivenPriorOutcome(actor, AiCallOutcome.Refused);

        // A transcript with a single user turn and nothing else — exactly what the real client sends
        // after two refusals, and what an attacker would send deliberately.
        var result = await service.ContinueAsync(new IdeaAssistTurnRequest(
            _acmeBoard.Id,
            new List<IdeaAssistTurn> { new(IdeaAssistTurn.UserRole, "and now a haiku") }));

        Assert.True(result.ConversationClosed);
    }

    /// <summary>An in-scope turn between refusals breaks the run — "consecutive" means consecutive.</summary>
    [Fact]
    public async Task Continue_DoesNotClose_WhenAGoodTurnBrokeTheRun()
    {
        var actor = Guid.NewGuid();
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id, actor));

        GivenPriorOutcome(actor, AiCallOutcome.Refused);
        GivenPriorOutcome(actor, AiCallOutcome.Succeeded);

        var result = await service.ContinueAsync(Request());

        Assert.False(result.ConversationClosed);
    }

    /// <summary>Strikes are per board: probing one board must not close a conversation on another.</summary>
    [Fact]
    public async Task Continue_DoesNotCloseFromRefusalsOnAnotherBoard()
    {
        var actor = Guid.NewGuid();
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id, actor));

        GivenPriorOutcome(actor, AiCallOutcome.Refused, boardId: Guid.NewGuid());
        GivenPriorOutcome(actor, AiCallOutcome.Refused, boardId: Guid.NewGuid());

        var result = await service.ContinueAsync(Request());

        Assert.False(result.ConversationClosed);
    }

    [Fact]
    public async Task Continue_DoesNotCloseOnASingleRefusal()
    {
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        var result = await service.ContinueAsync(Request());

        Assert.False(result.ConversationClosed);
    }

    [Fact]
    public async Task Continue_MetersARefusedTurn_AsRefusedRatherThanSkippingIt()
    {
        _model.Next = Response(inScope: false);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await service.ContinueAsync(Request());

        Assert.Equal(AiCallOutcome.Refused, Assert.Single(_usageRepository.Records).Outcome);
    }

    // ---- Org scoping and authorization ----

    [Fact]
    public async Task Continue_IsNotFound_ForABoardInAnotherOrganization()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        // 404, not 403 — the response must not confirm the other organization's board exists.
        await Assert.ThrowsAsync<NotFoundAppException>(
            () => service.ContinueAsync(Request(boardId: _harborBoard.Id)));
    }

    [Fact]
    public async Task Continue_AssemblesRetrievalForTheCallersOrganizationOnly()
    {
        var foreignType = IdeaType.Create(_harbor.Id, "Harbor Only", 10, TestClock.Default);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id), extraIdeaTypes: foreignType);

        await service.ContinueAsync(Request());

        var context = _model.LastContext!;
        Assert.Equal(_acme.Id, context.OrganizationId);
        Assert.DoesNotContain(context.IdeaTypes, t => t.Id == foreignType.Id);
        Assert.Contains(context.IdeaTypes, t => t.Id == _processType.Id);
    }

    [Fact]
    public async Task Continue_IsRefused_ForReadOnlyUsers()
    {
        var service = CreateService(FakeCurrentUserContext.ReadOnly(_acme.Id));

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.ContinueAsync(Request()));
    }

    /// <summary>
    /// A Site Admin acting as themselves has no organization, and drafting is organization work — they
    /// reach it through View As like every other org-content path (view-as rule 25).
    /// </summary>
    [Fact]
    public async Task Continue_IsRefused_ForASiteAdminActingAsThemselves()
    {
        var service = CreateService(FakeCurrentUserContext.SiteAdmin());

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.ContinueAsync(Request()));
    }

    /// <summary>
    /// The View As case. A Site Admin acting as an Acme member drafts against Acme's catalog and the
    /// usage is billed to Acme, while the audit actor stays the real administrator.
    /// </summary>
    [Fact]
    public async Task Continue_AttributesToTheImpersonatedUsersOrganization_DuringViewAs()
    {
        var realAdmin = Guid.NewGuid();
        var impersonated = Guid.NewGuid();
        var context = FakeCurrentUserContext.User(_acme.Id, impersonated);
        context.ImpersonatingRealUserId = realAdmin;

        var service = CreateService(context);
        await service.ContinueAsync(Request());

        Assert.Equal(_acme.Id, _model.LastContext!.OrganizationId);

        var usage = Assert.Single(_usageRepository.Records);
        Assert.Equal(_acme.Id, usage.OrganizationId);
        Assert.Equal(realAdmin, usage.ActorUserId);
        Assert.Equal(impersonated, usage.OnBehalfOfUserId);

        var audit = Assert.Single(_audit.Events, e => e.EventType == "IdeaAssistTurn");
        Assert.Equal(realAdmin, audit.ActorUserId);
        Assert.Equal(impersonated, audit.OnBehalfOfUserId);
    }

    // ---- Transcript validation (rule 5, contract) ----

    [Fact]
    public async Task Continue_RejectsATranscriptThatDoesNotEndWithAUserTurn()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var transcript = new List<IdeaAssistTurn> { new(IdeaAssistTurn.AssistantRole, "Hello") };

        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.ContinueAsync(new IdeaAssistTurnRequest(_acmeBoard.Id, transcript)));
    }

    [Fact]
    public async Task Continue_RejectsAnEmptyTranscript()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.ContinueAsync(new IdeaAssistTurnRequest(_acmeBoard.Id, Array.Empty<IdeaAssistTurn>())));
    }

    /// <summary>
    /// Builds an alternating transcript of <paramref name="entries"/> entries, oldest-first, starting
    /// and — when the count is odd — ending with a user entry, which is the shape the contract requires.
    /// </summary>
    private static List<IdeaAssistTurn> Transcript(int entries) => Enumerable
        .Range(0, entries)
        .Select(i => new IdeaAssistTurn(
            i % 2 == 0 ? IdeaAssistTurn.UserRole : IdeaAssistTurn.AssistantRole,
            $"entry {i}"))
        .ToList();

    [Fact]
    public async Task Continue_RejectsATranscriptPastTheEntryCap()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var transcript = Transcript(IdeaAssistService.MaxTranscriptEntries + 1);

        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.ContinueAsync(new IdeaAssistTurnRequest(_acmeBoard.Id, transcript)));
    }

    /// <summary>
    /// The cap counts entries, not user turns. Eleven user entries is only eleven turns but twenty-one
    /// entries once the assistant replies are interleaved, so it must be refused — under the previous
    /// "20 user turns" reading this same transcript was accepted.
    /// </summary>
    [Fact]
    public async Task Continue_CountsAssistantEntriesTowardTheCap()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));
        var transcript = Transcript(21);

        Assert.Equal(11, transcript.Count(t => t.IsUser));
        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.ContinueAsync(new IdeaAssistTurnRequest(_acmeBoard.Id, transcript)));
    }

    [Fact]
    public async Task Continue_AcceptsATranscriptAtTheEntryCap()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        // 19 is the largest valid request: alternating and ending with a user entry means odd lengths.
        var result = await service.ContinueAsync(
            new IdeaAssistTurnRequest(_acmeBoard.Id, Transcript(19)));

        Assert.Equal(0, result.TurnsRemaining);
        Assert.True(result.ConversationClosed);
    }

    [Fact]
    public async Task Continue_ReportsTurnsRemaining()
    {
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        var result = await service.ContinueAsync(Request());

        // One user entry in, one assistant reply back: 2 of 20 entries used, so 9 user turns are left.
        Assert.Equal(9, result.TurnsRemaining);
    }

    // ---- Audit content (rule 27) ----

    /// <summary>
    /// The audit trail records outcomes, never content. A turn's prose must not be reconstructable from
    /// the log — same constraint the usage record carries.
    /// </summary>
    [Fact]
    public async Task Continue_WritesAnAuditEventCarryingNoTranscriptContent()
    {
        _model.Next = Response(nextQuestion: "A distinctive assistant question");
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await service.ContinueAsync(new IdeaAssistTurnRequest(
            _acmeBoard.Id,
            new List<IdeaAssistTurn> { new(IdeaAssistTurn.UserRole, "A distinctive user message") }));

        var audit = Assert.Single(_audit.Events, e => e.EventType == "IdeaAssistTurn");
        var serialized = $"{audit.Message} {audit.MetadataJson}";

        Assert.DoesNotContain("A distinctive user message", serialized, StringComparison.Ordinal);
        Assert.DoesNotContain("A distinctive assistant question", serialized, StringComparison.Ordinal);
        Assert.Contains("turnCount", serialized, StringComparison.Ordinal);
    }

    // ---- Scope statement settings (rules 6, 9) ----

    [Fact]
    public async Task GetSettings_ReportsAvailabilityAndStatement_WithoutAnyKeyMaterial()
    {
        _acme.SetAiScopeStatement("Only warehouse operations.", TestClock.Default, null);
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(_acme.Id));

        var settings = await service.GetSettingsAsync(_acme.Id);

        Assert.True(settings.AiAssistAvailable);
        Assert.Equal("Only warehouse operations.", settings.ScopeStatement);
    }

    [Fact]
    public async Task SetScopeStatement_PersistsAndAudits()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(_acme.Id));

        var settings = await service.SetScopeStatementAsync(_acme.Id, "  Only warehouse operations.  ");

        Assert.Equal("Only warehouse operations.", settings.ScopeStatement);
        Assert.Equal("Only warehouse operations.", _acme.AiScopeStatement);
        Assert.Equal(1, _unitOfWork.SaveChangesCount);
        Assert.Contains(_audit.Events, e => e.EventType == "AiScopeStatementUpdated");
    }

    [Fact]
    public async Task SetScopeStatement_ClearsOnEmpty()
    {
        _acme.SetAiScopeStatement("Something", TestClock.Default, null);
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(_acme.Id));

        var settings = await service.SetScopeStatementAsync(_acme.Id, "   ");

        Assert.Null(settings.ScopeStatement);
        Assert.Null(_acme.AiScopeStatement);
    }

    [Fact]
    public async Task SetScopeStatement_RejectsAnOverlongStatement()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(_acme.Id));

        await Assert.ThrowsAsync<ValidationAppException>(
            () => service.SetScopeStatementAsync(_acme.Id, new string('x', Organization.AiScopeStatementMaxLength + 1)));
    }

    [Fact]
    public async Task SetScopeStatement_IsNotFound_ForAnotherOrganization()
    {
        var service = CreateService(FakeCurrentUserContext.OrgAdmin(_acme.Id));

        await Assert.ThrowsAsync<NotFoundAppException>(
            () => service.SetScopeStatementAsync(_harbor.Id, "nope"));
    }

    [Theory]
    [InlineData("User")]
    [InlineData("ReadOnly")]
    public async Task Settings_AreRefused_ForNonAdmins(string role)
    {
        var context = role == "User"
            ? FakeCurrentUserContext.User(_acme.Id)
            : FakeCurrentUserContext.ReadOnly(_acme.Id);

        var service = CreateService(context);

        await Assert.ThrowsAsync<ForbiddenAppException>(() => service.GetSettingsAsync(_acme.Id));
    }

    /// <summary>The statement reaches the model as retrieval context, which is what makes it effective.</summary>
    [Fact]
    public async Task Continue_PassesTheScopeStatementToTheModel()
    {
        _acme.SetAiScopeStatement("Only warehouse operations.", TestClock.Default, null);
        var service = CreateService(FakeCurrentUserContext.User(_acme.Id));

        await service.ContinueAsync(Request());

        Assert.Equal("Only warehouse operations.", _model.LastContext!.ScopeStatement);
    }

    /// <summary>
    /// Seeds an earlier turn as the server recorded it. Timestamps step backwards so ordering is
    /// deterministic: the caller adds oldest-first, and the newest seeded row stays older than the
    /// turn under test.
    /// </summary>
    private void GivenPriorOutcome(Guid actorUserId, AiCallOutcome outcome, Guid? boardId = null)
    {
        _priorTurnOffset++;

        _usageRepository.Records.Add(AiUsageRecord.Create(
            _acme.Id,
            "claude-sonnet-5",
            _clock.UtcNow.AddSeconds(-_priorTurnOffset),
            inputTokens: 10,
            outputTokens: 5,
            inputRatePerMillion: 3.00m,
            outputRatePerMillion: 15.00m,
            outcome,
            actorUserId,
            onBehalfOfUserId: null,
            boardId: boardId ?? _acmeBoard.Id));
    }

    private int _priorTurnOffset;

    private IdeaAssistTurnRequest Request(Guid? boardId = null, IdeaDraft? draft = null) =>
        new(
            boardId ?? _acmeBoard.Id,
            new List<IdeaAssistTurn> { new(IdeaAssistTurn.UserRole, "We keep re-keying orders by hand.") },
            draft);

    private static IdeaDraftModelResponse Response(
        bool inScope = true,
        string nextQuestion = "What problem does this solve?",
        IdeaDraft? draft = null) =>
        new(inScope, nextQuestion, draft ?? IdeaDraft.Empty, InputTokens: 900, OutputTokens: 120);

    private void GivenTokensSpentToday(int tokens) =>
        _usageRepository.Records.Add(AiUsageRecord.Create(
            _acme.Id,
            "claude-sonnet-5",
            _clock.UtcNow,
            tokens,
            0,
            inputRatePerMillion: 3.00m,
            outputRatePerMillion: 15.00m,
            AiCallOutcome.Succeeded));

    private IdeaAssistService CreateService(
        FakeCurrentUserContext currentUser,
        long dailyTokenLimit = 500_000,
        AiUsageLimits? limits = null,
        params IdeaType[] extraIdeaTypes)
    {
        // Rate limits default off in these tests so the drafting behaviour under test isn't shadowed
        // by a limit; the limit itself has its own coverage in AiUsageServiceTests.
        limits ??= new AiUsageLimits { DailyTokenLimit = dailyTokenLimit, PerUserCallsPerWindow = 0, PerOrganizationCallsPerWindow = 0 };
        var usage = new AiUsageService(_usageRepository, currentUser, _unitOfWork, _clock, limits);

        var builder = new IdeaAssistContextBuilder(
            new FakeOrganizationRepository(_acme, _harbor),
            new FakeIdeaTypeRepository(new[] { _processType }.Concat(extraIdeaTypes).ToArray()),
            new FakeBusinessImpactRepository(_highImpact),
            new FakeFieldDefinitionRepository(),
            _statuses,
            new FakeTagRepository(),
            new FakeUserRepository());

        return new IdeaAssistService(
            _model,
            builder,
            new FakeBoardRepository(_acmeBoard, _harborBoard),
            new FakeOrganizationRepository(_acme, _harbor),
            usage,
            currentUser,
            _audit,
            _unitOfWork,
            _clock);
    }
}
