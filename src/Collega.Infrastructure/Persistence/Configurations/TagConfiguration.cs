using Collega.Domain.Organizations;
using Collega.Domain.Tags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.ToTable("tags");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(t => t.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(Tag.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.NormalizedName)
            .HasColumnName("normalized_name")
            .HasMaxLength(Tag.NameMaxLength)
            .IsRequired();

        builder.Property(t => t.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(t => t.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(t => t.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(t => t.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // Uniqueness of a normalized tag within an organization; the backstop for merge-on-concurrency
        // (SPEC/20-feature-ideas-and-engagement.md "Tags" #6-7).
        builder.HasIndex(t => new { t.OrganizationId, t.NormalizedName })
            .IsUnique()
            .HasDatabaseName("ux_tags_organization_id_normalized_name");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(t => t.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
