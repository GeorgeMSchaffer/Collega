using System.Security.Cryptography;
using Collega.Application.Abstractions;
using Collega.Domain.Enums;
using Collega.Domain.Organizations;
using Collega.Domain.Users;
using Collega.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Seeding;

/// <summary>
/// Idempotent startup seeding (auth requirements #8-11):
/// 1. The global Site Admin, from environment-provided credentials, on first run only.
/// 2. Development-only: 3 demo organizations, each with one Org Admin, one User, and one Read
///    Only account at password `Abc123!`, none forced to change it.
/// </summary>
public sealed class StartupSeeder : IStartupSeeder
{
    private const string DemoPassword = "Abc123!";

    private static readonly (string Title, string Slug)[] DemoOrganizations =
    {
        ("Acme Robotics", "acme-robotics"),
        ("Blue Harbor Logistics", "blue-harbor"),
        ("Crestline Health Group", "crestline-health")
    };

    private readonly CollegaDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IClock _clock;

    public StartupSeeder(CollegaDbContext dbContext, IPasswordHasher passwordHasher, IClock clock)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _clock = clock;
    }

    public async Task SeedAsync(
        string siteAdminEmail,
        string siteAdminPassword,
        bool seedDevelopmentDemoData,
        CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;

        var hasSiteAdmin = await _dbContext.Users.AnyAsync(u => u.Role == Role.SiteAdmin, cancellationToken);
        if (!hasSiteAdmin)
        {
            var passwordHash = _passwordHasher.Hash(siteAdminPassword);
            var siteAdmin = User.CreateSiteAdmin("Site", "Admin", siteAdminEmail, passwordHash, now);
            await _dbContext.Users.AddAsync(siteAdmin, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        if (!seedDevelopmentDemoData)
        {
            return;
        }

        var demoPasswordHash = _passwordHasher.Hash(DemoPassword);

        foreach (var (title, slug) in DemoOrganizations)
        {
            var existing = await _dbContext.Organizations.FirstOrDefaultAsync(o => o.Title == title, cancellationToken);
            if (existing is not null)
            {
                continue;
            }

            var organization = Organization.Create(title, GenerateInviteCode(slug), now);
            await _dbContext.Organizations.AddAsync(organization, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            await AddDemoUserAsync(organization.Id, "Olivia", "Administer", $"orgadmin@{slug}.demo.collega.test", demoPasswordHash, Role.OrgAdmin, now, cancellationToken);
            await AddDemoUserAsync(organization.Id, "Noah", "Contributor", $"user@{slug}.demo.collega.test", demoPasswordHash, Role.User, now, cancellationToken);
            await AddDemoUserAsync(organization.Id, "Ivy", "Viewer", $"readonly@{slug}.demo.collega.test", demoPasswordHash, Role.ReadOnly, now, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    private async Task AddDemoUserAsync(
        Guid organizationId,
        string firstName,
        string lastName,
        string email,
        string passwordHash,
        Role role,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var user = User.CreateOrganizationUser(organizationId, firstName, lastName, email, passwordHash, role, UserStatus.Active, mustChangePassword: false, nowUtc);
        await _dbContext.Users.AddAsync(user, cancellationToken);
    }

    private static string GenerateInviteCode(string slug)
    {
        var suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
        return $"{slug}-{suffix}".ToUpperInvariant();
    }
}
