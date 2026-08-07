namespace Collega.Application.Abstractions;

/// <summary>
/// Startup seeding port (auth requirements #8-11): the global Site Admin from environment-provided
/// credentials, and — Development environment only — three demo organizations with an Org
/// Admin/User/Read Only account each. Idempotent: safe to invoke on every startup.
/// </summary>
public interface IStartupSeeder
{
    Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedDevelopmentDemoData,
        CancellationToken cancellationToken = default);
}
