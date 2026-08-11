using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Collega.API.Tests.Infrastructure;

namespace Collega.API.Tests;

/// <summary>
/// Integration coverage for the authentication pipeline (T047-T049 hardening) through the real
/// host: login success, invalid-credential rejection, the 5-in-15 failed-attempt lockout, the
/// unauthenticated-protected-endpoint gate, the forced first-login password change, and
/// SecurityStamp invalidation (a same-process password change immediately revokes an issued token).
///
/// Lockout maps to <c>429 Too Many Requests</c>, per SPEC/30-Contracts.md ("429 locked out after 5
/// failed attempts within 15 minutes") and <c>LockedOutAppException</c>'s own mapping in
/// <c>AppExceptionHandler</c> — not 423. (CLAUDE.md's error table lists 423; that is stale doc
/// drift, not the implemented behavior.)
///
/// Each locking/lockout scenario uses a freshly created org user, never the seeded Site Admin,
/// because a single <see cref="CollegaApiFactory"/> instance (shared per test class via
/// <see cref="IClassFixture{TFixture}"/>) backs one InMemory database — locking the shared admin
/// would poison sibling tests.
/// </summary>
public sealed class AuthenticationTests : IClassFixture<CollegaApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private const string SiteAdminEmail = "siteadmin@collega.test";
    private const string SiteAdminPassword = "Test123!Password";
    private const string StrongPassword = "Str0ng!Pass";
    private const string ChangedPassword = "N3w!Passw0rd";

    private readonly CollegaApiFactory _factory;

    public AuthenticationTests(CollegaApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_Succeeds_And_Issues_A_Usable_Token()
    {
        // Deliberately NOT the class-shared factory: this is the one test that asserts on the
        // *seeded* Site Admin password and its pristine RequiresPasswordChange flag, and sibling
        // tests rotate that password (they must, to get past the mandatory-rotation gate). Sharing
        // the fixture here would make the test order-dependent, and xUnit does not guarantee order.
        using var factory = new CollegaApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = SiteAdminEmail, password = SiteAdminPassword });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>(Json);
        Assert.NotNull(body);
        Assert.False(string.IsNullOrWhiteSpace(body!.AccessToken));
        Assert.Equal(28_800, body.ExpiresInSeconds);
        // The seeded Site Admin is flagged to change its password on first login (auth requirement #8).
        Assert.True(body.RequiresPasswordChange);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);
        var me = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Login_With_Invalid_Credentials_Returns_401()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = "totally-wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Five_Failed_Attempts_In_Window_Lock_The_Account()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();

        // Attempts 1-4 are ordinary invalid credentials (401). The 5th trips the 5-in-15 lockout,
        // after which the account is locked and login returns 429 regardless of the password.
        HttpResponseMessage? last = null;
        for (var attempt = 1; attempt <= 5; attempt++)
        {
            last?.Dispose();
            last = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = "wrong-password" });
            if (attempt < 5)
            {
                Assert.Equal(HttpStatusCode.Unauthorized, last.StatusCode);
            }
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        last.Dispose();

        // Even the correct password is refused while the lockout window is active.
        using var lockedOut = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = StrongPassword });
        Assert.Equal(HttpStatusCode.TooManyRequests, lockedOut.StatusCode);
    }

    [Fact]
    public async Task Protected_Endpoint_Returns_401_When_Unauthenticated()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Forced_First_Login_Password_Change_Flow()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();

        // First login with the admin-issued credential requires a password change.
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = StrongPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        Assert.True(loginBody!.RequiresPasswordChange);

        // The forced change is performed with the just-issued (still valid) token.
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginBody.AccessToken);
        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword = StrongPassword, newPassword = ChangedPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        // Re-login with the new password no longer requires a change.
        using var reClient = _factory.CreateClient();
        var reLogin = await reClient.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = ChangedPassword });
        Assert.Equal(HttpStatusCode.OK, reLogin.StatusCode);
        var reBody = await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json);
        Assert.False(reBody!.RequiresPasswordChange);

        // The old password is no longer accepted.
        using var oldPassword = await reClient.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = StrongPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, oldPassword.StatusCode);
    }

    [Fact]
    public async Task Access_Token_Is_Invalidated_By_A_SameProcess_Password_Change()
    {
        using var admin = _factory.CreateClient();
        await AuthenticateAsSiteAdminAsync(admin);
        var user = await CreateOrgUserAsync(admin);

        using var client = _factory.CreateClient();

        // Log in and capture the first token.
        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = user.Email, password = StrongPassword });
        var loginBody = await login.Content.ReadFromJsonAsync<LoginResponse>(Json);
        var firstToken = loginBody!.AccessToken;

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", firstToken);

        // The token works before the password change.
        var meBefore = await client.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.OK, meBefore.StatusCode);

        // Changing the password rotates the SecurityStamp, which every authenticated request
        // revalidates against the embedded claim (SPEC/30-Contracts.md), so the first token dies.
        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new { currentPassword = StrongPassword, newPassword = ChangedPassword });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);

        using var stale = _factory.CreateClient();
        stale.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", firstToken);
        var meAfter = await stale.GetAsync("/api/v1/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, meAfter.StatusCode);
    }

    // Helpers -----------------------------------------------------------------------------------

    private async Task<CreatedUser> CreateOrgUserAsync(HttpClient admin)
    {
        var org = await admin.PostAsJsonAsync("/api/v1/organizations", new
        {
            title = $"Org {Guid.NewGuid():N}",
            description = "Authentication test organization."
        });
        org.EnsureSuccessStatusCode();
        var createdOrg = (await org.Content.ReadFromJsonAsync<CreateOrgResponse>(Json))!;

        var email = $"authuser-{Guid.NewGuid():N}@auth.test";
        var user = await admin.PostAsJsonAsync($"/api/v1/organizations/{createdOrg.OrganizationId}/users", new
        {
            firstName = "Auth",
            lastName = "User",
            email,
            role = "User",
            initialPassword = StrongPassword
        });
        user.EnsureSuccessStatusCode();
        var createdUser = (await user.Content.ReadFromJsonAsync<CreateUserResponse>(Json))!;
        return new CreatedUser(createdUser.UserId, email);
    }

    /// <summary>
    /// The mandatory first-login rotation is enforced server-side, not just by the Blazor client's
    /// <c>mustChangePassword</c> claim. Before this gate existed the token issued alongside
    /// <c>RequiresPasswordChange = true</c> was fully valid for every endpoint, so a user holding an
    /// admin-issued temporary password could skip the rotation entirely by calling the API directly
    /// and keep operating on a credential the issuing admin still knows.
    /// </summary>
    [Fact]
    public async Task Token_Issued_While_PasswordChangeRequired_Is_Refused_Outside_The_Allowlist()
    {
        // Own factory: this test needs a Site Admin that has NOT yet rotated (see the note on
        // Login_Succeeds_And_Issues_A_Usable_Token).
        using var factory = new CollegaApiFactory();
        using var client = factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = SiteAdminEmail, password = SiteAdminPassword });
        login.EnsureSuccessStatusCode();
        var body = (await login.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        Assert.True(body.RequiresPasswordChange);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.AccessToken);

        // Allowlisted: the client needs these two to render and complete the rotation.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);

        // Everything else is refused, whatever the caller's role would otherwise permit.
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/v1/organizations")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/v1/organizations", new { title = "Blocked Org", description = "x" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/v1/auth/me", new { firstName = "Nope", lastName = "Nope" })).StatusCode);

        // Completing the rotation lifts the restriction on the next request.
        var change = await client.PostAsJsonAsync("/api/v1/auth/change-password", new
        {
            currentPassword = SiteAdminPassword,
            newPassword = ChangedPassword
        });
        change.EnsureSuccessStatusCode();

        var reLogin = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = SiteAdminEmail, password = ChangedPassword });
        reLogin.EnsureSuccessStatusCode();
        var reBody = (await reLogin.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        Assert.False(reBody.RequiresPasswordChange);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reBody.AccessToken);

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/organizations")).StatusCode);
    }

    /// <summary>
    /// The gate reads live persisted state per request rather than a value baked into the token, so
    /// an unauthenticated caller is untouched by it — login and register keep working.
    /// </summary>
    [Fact]
    public async Task PasswordChangeGate_Does_Not_Affect_Anonymous_Endpoints()
    {
        using var factory = new CollegaApiFactory();
        using var client = factory.CreateClient();

        var login = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = SiteAdminEmail, password = SiteAdminPassword });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    // Rotates the seeded Site Admin's mandatory first-login password before use; shared so the
    // nine test classes that need a Site Admin session don't each carry a copy.
    private static Task AuthenticateAsSiteAdminAsync(HttpClient client) =>
        SiteAdminAuth.AuthenticateAsSiteAdminAsync(client);

    private sealed record LoginResponse(string AccessToken, int ExpiresInSeconds, bool RequiresPasswordChange);
    private sealed record CreateOrgResponse(Guid OrganizationId, string InviteCode, Guid DefaultBoardId, int DefaultStatusCount);
    private sealed record CreateUserResponse(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);
    private sealed record CreatedUser(Guid UserId, string Email);
}
