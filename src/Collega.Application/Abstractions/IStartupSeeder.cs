namespace Collega.Application.Abstractions;

/// <summary>
/// Startup seeding port (auth requirements #8-11): the global Site Admin from environment-provided
/// credentials, and two demo organizations with one Org Admin, two Users, and two populated boards
/// each. Every board contains 11 deterministic ideas distributed 3/2/2/1/3 across the canonical
/// statuses. The global Site Admin remains organization-independent. Both
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
