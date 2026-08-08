using Collega.Domain.Organizations;
using Collega.Domain.Statuses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class StatusConfiguration : IEntityTypeConfiguration<Status>
{
    public void Configure(EntityTypeBuilder<Status> builder)
    {
        builder.ToTable("statuses");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(s => s.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(Status.NameMaxLength)
            .IsRequired();

        builder.Property(s => s.Color)
            .HasColumnName("color")
            .HasMaxLength(Status.ColorMaxLength)
            .IsRequired();

        builder.Property(s => s.SortOrder)
            .HasColumnName("sort_order")
            .IsRequired();

        builder.Property(s => s.IsDeleted)
            .HasColumnName("is_deleted")
            .IsRequired();

        builder.Property(s => s.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(s => s.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(s => s.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(s => s.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(s => new { s.OrganizationId, s.SortOrder })
            .HasDatabaseName("ix_statuses_organization_id_sort_order");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(s => s.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
