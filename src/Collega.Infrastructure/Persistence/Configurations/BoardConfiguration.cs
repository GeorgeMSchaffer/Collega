using Collega.Domain.Boards;
using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class BoardConfiguration : IEntityTypeConfiguration<Board>
{
    public void Configure(EntityTypeBuilder<Board> builder)
    {
        builder.ToTable("boards");

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(b => b.OrganizationId)
            .HasColumnName("organization_id")
            .IsRequired();

        builder.Property(b => b.Name)
            .HasColumnName("name")
            .HasMaxLength(Board.NameMaxLength)
            .IsRequired();

        builder.Property(b => b.AllowUserStatusUpdate)
            .HasColumnName("allow_user_status_update")
            .IsRequired();

        builder.Property(b => b.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(b => b.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(b => b.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(b => b.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(b => b.OrganizationId)
            .HasDatabaseName("ix_boards_organization_id");

        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(b => b.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        // Swimlanes are owned by the board and loaded through the read-only navigation on the entity.
        builder.HasMany(b => b.Swimlanes)
            .WithOne()
            .HasForeignKey(sl => sl.BoardId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata
            .FindNavigation(nameof(Board.Swimlanes))!
            .SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
