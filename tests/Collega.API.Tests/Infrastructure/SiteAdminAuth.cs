using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Collega.API.Tests.Infrastructure;

/// <summary>
/// Authenticates an <see cref="HttpClient"/> as the seeded Site Admin, completing the mandatory
/// first-login password rotation on the way through.
/// </summary>
/// <remarks>
/// <para>The seeded Site Admin is created with <c>MustChangePassword = true</c>, and since the
/// server-side gate landed (Sprint 4) a token minted for that account can reach only
/// <c>GET /auth/me</c> and <c>POST /auth/change-password</c> until the rotation is done. Every
/// integration test that acts as the Site Admin therefore has to rotate first — which is the real
/// product flow, and previously was silently skipped.</para>
///
/// <para><b>Idempotent by necessity.</b> Test classes share one InMemory database through
/// <c>IClassFixture&lt;CollegaApiFactory&gt;</c>, so the first test in a class performs the
/// rotation and every later test in that same class must sign in with the rotated password
/// instead. This helper handles both cases, so call sites don't have to know whether they ran
/// first. xUnit serializes tests within a class, so there is no race between them.</para>
/// </remarks>
public static class SiteAdminAuth
{
    public const string Email = "siteadmin@collega.test";

    /// <summary>The seeded password, matching <see cref="CollegaApiFactory"/>'s environment variables.</summary>
    public const string SeededPassword = "Test123!Password";

    /// <summary>The password the seeded account is rotated to on first use within a test class.</summary>
    public const string RotatedPassword = "Rotated123!Password";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// Signs in and sets the bearer header, rotating the seeded password on first use. Safe to call
    /// repeatedly against the same class-scoped database.
    /// </summary>
    public static async Task AuthenticateAsSiteAdminAsync(HttpClient client)
    {
        var token = await SignInRotatingIfRequiredAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private static async Task<string> SignInRotatingIfRequiredAsync(HttpClient client)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = Email, password = SeededPassword });

        // Already rotated by an earlier test sharing this class's database.
        if (login.StatusCode == HttpStatusCode.Unauthorized)
        {
            return await LoginAsync(client, RotatedPassword);
        }

        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;

        if (!body.RequiresPasswordChange)
        {
            return body.AccessToken;
        }

        // Rotate. change-password is one of the two endpoints reachable mid-rotation.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new
        {
            currentPassword = SeededPassword,
            newPassword = RotatedPassword
        });
        change.EnsureSuccessStatusCode();

        // Changing the password rotates the user's SecurityStamp, which invalidates the token that
        // was just used — a fresh sign-in is required, not merely nice to have.
        return await LoginAsync(client, RotatedPassword);
    }

    private static async Task<string> LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = Email, password });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        return body.AccessToken;
    }

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
}
