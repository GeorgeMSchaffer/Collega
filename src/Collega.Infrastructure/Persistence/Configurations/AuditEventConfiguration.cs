using Collega.Domain.Auditing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.OrganizationId)
            .HasColumnName("organization_id");

        builder.Property(e => e.ActorUserId)
            .HasColumnName("actor_user_id");

        // The impersonated user when the action was performed through View As; null otherwise.
        // Its own column rather than metadata JSON so "on behalf of whom" stays queryable
        // (SPEC/20-feature-view-as.md rule 14).
        builder.Property(a => a.OnBehalfOfUserId)
            .HasColumnName("on_behalf_of_user_id");

        builder.Property(e => e.EventType)
            .HasColumnName("event_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.EntityId)
            .HasColumnName("entity_id");

        builder.Property(e => e.Message)
            .HasColumnName("message")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(e => e.MetadataJson)
            .HasColumnName("metadata_json");

        builder.Property(e => e.OccurredAtUtc)
            .HasColumnName("occurred_at_utc")
            .IsRequired();

        builder.HasIndex(e => e.OrganizationId)
            .HasDatabaseName("ix_audit_events_organization_id");

        builder.HasIndex(e => e.OccurredAtUtc)
            .HasDatabaseName("ix_audit_events_occurred_at_utc");
    }
}
