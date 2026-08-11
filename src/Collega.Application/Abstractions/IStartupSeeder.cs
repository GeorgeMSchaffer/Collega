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
    /// <param name="resetSiteAdmin">
    /// Dev/ops affordance (not product behavior). When <c>true</c> and <paramref name="seedSiteAdmin"/>
    /// is also set, an existing Site Admin matching <paramref name="siteAdminEmail"/> is dropped and
    /// recreated from the configured credentials with <c>MustChangePassword = true</c>. Scope is the
    /// Site Admin only; demo data is untouched. When <c>false</c> the Site Admin seed stays idempotent
    /// (created only when absent), the historical default.
    /// </param>
    Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedSiteAdmin,
        bool seedDemoData,
        bool resetSiteAdmin = false,
        CancellationToken cancellationToken = default);
}
