namespace Collega.Application.Abstractions;

/// <summary>
/// Resolves the pair of ids an <c>AuditEvent</c> should carry, so that rule 14 of
/// SPEC/20-feature-view-as.md holds at every audit site rather than only inside
/// <c>ViewAsService</c>.
/// </summary>
public static class AuditAttributionExtensions
{
    /// <summary>
    /// Maps the actor a service intends to record onto the (actor, on-behalf-of) pair that should be
    /// persisted.
    /// </summary>
    /// <remarks>
    /// <para>While a View As session is live, <see cref="ICurrentUserContext.UserId"/> is the
    /// <b>impersonated</b> user — that is what makes authorization apply to them (rule 4). Recording
    /// that id as the audit actor would therefore say the target performed the action themselves,
    /// which is precisely the accountability failure rule 14 exists to prevent. When impersonating,
    /// the real administrator becomes the actor and the target moves to
    /// <c>OnBehalfOfUserId</c>.</para>
    ///
    /// <para>The rewrite is deliberately conditional on <paramref name="actorUserId"/> matching the
    /// acting identity. Some audit events name someone other than the caller, or no one at all —
    /// <c>AuthService</c>'s login-failure events record the account being attempted and run before
    /// any authenticated context exists. Those must pass through untouched, so this only rewrites
    /// the case it is actually about: a service recording "the current caller did this".</para>
    /// </remarks>
    public static (Guid? ActorUserId, Guid? OnBehalfOfUserId) AttributeAudit(
        this ICurrentUserContext currentUser, Guid? actorUserId)
    {
        if (currentUser.IsImpersonating && actorUserId is not null && actorUserId == currentUser.UserId)
        {
            return (currentUser.RealUserId, currentUser.UserId);
        }

        return (actorUserId, null);
    }
}
