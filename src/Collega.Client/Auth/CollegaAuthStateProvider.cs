using System.Security.Claims;
using Collega.Client.Services;
using Microsoft.AspNetCore.Components.Authorization;

namespace Collega.Client.Auth;

/// <summary>
/// Bridges the persisted <see cref="AuthSessionStore"/> to Blazor's authorization system. Builds a
/// <see cref="ClaimsPrincipal"/> from the stored <see cref="UserSummaryDto"/> (the JWT carries no
/// role/name claims) so <c>[Authorize]</c>, <c>&lt;AuthorizeView&gt;</c>, and role checks work, and
/// raises change notifications on sign-in / sign-out.
/// </summary>
public sealed class CollegaAuthStateProvider : AuthenticationStateProvider
{
    public const string AuthenticationType = "collega";

    private readonly AuthSessionStore _store;
    private AuthenticationState _anonymous = new(new ClaimsPrincipal(new ClaimsIdentity()));

    public CollegaAuthStateProvider(AuthSessionStore store) => _store = store;

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var token = await _store.GetTokenAsync();
        var user = await _store.GetUserAsync();
        if (string.IsNullOrEmpty(token) || user is null)
        {
            return _anonymous;
        }

        return new AuthenticationState(BuildPrincipal(user));
    }

    public async Task MarkSignedInAsync(string token, UserSummaryDto user)
    {
        await _store.SaveAsync(token, user);
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(BuildPrincipal(user))));
    }

    public async Task MarkSignedOutAsync()
    {
        await _store.ClearAsync();
        NotifyAuthenticationStateChanged(Task.FromResult(_anonymous));
    }

    private static ClaimsPrincipal BuildPrincipal(UserSummaryDto user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId),
            new(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("status", user.Status),
        };

        if (!string.IsNullOrEmpty(user.OrganizationId))
        {
            claims.Add(new Claim("organizationId", user.OrganizationId));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, AuthenticationType, ClaimTypes.Name, ClaimTypes.Role));
    }
}
