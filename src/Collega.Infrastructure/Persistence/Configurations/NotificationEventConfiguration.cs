using Collega.Domain.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class NotificationEventConfiguration : IEntityTypeConfiguration<NotificationEvent>
{
    public void Configure(EntityTypeBuilder<NotificationEvent> builder)
    {
        builder.ToTable("notification_events");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.EventType)
            .HasColumnName("event_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(e => e.BoardId)
            .HasColumnName("board_id")
            .IsRequired();

        builder.Property(e => e.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(e => e.IdeaTitle)
            .HasColumnName("idea_title")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(e => e.ActorUserId)
            .HasColumnName("actor_user_id")
            .IsRequired();

        builder.Property(e => e.RecipientUserId)
            .HasColumnName("recipient_user_id")
            .IsRequired();

        builder.Property(e => e.Link)
            .HasColumnName("link")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.OccurredAtUtc)
            .HasColumnName("occurred_at_utc")
            .IsRequired();

        builder.HasIndex(e => e.RecipientUserId)
            .HasDatabaseName("ix_notification_events_recipient_user_id");

        builder.HasIndex(e => e.IdeaId)
            .HasDatabaseName("ix_notification_events_idea_id");

        builder.HasIndex(e => e.OccurredAtUtc)
            .HasDatabaseName("ix_notification_events_occurred_at_utc");
    }
}
