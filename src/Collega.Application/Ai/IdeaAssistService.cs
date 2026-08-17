using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Application.Users;
using Collega.Domain.Ai;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;

namespace Collega.Application.Ai;

/// <summary>
/// The idea-drafting use case (SPEC/20-feature-ai-idea-assist.md; contract
/// <c>POST /boards/{boardId}/idea-assist/turns</c>). Owns everything the model is not trusted with:
/// authorization, retrieval scoping, the scope gate, re-validation of returned ids, the turn caps,
/// and metering.
/// </summary>
/// <remarks>
/// <para><b>Never a write path</b> (rule 23). Its output seeds a form; the user submits it; the
/// existing <c>IdeaService</c> validation is the sole authority on whether an idea is created. No
/// method here creates, updates, or deletes anything except a usage record and an audit event.</para>
///
/// <para>Degradation is the default, not the exception. A provider failure, an unconfigured key, or an
/// exhausted budget all raise <see cref="AiAssistUnavailableException"/>, which the API maps to 503 —
/// the three causes are deliberately indistinguishable to the client, which falls back to the
/// scripted brainstorm either way (rules 31–32).</para>
/// </remarks>
public sealed class IdeaAssistService : IIdeaAssistService
{
    /// <summary>
    /// Rule 5. A conversation this long has stopped being idea drafting. The cap counts transcript
    /// <em>entries</em> — user and assistant combined — not user turns. Since a transcript alternates
    /// and must end with a user entry, the largest valid request carries 19, so this is 10 user turns.
    /// </summary>
    public const int MaxTranscriptEntries = 20;

    /// <summary>Rule 10. Bounds the cost of someone probing the boundary.</summary>
    public const int OutOfScopeStrikeLimit = 3;

    /// <summary>
    /// The fixed redirect shown for a refused turn. Server-supplied and constant so the model can
    /// never author the refusal text — a model-written refusal is a free-text channel by another name.
    /// </summary>
    public const string OutOfScopeRedirect =
        "I can only help with drafting ideas for your organization. What would you like to capture?";

    public const string ConversationClosedRedirect =
        "Let's pick this up on the idea form instead — I've kept whatever we captured so far.";

    private readonly IIdeaDraftModel _model;
    private readonly IdeaAssistContextBuilder _contextBuilder;
    private readonly IBoardRepository _boards;
    private readonly IOrganizationRepository _organizations;
    private readonly IAiUsageService _usage;
    private readonly ICurrentUserContext _currentUser;
    private readonly IAuditEventWriter _auditWriter;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IClock _clock;

    public IdeaAssistService(
        IIdeaDraftModel model,
        IdeaAssistContextBuilder contextBuilder,
        IBoardRepository boards,
        IOrganizationRepository organizations,
        IAiUsageService usage,
        ICurrentUserContext currentUser,
        IAuditEventWriter auditWriter,
        IUnitOfWork unitOfWork,
        IClock clock)
    {
        _model = model;
        _contextBuilder = contextBuilder;
        _boards = boards;
        _organizations = organizations;
        _usage = usage;
        _currentUser = currentUser;
        _auditWriter = auditWriter;
        _unitOfWork = unitOfWork;
        _clock = clock;
    }

