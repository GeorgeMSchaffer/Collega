using System.Security.Claims;
using Collega.Application.Abstractions;
using Collega.Domain.Enums;
using Microsoft.AspNetCore.Http;

namespace Collega.API.Authentication;

/// <summary>
/// Reads the ambient <see cref="HttpContext.User"/> populated by
/// <see cref="BearerTokenAuthenticationHandler"/> to satisfy the Application-layer
/// <see cref="ICurrentUserContext"/> port. This is HTTP-specific plumbing (request-boundary
/// concern), not business logic, so it lives in Collega.API per the layering rules in CLAUDE.md.
/// </summary>
public sealed class HttpContextCurrentUserContext : ICurrentUserContext
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextCurrentUserContext(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public Guid? UserId
    {
        get
        {
            var value = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var userId) ? userId : null;
        }
    }

    public Guid? OrganizationId
    {
        get
        {
            var value = User?.FindFirstValue(CollegaClaimTypes.OrganizationId);
            return Guid.TryParse(value, out var organizationId) ? organizationId : null;
        }
    }

    public Role? Role
    {
        get
        {
            var value = User?.FindFirstValue(ClaimTypes.Role);
            return Enum.TryParse<Role>(value, out var role) ? role : null;
        }
    }

    /// <summary>
    /// Present only while acting as someone, so its absence is unambiguous — the same reason the
    /// MustChangePassword claim is emitted only when true.
    /// </summary>
    public bool IsImpersonating => User?.FindFirstValue(CollegaClaimTypes.RealUserId) is not null;

    public Guid? RealUserId
    {
        get
        {
            var value = User?.FindFirstValue(CollegaClaimTypes.RealUserId);
            // Falls back to the acting user when not impersonating, so callers that always want
            // "who really did this" never have to branch.
            return Guid.TryParse(value, out var realUserId) ? realUserId : UserId;
        }
    }
}
