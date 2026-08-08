using Collega.Domain.IdeaFields;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class BusinessImpactConfiguration : IEntityTypeConfiguration<BusinessImpact>
{
    public void Configure(EntityTypeBuilder<BusinessImpact> builder)
    {
        builder.ToTable("business_impacts");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(b => b.OrganizationId).HasColumnName("organization_id").IsRequired();
        builder.Property(b => b.Name).HasColumnName("name").HasMaxLength(BusinessImpact.NameMaxLength).IsRequired();
        builder.Property(b => b.Color).HasColumnName("color").HasMaxLength(BusinessImpact.ColorMaxLength).IsRequired();
        builder.Property(b => b.SortOrder).HasColumnName("sort_order").IsRequired();
        builder.Property(b => b.IsDeleted).HasColumnName("is_deleted").IsRequired();

        builder.Property(b => b.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(b => b.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(b => b.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(b => b.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(b => new { b.OrganizationId, b.SortOrder })
            .HasDatabaseName("ix_business_impacts_organization_id_sort_order");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(b => b.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
