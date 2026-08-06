using Collega.Domain.Auditing;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence;

/// <summary>
/// EF Core DbContext for Collega. Epic 1 exposes only cross-cutting audit storage;
/// feature entities (Organization, User, Board, Idea, etc.) are added by later epics.
/// </summary>
public sealed class CollegaDbContext : DbContext
{
    public CollegaDbContext(DbContextOptions<CollegaDbContext> options)
        : base(options)
    {
    }

    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CollegaDbContext).Assembly);
    }
}
