using Collega.Domain.Impersonation;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class ImpersonationSessionConfiguration : IEntityTypeConfiguration<ImpersonationSession>
{
    public void Configure(EntityTypeBuilder<ImpersonationSession> builder)
    {
        builder.ToTable("impersonation_sessions");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(s => s.RealUserId)
            .HasColumnName("real_user_id")
            .IsRequired();

        builder.Property(s => s.TargetUserId)
            .HasColumnName("target_user_id")
            .IsRequired();

        builder.Property(s => s.StartedAtUtc).HasColumnName("started_at_utc").IsRequired();
        builder.Property(s => s.LastSeenAtUtc).HasColumnName("last_seen_at_utc").IsRequired();
        builder.Property(s => s.AbsoluteExpiresAtUtc).HasColumnName("absolute_expires_at_utc").IsRequired();
        builder.Property(s => s.EndedAtUtc).HasColumnName("ended_at_utc");

        builder.Property(s => s.EndReason)
            .HasColumnName("end_reason")
            .HasConversion<string>()
            .HasMaxLength(40);

        // At most one open session per administrator — the database backstop for the non-nestable
        // rule (SPEC/20-feature-view-as.md rule 5). The application refuses a second session with a
        // 409, but that is a read-then-write check and is not transactional; without this filtered
        // index two concurrent starts could both commit and leave the resolver picking arbitrarily
        // between them. Filtered on open rows only, since ended sessions are kept as audit history.
        builder.HasIndex(s => s.RealUserId)
            .HasFilter("ended_at_utc IS NULL")
            .IsUnique()
            .HasDatabaseName("ux_impersonation_sessions_real_user_id_open");

        // Looking up a live session happens on every authenticated request, so this is the hot path.
        builder.HasIndex(s => new { s.RealUserId, s.EndedAtUtc })
            .HasDatabaseName("ix_impersonation_sessions_real_user_id_ended_at_utc");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(s => s.RealUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(s => s.TargetUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
