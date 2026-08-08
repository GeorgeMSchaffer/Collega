namespace Collega.Application.Abstractions;

/// <summary>
/// Startup seeding port (auth requirements #8-11): the global Site Admin from environment-provided
/// credentials, and three demo organizations with an Org Admin/User/Read Only account each. Both
/// parts are independently toggled by the caller (environment default, or explicit --seed:* flags)
/// and are idempotent: safe to invoke on every startup.
/// </summary>
public interface IStartupSeeder
{
    Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedSiteAdmin,
        bool seedDemoData,
        CancellationToken cancellationToken = default);
}
