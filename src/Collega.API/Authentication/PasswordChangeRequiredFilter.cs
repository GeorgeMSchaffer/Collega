using Collega.Application.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Collega.API.Authentication;

/// <summary>
/// Marks an action reachable while the caller still owes a mandatory password rotation. Anything
/// unmarked is refused by <see cref="PasswordChangeRequiredFilter"/>.
/// </summary>
/// <remarks>
/// Deliberately opt-in: a new endpoint is closed by default and only joins the allowlist when
/// someone writes this attribute on it. An opt-out design would silently expose every endpoint
/// added after this filter was written.
/// </remarks>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, Inherited = true, AllowMultiple = false)]
public sealed class AllowWhilePasswordChangeRequiredAttribute : Attribute
{
}

/// <summary>
/// Enforces the mandatory first-login password change at the request boundary (auth requirement
/// #31). Before this filter existed the rule was carried only by the Blazor client's
/// <c>mustChangePassword</c> claim, while the bearer token itself stayed fully valid — so a user
/// holding an admin-issued temporary password could skip the rotation entirely by calling the API
/// directly and keep operating on a credential the issuing admin still knows.
/// </summary>
/// <remarks>
/// Runs as a global authorization filter, after authentication has populated the principal.
/// Anonymous endpoints are unaffected: with no authenticated identity there is no rotation to owe,
/// so login and register keep working. The flag is read from the claim minted per request by
/// <see cref="BearerTokenAuthenticationHandler"/> out of live persisted state, so completing the
/// rotation lifts the restriction on the very next request without reissuing a token.
/// </remarks>
public sealed class PasswordChangeRequiredFilter : IAuthorizationFilter
{
    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return;
        }

        if (!user.HasClaim(CollegaClaimTypes.MustChangePassword, "true"))
        {
            return;
        }

        var metadata = context.ActionDescriptor.EndpointMetadata;

        // Only gate endpoints that actually require authorization. This codebase marks protected
        // actions with [Authorize] individually rather than authorizing at the controller level and
        // opting out with [AllowAnonymous], so "is it anonymous?" cannot be answered by looking for
        // IAllowAnonymous — POST /auth/login carries neither attribute. Testing for the absence of
        // IAuthorizeData covers both shapes: an endpoint that never needed a caller identity is not
        // one where the caller's rotation state can be relevant. A client that attaches its bearer
        // header to every request must still be able to re-submit a login.
        var requiresAuthorization = metadata.OfType<IAuthorizeData>().Any()
            && !metadata.OfType<IAllowAnonymous>().Any();

        if (!requiresAuthorization)
        {
            return;
        }

        if (metadata.OfType<AllowWhilePasswordChangeRequiredAttribute>().Any())
        {
            return;
        }

        // Thrown rather than short-circuited with a result so the response goes through
        // AppExceptionHandler and carries the same problem-details envelope as every other 403.
        throw new ForbiddenAppException(
            "A password change is required before you can continue. Change your password and try again.");
    }
}