    public async Task<IdeaAssistTurnResult> ContinueAsync(
        IdeaAssistTurnRequest request,
        CancellationToken cancellationToken = default)
    {
        var organizationId = RequireDraftingMember();
        ValidateTranscript(request.Transcript);

        var board = await _boards.GetByIdAsync(request.BoardId, cancellationToken);

        // 404, not 403, for a board outside the caller's organization: a wrong-org request must not
        // confirm the board exists. Same shape as every other org-scoped read in the codebase.
        if (board is null || board.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Board not found.");
        }

        // Two states the client cannot distinguish, and must not: no key configured, and the
        // deployment's daily token budget exhausted (rules 28a, 31).
        if (!_model.IsConfigured || !await _usage.IsWithinDailyBudgetAsync(cancellationToken))
        {
            throw new AiAssistUnavailableException();
        }

        // Rate limits are 429, deliberately *not* folded into the 503 above: unavailable means "stop
        // asking, work without it", rate-limited means "you asked too fast, try again shortly". A
        // client that cannot tell those apart either gives up too early or retries a dead endpoint.
        await _usage.EnforceRateLimitAsync(organizationId, cancellationToken);

        var userTurnCount = request.Transcript.Count(t => t.IsUser);
        var currentDraft = request.Draft ?? IdeaDraft.Empty;

        var context = await _contextBuilder.BuildAsync(organizationId, cancellationToken);

        IdeaDraftModelResponse response;
        try
        {
            response = await _model.ContinueAsync(context, request.Transcript, currentDraft, cancellationToken);
        }
        catch (IdeaDraftModelException)
        {
            // The turn consumed tokens even though it failed, so it is still metered (rule 28c) —
            // a meter that counted only successes would not bound spend.
            await RecordAsync(organizationId, request.BoardId, AiCallOutcome.Failed, null, cancellationToken);
            await AuditAsync(organizationId, request.BoardId, userTurnCount, outOfScope: false, failed: true, cancellationToken);
            throw new AiAssistUnavailableException();
        }

        var outcome = response.InScope ? AiCallOutcome.Succeeded : AiCallOutcome.Refused;
        await RecordAsync(organizationId, request.BoardId, outcome, response, cancellationToken);
        await AuditAsync(organizationId, request.BoardId, userTurnCount, !response.InScope, failed: false, cancellationToken);

        if (!response.InScope)
        {
            // The draft is returned unchanged and the client drops the offending turn rather than
            // appending it: accumulated off-topic context is what drifts a constrained assistant
            // into a general one (rule 8).
            var closed = await IsThirdConsecutiveRefusalAsync(organizationId, request.BoardId, cancellationToken);

            return new IdeaAssistTurnResult(
                InScope: false,
                ConversationClosed: closed,
                NextQuestion: closed ? ConversationClosedRedirect : OutOfScopeRedirect,
                Draft: currentDraft,
                // The client drops the offending user turn and renders the redirect as a system note
                // rather than an assistant bubble (rule 8/8a), so the transcript shrinks by one and a
                // refused turn costs no conversation budget.
                TurnsRemaining: RemainingUserTurns(request.Transcript.Count - 1));
        }

        // Every id the model returned is re-checked against what was actually retrieved. The schema
        // already makes an out-of-org id structurally impossible; this is the belt to that braces,
        // and it is what the contract promises (line 1274).
        var draft = Sanitize(response.Draft, context, currentDraft);
        // The client appends this reply, so the transcript it will hold is one longer than the request.
        var turnsRemaining = RemainingUserTurns(request.Transcript.Count + 1);

        return new IdeaAssistTurnResult(
            InScope: true,
            ConversationClosed: turnsRemaining == 0,
            NextQuestion: response.NextQuestion,
            Draft: draft,
            TurnsRemaining: turnsRemaining);
    }

