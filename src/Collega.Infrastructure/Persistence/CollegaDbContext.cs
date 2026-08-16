using Collega.Domain.Ai;
using Collega.Domain.Auditing;
using Collega.Domain.Impersonation;
using Collega.Domain.Boards;
using Collega.Domain.Comments;
using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;
using Collega.Domain.Ideas;
using Collega.Domain.Notifications;
using Collega.Domain.Organizations;
using Collega.Domain.Statuses;
using Collega.Domain.Tags;
using Collega.Domain.Upvotes;
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

    /// <summary>
    /// AI token consumption, one row per model call. Separate from <see cref="AuditEvents"/> on
    /// purpose — this one is aggregated on the hot path by the daily budget gate
    /// (SPEC/20-feature-ai-idea-assist.md rule 28a).
    /// </summary>
    public DbSet<AiUsageRecord> AiUsageRecords => Set<AiUsageRecord>();

    public DbSet<ImpersonationSession> ImpersonationSessions => Set<ImpersonationSession>();

    public DbSet<Organization> Organizations => Set<Organization>();

    public DbSet<User> Users => Set<User>();

    public DbSet<Status> Statuses => Set<Status>();

    public DbSet<IdeaType> IdeaTypes => Set<IdeaType>();

    public DbSet<IdeaTypeField> IdeaTypeFields => Set<IdeaTypeField>();

    public DbSet<BusinessImpact> BusinessImpacts => Set<BusinessImpact>();

    public DbSet<Board> Boards => Set<Board>();

    public DbSet<BoardSwimlane> BoardSwimlanes => Set<BoardSwimlane>();

    public DbSet<Idea> Ideas => Set<Idea>();

    public DbSet<Tag> Tags => Set<Tag>();

    public DbSet<Comment> Comments => Set<Comment>();

    public DbSet<IdeaUpvote> IdeaUpvotes => Set<IdeaUpvote>();

    public DbSet<NotificationEvent> NotificationEvents => Set<NotificationEvent>();

    public DbSet<FieldDefinition> FieldDefinitions => Set<FieldDefinition>();

    public DbSet<FieldDefinitionOption> FieldDefinitionOptions => Set<FieldDefinitionOption>();

    public DbSet<IdeaFieldValue> IdeaFieldValues => Set<IdeaFieldValue>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CollegaDbContext).Assembly);
    }
}
