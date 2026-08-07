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
}
