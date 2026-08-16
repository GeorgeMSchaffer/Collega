using Collega.Domain.Common;

namespace Collega.Domain.Ai;

/// <summary>
/// One model call's token consumption, attributed to the organization whose work it was
/// (SPEC/20-feature-ai-idea-assist.md rule 28c).
/// </summary>
/// <remarks>
/// <para>This is a <b>meter</b>, deliberately separate from the <c>AuditEvent</c> rule 27 also
/// writes for every call. The audit event is the accountability trail — prose plus metadata,
/// written once and read rarely. This table is aggregated on the hot path: the daily budget gate
/// sums the current UTC day before <i>every</i> call, and the usage surface groups by organization.
/// Neither should be parsing JSON out of audit rows. Both records are written; neither is derived
/// from the other.</para>
///
/// <para>Carries no prompt and no transcript text (rule 28e), the same constraint rule 27 places on
/// the audit log.</para>
/// </remarks>
public sealed class AiUsageRecord : EntityBase
{
    /// <summary>
    /// The organization the spend belongs to. <b>Required</b> — unlike <c>AuditEvent.OrganizationId</c>,
    /// which is nullable because platform-level actions have no org. Every model call is made on
    /// behalf of exactly one organization, and an unattributed row would be spend nobody can be
    /// billed for.
    /// </summary>
    public Guid OrganizationId { get; private set; }

    /// <summary>
    /// Who really made the call. While a View As session is live this stays the <b>real
    /// administrator</b>, mirroring <c>AuditEvent.ActorUserId</c>.
    /// </summary>
    public Guid? ActorUserId { get; private set; }

    /// <summary>The impersonated user when the call went through View As; null otherwise.</summary>
    public Guid? OnBehalfOfUserId { get; private set; }

    public Guid? BoardId { get; private set; }

    public DateTime OccurredAtUtc { get; private set; }

    /// <summary>
    /// The model id actually used. Stored rather than assumed so a later model change — the id is
    /// configuration — cannot retroactively mislabel historical consumption.
    /// </summary>
    public string Model { get; private set; } = string.Empty;

    public int InputTokens { get; private set; }
    public int OutputTokens { get; private set; }
    public int CacheReadInputTokens { get; private set; }
    public int CacheCreationInputTokens { get; private set; }

    /// <summary>
    /// The per-million rates in effect when the call was made. Stored on the row rather than looked
    /// up at read time because this data supports cost pass-through: re-pricing history when
    /// configuration changes would silently restate what an organization owes.
    /// </summary>
    public decimal InputRatePerMillion { get; private set; }

    public decimal OutputRatePerMillion { get; private set; }

    /// <summary>
    /// Which credential paid for the call. Always <see cref="AiKeySource.Platform"/> in v1 — per-org
    /// keys are deferred (rule 30). The column exists now so that when they land, each org's own key
    /// can be metered separately with no backfill.
    /// </summary>
    public AiKeySource KeySource { get; private set; }

    /// <summary>
    /// How the call ended. Refused and failed turns are recorded too: they consumed tokens, and a
    /// meter that counted only successes would not bound spend.
    /// </summary>
    public AiCallOutcome Outcome { get; private set; }

    /// <summary>Total tokens billed for this call — what the daily budget in rule 28a is measured in.</summary>
    public int TotalTokens => InputTokens + OutputTokens + CacheReadInputTokens + CacheCreationInputTokens;

    private AiUsageRecord()
    {
    }

    public static AiUsageRecord Create(
        Guid organizationId,
        string model,
        DateTime occurredAtUtc,
        int inputTokens,
        int outputTokens,
        decimal inputRatePerMillion,
        decimal outputRatePerMillion,
        AiCallOutcome outcome,
        Guid? actorUserId = null,
        Guid? onBehalfOfUserId = null,
        Guid? boardId = null,
        int cacheReadInputTokens = 0,
        int cacheCreationInputTokens = 0,
        AiKeySource keySource = AiKeySource.Platform)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Usage must be attributed to an organization.", nameof(organizationId));
        }

        if (string.IsNullOrWhiteSpace(model))
        {
            throw new ArgumentException("Model is required.", nameof(model));
        }

        // A provider that reports a negative count is broken; letting it through would corrupt the
        // budget total in the direction of under-counting, which is the dangerous direction.
        ThrowIfNegative(inputTokens, nameof(inputTokens));
        ThrowIfNegative(outputTokens, nameof(outputTokens));
        ThrowIfNegative(cacheReadInputTokens, nameof(cacheReadInputTokens));
        ThrowIfNegative(cacheCreationInputTokens, nameof(cacheCreationInputTokens));

        return new AiUsageRecord
        {
            OrganizationId = organizationId,
            ActorUserId = actorUserId,
            OnBehalfOfUserId = onBehalfOfUserId,
            BoardId = boardId,
            OccurredAtUtc = occurredAtUtc,
            Model = model.Trim(),
            InputTokens = inputTokens,
            OutputTokens = outputTokens,
            CacheReadInputTokens = cacheReadInputTokens,
            CacheCreationInputTokens = cacheCreationInputTokens,
            InputRatePerMillion = inputRatePerMillion,
            OutputRatePerMillion = outputRatePerMillion,
            KeySource = keySource,
            Outcome = outcome,
        };
    }

    /// <summary>
    /// Cost in USD from the rates stored on this row. Cache reads and cache writes are priced off
    /// the input rate at the provider's published multipliers — 0.1x for a read, 1.25x for a write.
    /// </summary>
    public decimal EstimatedCost()
    {
        const decimal perMillion = 1_000_000m;
        var input = InputTokens * InputRatePerMillion / perMillion;
        var cacheRead = CacheReadInputTokens * InputRatePerMillion * 0.1m / perMillion;
        var cacheWrite = CacheCreationInputTokens * InputRatePerMillion * 1.25m / perMillion;
        var output = OutputTokens * OutputRatePerMillion / perMillion;
        return input + cacheRead + cacheWrite + output;
    }

    private static void ThrowIfNegative(int value, string paramName)
    {
        if (value < 0)
        {
            throw new ArgumentOutOfRangeException(paramName, value, "Token counts cannot be negative.");
        }
    }
}
