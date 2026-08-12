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

    /// <summary>Claim marking a session that must complete a forced password change before use.</summary>
    public const string MustChangePasswordClaim = "mustChangePassword";

    /// <summary>Claim carrying the current user's portrait as an inline data URL (absent when unset).</summary>
    public const string PortraitClaim = "portrait";

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

        var mustChange = await _store.GetMustChangePasswordAsync();
        return new AuthenticationState(BuildPrincipal(user, mustChange));
    }

    public async Task MarkSignedInAsync(string token, UserSummaryDto user, bool mustChangePassword, int expiresInSeconds)
    {
        await _store.SaveAsync(token, user, mustChangePassword, expiresInSeconds);
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(BuildPrincipal(user, mustChangePassword))));
    }

    public async Task RefreshUserAsync(UserSummaryDto user)
    {
        var mustChangePassword = await _store.GetMustChangePasswordAsync();
        await _store.SaveUserAsync(user);
        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(BuildPrincipal(user, mustChangePassword))));
    }

    public async Task MarkSignedOutAsync(string reason = "logout", bool broadcast = true)
    {
        await _store.ClearAsync(reason, broadcast);
        NotifyAuthenticationStateChanged(Task.FromResult(_anonymous));
    }

    private static ClaimsPrincipal BuildPrincipal(UserSummaryDto user, bool mustChangePassword)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId),
            new(ClaimTypes.Name, $"{user.FirstName} {user.LastName}".Trim()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("status", user.Status),
        };

        if (mustChangePassword)
        {
            claims.Add(new Claim(MustChangePasswordClaim, "true"));
        }

        if (!string.IsNullOrEmpty(user.PortraitDataUrl))
        {
            claims.Add(new Claim(PortraitClaim, user.PortraitDataUrl));
        }

        if (!string.IsNullOrEmpty(user.OrganizationId))
        {
            claims.Add(new Claim("organizationId", user.OrganizationId));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, AuthenticationType, ClaimTypes.Name, ClaimTypes.Role));
    }
}
