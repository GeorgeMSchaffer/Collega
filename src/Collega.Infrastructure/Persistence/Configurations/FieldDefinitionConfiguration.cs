using Collega.Domain.Fields;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class FieldDefinitionConfiguration : IEntityTypeConfiguration<FieldDefinition>
{
    public void Configure(EntityTypeBuilder<FieldDefinition> builder)
    {
        builder.ToTable("field_definitions");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(f => f.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(f => f.Name)
            .HasColumnName("name")
            .HasMaxLength(FieldDefinition.NameMaxLength)
            .IsRequired();

        builder.Property(f => f.Description)
            .HasColumnName("description")
            .HasMaxLength(FieldDefinition.DescriptionMaxLength);

        // Persisted as int (the explicit numeric FieldType values are the storage contract).
        builder.Property(f => f.FieldType)
            .HasColumnName("field_type")
            .HasConversion<int>()
            .IsRequired();

        builder.Property(f => f.IsRequired)
            .HasColumnName("is_required")
            .IsRequired();

        builder.Property(f => f.DisplayOrder)
            .HasColumnName("display_order")
            .IsRequired();

        builder.Property(f => f.IsDeleted)
            .HasColumnName("is_deleted")
            .IsRequired();

        builder.Property(f => f.DeletedAtUtc).HasColumnName("deleted_at_utc");
        builder.Property(f => f.DeletedByUserId).HasColumnName("deleted_by_user_id");

        builder.Property(f => f.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(f => f.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(f => f.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(f => f.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // One active field name per organization (soft-deleted rows are excluded from the constraint).
        builder.HasIndex(f => new { f.OrganizationId, f.Name })
            .HasFilter("[is_deleted] = 0")
            .IsUnique()
            .HasDatabaseName("ux_field_definitions_organization_id_name");

        builder.HasIndex(f => new { f.OrganizationId, f.DisplayOrder })
            .HasDatabaseName("ix_field_definitions_organization_id_display_order");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(f => f.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(f => f.Options)
            .WithOne()
            .HasForeignKey(o => o.FieldDefinitionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(FieldDefinition.Options))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
