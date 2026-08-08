using Collega.Domain.IdeaFields;
using Collega.Domain.Ideas;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaConfiguration : IEntityTypeConfiguration<Idea>
{
    public void Configure(EntityTypeBuilder<Idea> builder)
    {
        builder.ToTable("ideas");

        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(i => i.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(i => i.BoardId)
            .HasColumnName("board_id")
            .IsRequired();

        builder.Property(i => i.StatusId)
            .HasColumnName("status_id")
            .IsRequired();

        builder.Property(i => i.Title)
            .HasColumnName("title")
            .HasMaxLength(Idea.TitleMaxLength)
            .IsRequired();

        builder.Property(i => i.Description)
            .HasColumnName("description")
            .HasMaxLength(Idea.DescriptionMaxLength)
            .IsRequired();

        builder.Property(i => i.Priority)
            .HasColumnName("priority")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(i => i.IdeaTypeId)
            .HasColumnName("idea_type_id")
            .IsRequired();

        builder.Property(i => i.BusinessImpactId)
            .HasColumnName("business_impact_id")
            .IsRequired();

        builder.Property(i => i.DueDate)
            .HasColumnName("due_date")
            .HasColumnType("date");

        builder.Property(i => i.AuthorUserId)
            .HasColumnName("author_user_id")
            .IsRequired();

        builder.Property(i => i.IsDeleted)
            .HasColumnName("is_deleted")
            .IsRequired();

        builder.Property(i => i.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(i => i.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(i => i.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(i => i.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(i => new { i.BoardId, i.IsDeleted })
            .HasDatabaseName("ix_ideas_board_id_is_deleted");

        builder.HasIndex(i => new { i.OrganizationId, i.IsDeleted })
            .HasDatabaseName("ix_ideas_organization_id_is_deleted");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(i => i.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        // Restrict: options are soft-deleted, never hard-deleted, so existing idea references remain valid.
        builder.HasOne<IdeaType>()
            .WithMany()
            .HasForeignKey(i => i.IdeaTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<BusinessImpact>()
            .WithMany()
            .HasForeignKey(i => i.BusinessImpactId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(i => i.Assignees)
            .WithOne()
            .HasForeignKey(a => a.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(i => i.Tags)
            .WithOne()
            .HasForeignKey(t => t.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(i => i.Mentions)
            .WithOne()
            .HasForeignKey(m => m.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(i => i.FieldValues)
            .WithOne()
            .HasForeignKey(v => v.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Idea.Assignees))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Idea.Tags))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Idea.Mentions))!.SetPropertyAccessMode(PropertyAccessMode.Field);
        builder.Metadata.FindNavigation(nameof(Idea.FieldValues))!.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
