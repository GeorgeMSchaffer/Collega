using Collega.Application.Auth;
using System.Globalization;
using System.Security.Claims;
using Collega.Application.Exceptions;

namespace Collega.API.Authentication;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(value, out var userId))
        {
            return userId;
        }

        // [Authorize] should already have rejected the request before an action body runs this,
        // so this is a defensive fallback rather than the primary 401 path.
        throw new UnauthorizedAppException("Caller identity could not be resolved.");
    }

    /// <summary>
    /// The real administrator behind an active View As session, or null when not impersonating.
    /// Reads the claims emitted by <see cref="BearerTokenAuthenticationHandler"/>; the identity
    /// claims themselves already describe the impersonated user.
    /// </summary>
    public static ViewingAsSummary? GetViewingAs(this ClaimsPrincipal principal)
    {
        var realUserId = principal.FindFirstValue(CollegaClaimTypes.RealUserId);
        if (!Guid.TryParse(realUserId, out var realId))
        {
            return null;
        }

        // Absence of the timestamps would mean a malformed principal rather than "no session", so
        // fall back to default rather than dropping the banner and silently hiding impersonation.
        _ = DateTime.TryParse(
            principal.FindFirstValue(CollegaClaimTypes.ImpersonationStartedAt),
            CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var startedAt);
        _ = DateTime.TryParse(
            principal.FindFirstValue(CollegaClaimTypes.ImpersonationExpiresAt),
            CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var expiresAt);

        return new ViewingAsSummary(
            realId,
            principal.FindFirstValue(CollegaClaimTypes.RealUserName) ?? string.Empty,
            startedAt,
            expiresAt);
    }
}
