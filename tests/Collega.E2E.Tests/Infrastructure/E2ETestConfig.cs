namespace Collega.E2E.Tests.Infrastructure;

/// <summary>
/// Environment-driven configuration for the E2E suite. These tests drive a *running*
/// Client (and, transitively, the API) rather than an in-process host, so the base URL
/// and demo credentials are read from the environment with sensible local defaults.
///
/// Defaults match the Client's `http` launch profile and the Development demo seed
/// (see src/Collega.Infrastructure/Seeding/StartupSeeder.cs).
/// </summary>
public static class E2ETestConfig
{
    /// <summary>Root URL of the running Blazor Client. Override with COLLEGA_E2E_BASEURL.</summary>
    public static string BaseUrl =>
        Environment.GetEnvironmentVariable("COLLEGA_E2E_BASEURL")?.TrimEnd('/')
        ?? "http://localhost:5098";

    /// <summary>
    /// A seeded Org Admin with no forced password change — the default identity for
    /// most flows. Demo seed runs in Development only.
    /// </summary>
    public static (string Email, string Password) OrgAdmin => (
        Environment.GetEnvironmentVariable("COLLEGA_E2E_ORGADMIN_EMAIL")
            ?? "orgadmin@acme-robotics.demo.collega.test",
        Environment.GetEnvironmentVariable("COLLEGA_E2E_ORGADMIN_PASSWORD")
            ?? "Abc123!");

    /// <summary>A seeded ordinary User in the same organization.</summary>
    public static (string Email, string Password) User => (
        Environment.GetEnvironmentVariable("COLLEGA_E2E_USER_EMAIL")
            ?? "user@acme-robotics.demo.collega.test",
        Environment.GetEnvironmentVariable("COLLEGA_E2E_USER_PASSWORD")
            ?? "Abc123!");

    /// <summary>Slow the browser down (ms) for local debugging via COLLEGA_E2E_SLOWMO.</summary>
    public static float SlowMoMs =>
        float.TryParse(Environment.GetEnvironmentVariable("COLLEGA_E2E_SLOWMO"), out var ms) ? ms : 0f;
}
