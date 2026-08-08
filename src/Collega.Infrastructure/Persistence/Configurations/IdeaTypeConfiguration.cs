using Collega.Domain.IdeaFields;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaTypeConfiguration : IEntityTypeConfiguration<IdeaType>
{
    public void Configure(EntityTypeBuilder<IdeaType> builder)
    {
        builder.ToTable("idea_types");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(t => t.OrganizationId).HasColumnName("organization_id").IsRequired();
        builder.Property(t => t.Name).HasColumnName("name").HasMaxLength(IdeaType.NameMaxLength).IsRequired();
        builder.Property(t => t.SortOrder).HasColumnName("sort_order").IsRequired();
        builder.Property(t => t.IsDeleted).HasColumnName("is_deleted").IsRequired();

        builder.Property(t => t.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(t => t.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(t => t.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(t => t.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(t => new { t.OrganizationId, t.SortOrder })
            .HasDatabaseName("ix_idea_types_organization_id_sort_order");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(t => t.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
