using Collega.Domain.Common;

namespace Collega.Domain.Impersonation;

/// <summary>
/// A live "View As" session: a real administrator temporarily acting as another user
/// (SPEC/20-feature-view-as.md). Deliberately a persisted server-side row rather than a claim in
/// the access token — the token keeps identifying only the real user and is never reissued to start
/// or end a session, so a captured token carries no impersonation authority. It is also what makes
/// idle expiry, central revocation and non-nestability enforceable at all.
/// </summary>
/// <remarks>
/// Ending is a soft close (<see cref="EndedAtUtc"/>) rather than a delete: the row is the audit
/// record of who acted as whom and for how long, and deleting it would destroy exactly the
/// accountability the feature exists to provide.
/// </remarks>
public sealed class ImpersonationSession : EntityBase
{
    /// <summary>Idle window (rule 17). No authenticated request for this long ends the session.</summary>
    public static readonly TimeSpan IdleTimeout = TimeSpan.FromMinutes(30);

    /// <summary>Hard cap from start (rule 17), regardless of activity.</summary>
    public static readonly TimeSpan AbsoluteLifetime = TimeSpan.FromHours(2);

    /// <summary>The administrator who started this — the identity the access token actually names.</summary>
    public Guid RealUserId { get; private set; }

    /// <summary>The user being acted as. Their identity is what authorization sees (rule 4).</summary>
    public Guid TargetUserId { get; private set; }

    public DateTime StartedAtUtc { get; private set; }

    /// <summary>Advanced on each authenticated request; the basis for idle expiry.</summary>
    public DateTime LastSeenAtUtc { get; private set; }

    /// <summary>Fixed at start. Never extended by activity — that is the point of the hard cap.</summary>
    public DateTime AbsoluteExpiresAtUtc { get; private set; }

    /// <summary>Set when the session ends, by exit or by expiry being observed. Null while live.</summary>
    public DateTime? EndedAtUtc { get; private set; }

    /// <summary>Why it ended, for the audit trail. Null while live.</summary>
    public ImpersonationEndReason? EndReason { get; private set; }

    private ImpersonationSession()
    {
    }

    public static ImpersonationSession Start(Guid realUserId, Guid targetUserId, DateTime nowUtc)
    {
        if (realUserId == Guid.Empty)
        {
            throw new ArgumentException("Real user id is required.", nameof(realUserId));
        }

        if (targetUserId == Guid.Empty)
        {
            throw new ArgumentException("Target user id is required.", nameof(targetUserId));
        }

        // Defence in depth. Authorization refuses this earlier with a 403; the invariant is restated
        // here so the entity cannot represent a nonsensical state regardless of how it is reached.
        if (realUserId == targetUserId)
        {
            throw new InvalidOperationException("A user cannot act as themselves.");
        }

        return new ImpersonationSession
        {
            RealUserId = realUserId,
            TargetUserId = targetUserId,
            StartedAtUtc = nowUtc,
            LastSeenAtUtc = nowUtc,
            AbsoluteExpiresAtUtc = nowUtc.Add(AbsoluteLifetime)
        };
    }

    /// <summary>
    /// True when the session has neither been ended nor run past either expiry bound. Evaluated
    /// server-side on every request (rule 18) — a client timer may warn, but never decides.
    /// </summary>
    public bool IsActiveAt(DateTime nowUtc) =>
        EndedAtUtc is null
        && nowUtc < AbsoluteExpiresAtUtc
        && nowUtc - LastSeenAtUtc < IdleTimeout;

    /// <summary>Records activity, refreshing the idle window. Ignored once the session is over.</summary>
    public void Touch(DateTime nowUtc)
    {
        if (EndedAtUtc is not null)
        {
            return;
        }

        LastSeenAtUtc = nowUtc;
    }

    /// <summary>
    /// Closes the session. Idempotent — the first reason wins, so an expiry observed after an
    /// explicit exit cannot rewrite why it ended.
    /// </summary>
    public void End(DateTime nowUtc, ImpersonationEndReason reason)
    {
        if (EndedAtUtc is not null)
        {
            return;
        }

        EndedAtUtc = nowUtc;
        EndReason = reason;
    }
}

public enum ImpersonationEndReason
{
    /// <summary>The administrator clicked Exit.</summary>
    ExitedByUser,

    /// <summary>No activity for <see cref="ImpersonationSession.IdleTimeout"/>.</summary>
    IdleTimeout,

    /// <summary>Ran past <see cref="ImpersonationSession.AbsoluteLifetime"/> from start.</summary>
    AbsoluteTimeout,

    /// <summary>The target stopped being a valid subject — deactivated, or their org archived (rule 12).</summary>
    TargetNoLongerValid
}
