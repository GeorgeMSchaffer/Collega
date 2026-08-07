using Collega.Domain.Auditing;
using Collega.Domain.Organizations;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext for Collega. Epic 1 established cross-cutting audit storage; the Auth slice
/// (Epic 2) adds the first feature entities: <see cref="Organization"/> (minimal — see
/// SPEC/implementation-agent-tracker.md) and <see cref="User"/>. Remaining feature entities (Board,
/// Idea, etc.) are added by later epics.
/// </summary>
public sealed class CollegaDbContext : DbContext
{
    public CollegaDbContext(DbContextOptions<CollegaDbContext> options)
        : base(options)
    {
    }

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CollegaDbContext).Assembly);
    }
}
