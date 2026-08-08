using System.Text.Json;
using Microsoft.JSInterop;

namespace Collega.Client.Services;

/// <summary>
/// Persists the signed-in session (bearer token + user projection) in browser localStorage so a
/// page refresh keeps the user logged in. The JWT itself only carries subject/security-stamp/expiry
/// claims, so the <see cref="UserSummaryDto"/> is stored alongside it to rebuild the identity's
/// role/name/email without an extra <c>GET /auth/me</c> round-trip on load.
/// </summary>
public sealed class AuthSessionStore
{
    private const string TokenKey = "collega.token";
    private const string UserKey = "collega.user";
    private const string MustChangeKey = "collega.mustChangePassword";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly IJSRuntime _js;

    public AuthSessionStore(IJSRuntime js) => _js = js;

    public async Task<string?> GetTokenAsync() =>
        await _js.InvokeAsync<string?>("localStorage.getItem", TokenKey);

    public async Task<UserSummaryDto?> GetUserAsync()
    {
        var json = await _js.InvokeAsync<string?>("localStorage.getItem", UserKey);
        return string.IsNullOrEmpty(json) ? null : JsonSerializer.Deserialize<UserSummaryDto>(json, JsonOptions);
    }

    public async Task<bool> GetMustChangePasswordAsync() =>
        await _js.InvokeAsync<string?>("localStorage.getItem", MustChangeKey) == "true";

    public async Task SaveAsync(string token, UserSummaryDto user, bool mustChangePassword)
    {
        await _js.InvokeVoidAsync("localStorage.setItem", TokenKey, token);
        await _js.InvokeVoidAsync("localStorage.setItem", UserKey, JsonSerializer.Serialize(user, JsonOptions));
        await _js.InvokeVoidAsync("localStorage.setItem", MustChangeKey, mustChangePassword ? "true" : "false");
    }

    public async Task ClearAsync()
    {
        await _js.InvokeVoidAsync("localStorage.removeItem", TokenKey);
        await _js.InvokeVoidAsync("localStorage.removeItem", UserKey);
        await _js.InvokeVoidAsync("localStorage.removeItem", MustChangeKey);
    }
}