    public async Task<AiAssistSettings> GetSettingsAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default)
    {
        var organization = await RequireAdministrableOrganizationAsync(organizationId, cancellationToken);

        // Reports *whether* a key is configured, never the key or any part of it (rule 28).
        return new AiAssistSettings(_model.IsConfigured, organization.AiScopeStatement);
    }

    public async Task<AiAssistSettings> SetScopeStatementAsync(
        Guid organizationId,
        string? scopeStatement,
        CancellationToken cancellationToken = default)
    {
        var organization = await RequireAdministrableOrganizationAsync(organizationId, cancellationToken);

        if (scopeStatement is { Length: > Domain.Organizations.Organization.AiScopeStatementMaxLength })
        {
            throw new ValidationAppException(
                "scopeStatement",
                new[] { $"Scope statement cannot exceed {Domain.Organizations.Organization.AiScopeStatementMaxLength} characters." });
        }

        organization.SetAiScopeStatement(scopeStatement, _clock.UtcNow, _currentUser.UserId);

        var attribution = _currentUser.AttributeAudit(_currentUser.UserId);
        await _auditWriter.WriteAsync(
            AuditEvent.Create(
                "AiScopeStatementUpdated",
                "Organization",
                "The AI assist scope statement was updated.",
                _clock.UtcNow,
                organizationId,
                attribution.ActorUserId,
                organizationId,
                // The new value is org configuration written by a trusted operator, not user content —
                // recording it is the point of the audit entry (contract: "the acting user and the new value").
                JsonSerializer.Serialize(new { scopeStatement = organization.AiScopeStatement }),
                attribution.OnBehalfOfUserId),
            cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return new AiAssistSettings(_model.IsConfigured, organization.AiScopeStatement);
    }

    /// <summary>
    /// Drops anything the model returned that is not a real, active option in the retrieved set, and
    /// clamps free text to the domain maxima. A rejected id falls back to whatever the draft already
    /// held rather than to null — a bad suggestion must not erase a good earlier one.
    /// </summary>
    private static IdeaDraft Sanitize(IdeaDraft proposed, IdeaAssistContext context, IdeaDraft current)
    {
        var ideaTypeId = proposed.IdeaTypeId is { } typeId && context.IdeaTypeIds.Contains(typeId)
            ? typeId
            : current.IdeaTypeId;

        var businessImpactId = proposed.BusinessImpactId is { } impactId && context.BusinessImpactIds.Contains(impactId)
            ? impactId
            : current.BusinessImpactId;

        return new IdeaDraft(
            Truncate(proposed.Title, Domain.Ideas.Idea.TitleMaxLength) ?? current.Title,
            Truncate(proposed.Description, Domain.Ideas.Idea.DescriptionMaxLength) ?? current.Description,
            ideaTypeId,
            businessImpactId,
            proposed.Priority is { } priority && Enum.IsDefined(priority) ? priority : current.Priority);
    }

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var trimmed = value.Trim();

        if (trimmed.Length <= maxLength)
        {
            return trimmed;
        }

        // Back off one if the cut would land between a surrogate pair. The schema caps length in code
        // points and C# counts UTF-16 units, so the two disagree exactly where emoji appear — and a
        // lone surrogate is an invalid string that would fail validation on the create form the user
        // is about to submit.
        var end = maxLength;
        if (char.IsHighSurrogate(trimmed[end - 1]))
        {
            end--;
        }

        return trimmed[..end];
    }

    /// <summary>
    /// Whether the refusal just recorded is the third consecutive one, closing the chat (rule 10).
    /// </summary>
    /// <remarks>
    /// <para><b>Read from the usage records, never from the transcript.</b> The client owns the
    /// transcript, and it drops refused turns by design — so a strike count derived from it is both
    /// absent in the normal case and trivially erasable by a caller probing the boundary. These rows
    /// are written by the server on every turn and the caller cannot touch them.</para>
    ///
    /// <para>Called after the current turn has been recorded, so the newest row <i>is</i> this
    /// refusal: three consecutive refused outcomes on this board, by this actor, means close.</para>
    /// </remarks>
    private async Task<bool> IsThirdConsecutiveRefusalAsync(
        Guid organizationId,
        Guid boardId,
        CancellationToken cancellationToken)
    {
        var outcomes = await _usage.GetRecentOutcomesAsync(
            organizationId,
            boardId,
            OutOfScopeStrikeLimit,
            _clock.UtcNow - ConversationLookback,
            cancellationToken);

        return outcomes.Count >= OutOfScopeStrikeLimit
            && outcomes.Take(OutOfScopeStrikeLimit).All(o => o == AiCallOutcome.Refused);
    }

    /// <summary>
    /// How far back a strike still counts. A conversation is capped at 20 entries and runs in minutes,
    /// so an hour is generous — but bounded, so yesterday's refusals don't close today's chat before
    /// it starts.
    /// </summary>
    private static readonly TimeSpan ConversationLookback = TimeSpan.FromHours(1);

    private void ValidateTranscript(IReadOnlyList<IdeaAssistTurn> transcript)
    {
        if (transcript is null || transcript.Count == 0)
        {
            throw new ValidationAppException("transcript", new[] { "At least one message is required." });
        }

        if (transcript.Count > MaxTranscriptEntries)
        {
            throw new ValidationAppException("transcript", new[] { $"A conversation is capped at {MaxTranscriptEntries} transcript entries." });
        }

        if (!transcript[^1].IsUser)
        {
            throw new ValidationAppException("transcript", new[] { "The last message must be from the user." });
        }
    }

    /// <summary>
    /// How many further user turns fit under rule 5, given the transcript length the client will hold
    /// once this turn is applied. Each further turn costs a user entry plus the assistant reply that
    /// comes back with it, and the request carrying turn <c>k</c> is <c>length + 2k - 1</c> entries
    /// long — so the largest <c>k</c> with <c>length + 2k - 1 &lt;= 20</c> is <c>(21 - length) / 2</c>.
    /// </summary>
    private static int RemainingUserTurns(int transcriptLength) =>
        Math.Max(0, (MaxTranscriptEntries + 1 - transcriptLength) / 2);

    /// <summary>
    /// Anyone who may create ideas in their organization may draft. Read Only is refused (rule: the
    /// contract's "authorized for any member of the board's organization who may create ideas").
    /// </summary>
    private Guid RequireDraftingMember()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        if (_currentUser.Role == Role.ReadOnly)
        {
            throw new ForbiddenAppException("Read Only users cannot draft ideas.");
        }

        // A Site Admin acting as themselves has no organization, and drafting is organization work —
        // they reach it through View As, exactly like every other org-content path (view-as rule 25).
        if (_currentUser.OrganizationId is not { } organizationId)
        {
            throw new ForbiddenAppException("Drafting is organization work — act as a member of the organization.");
        }

        return organizationId;
    }

    private async Task<Domain.Organizations.Organization> RequireAdministrableOrganizationAsync(
        Guid organizationId,
        CancellationToken cancellationToken)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        var role = _currentUser.Role.Value;

        if (role != Role.SiteAdmin && role != Role.OrgAdmin)
        {
            throw new ForbiddenAppException("You are not allowed to administer this organization.");
        }

        if (role == Role.OrgAdmin && _currentUser.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Organization not found.");
        }

        var organization = await _organizations.GetByIdAsync(organizationId, cancellationToken);

        return organization ?? throw new NotFoundAppException("Organization not found.");
    }

    private Task RecordAsync(
        Guid organizationId,
        Guid boardId,
        AiCallOutcome outcome,
        IdeaDraftModelResponse? response,
        CancellationToken cancellationToken) =>
        _usage.RecordAsync(
            organizationId,
            outcome,
            response?.InputTokens ?? 0,
            response?.OutputTokens ?? 0,
            response?.CacheReadInputTokens ?? 0,
            response?.CacheCreationInputTokens ?? 0,
            boardId,
            cancellationToken);

    /// <summary>
    /// Rule 27's audit entry: who, where, how far in, and how it ended — and <b>never</b> the prompt
    /// or the transcript. The usage record next to it carries the token counts; this one is the
    /// accountability trail, and neither is derived from the other.
    /// </summary>
    private async Task AuditAsync(
        Guid organizationId,
        Guid boardId,
        int turnCount,
        bool outOfScope,
        bool failed,
        CancellationToken cancellationToken)
    {
        var attribution = _currentUser.AttributeAudit(_currentUser.UserId);
        var metadata = JsonSerializer.Serialize(new
        {
            boardId,
            turnCount,
            outOfScope,
            failed,
        });

        await _auditWriter.WriteAsync(
            AuditEvent.Create(
                "IdeaAssistTurn",
                "Board",
                "An AI idea-assist turn was requested.",
                _clock.UtcNow,
                organizationId,
                attribution.ActorUserId,
                boardId,
                metadata,
                attribution.OnBehalfOfUserId),
            cancellationToken);
    }
}

/// <summary>
/// The assistant cannot serve this turn — unconfigured, unavailable, or out of daily budget. Maps to
/// <c>503</c>, which the client treats as "keep working without it" rather than as an error.
/// </summary>
public sealed class AiAssistUnavailableException : AppException
{
    public AiAssistUnavailableException()
        : base("AI assist is unavailable.")
    {
    }
}

/// <summary>An organization's AI assist configuration (contract <c>GET .../ai-assist/settings</c>).</summary>
public sealed record AiAssistSettings(bool AiAssistAvailable, string? ScopeStatement);
