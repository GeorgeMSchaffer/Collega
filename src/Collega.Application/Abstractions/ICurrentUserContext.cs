using Collega.Domain.Enums;

namespace Collega.Application.Abstractions;

/// <summary>
/// The identity the current request acts under. This is the <b>single chokepoint</b> for "who is
/// calling" — nothing outside the authentication layer reads claims directly, which is what lets
/// View As work without touching any authorization code (SPEC/20-feature-view-as.md rules 4/4a).
/// Reading claims elsewhere would silently opt that code out of impersonation; treat it as a defect.
/// </summary>
public interface ICurrentUserContext
{
    bool IsAuthenticated { get; }

    /// <summary>
    /// The acting user. While a View As session is live this is the <b>impersonated</b> user — so
    /// authorization, org scoping and entity authorship all apply to them (rule 15).
    /// </summary>
    Guid? UserId { get; }

    Guid? OrganizationId { get; }
    Role? Role { get; }

    /// <summary>
    /// True while acting as someone else. Use <see cref="RealUserId"/> for the actual actor.
    /// </summary>
    bool IsImpersonating { get; }

    /// <summary>
    /// The real administrator behind the request. Equals <see cref="UserId"/> when not
    /// impersonating. Audit records this as the actor so a trail can never read as self-authored
    /// (rule 14).
    /// </summary>
    Guid? RealUserId { get; }
}
