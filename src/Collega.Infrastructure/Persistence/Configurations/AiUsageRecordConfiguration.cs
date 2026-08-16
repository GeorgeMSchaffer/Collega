using Collega.Domain.Ai;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class AiUsageRecordConfiguration : IEntityTypeConfiguration<AiUsageRecord>
{
    public void Configure(EntityTypeBuilder<AiUsageRecord> builder)
    {
        builder.ToTable("ai_usage_records");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        // Required, unlike audit_events.organization_id — every model call belongs to exactly one
        // organization, and an unattributed row is spend nobody can be billed for (rule 28c).
        builder.Property(e => e.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(e => e.ActorUserId)
            .HasColumnName("actor_user_id");

        builder.Property(e => e.OnBehalfOfUserId)
            .HasColumnName("on_behalf_of_user_id");

        builder.Property(e => e.BoardId)
            .HasColumnName("board_id");

        builder.Property(e => e.OccurredAtUtc)
            .HasColumnName("occurred_at_utc")
            .IsRequired();

        builder.Property(e => e.Model)
            .HasColumnName("model")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.InputTokens)
            .HasColumnName("input_tokens")
            .IsRequired();

        builder.Property(e => e.OutputTokens)
            .HasColumnName("output_tokens")
            .IsRequired();

        builder.Property(e => e.CacheReadInputTokens)
            .HasColumnName("cache_read_input_tokens")
            .IsRequired();

        builder.Property(e => e.CacheCreationInputTokens)
            .HasColumnName("cache_creation_input_tokens")
            .IsRequired();

        // numeric(12,6): per-million rates are small but need sub-cent precision, and a rate is a
        // money value — never float, whose rounding would drift across an aggregation.
        builder.Property(e => e.InputRatePerMillion)
            .HasColumnName("input_rate_per_million")
            .HasPrecision(12, 6)
            .IsRequired();

        builder.Property(e => e.OutputRatePerMillion)
            .HasColumnName("output_rate_per_million")
            .HasPrecision(12, 6)
            .IsRequired();

        // Stored as the enum's string name rather than its ordinal: these rows outlive the code that
        // wrote them, and a reordered enum must not silently reinterpret historical spend.
        builder.Property(e => e.KeySource)
            .HasColumnName("key_source")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Outcome)
            .HasColumnName("outcome")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // The composite index both hot reads need: the daily budget gate sums a UTC-day window
        // (rule 28a) and the usage surface groups by organization over a range (rule 28d).
        builder.HasIndex(e => new { e.OrganizationId, e.OccurredAtUtc })
            .HasDatabaseName("ix_ai_usage_records_organization_id_occurred_at_utc");

        // The budget gate is platform-wide, so it filters on time alone with no organization
        // predicate — that read cannot use the composite index above.
        builder.HasIndex(e => e.OccurredAtUtc)
            .HasDatabaseName("ix_ai_usage_records_occurred_at_utc");
    }
}
