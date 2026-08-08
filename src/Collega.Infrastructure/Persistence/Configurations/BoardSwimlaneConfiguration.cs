using Collega.Domain.Boards;
using Collega.Domain.Statuses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class BoardSwimlaneConfiguration : IEntityTypeConfiguration<BoardSwimlane>
{
    public void Configure(EntityTypeBuilder<BoardSwimlane> builder)
    {
        builder.ToTable("board_swimlanes");

        builder.HasKey(sl => sl.Id);
        builder.Property(sl => sl.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(sl => sl.BoardId)
            .HasColumnName("board_id")
            .IsRequired();

        builder.Property(sl => sl.StatusId)
            .HasColumnName("status_id")
            .IsRequired();

        builder.Property(sl => sl.DisplayOrder)
            .HasColumnName("display_order")
            .IsRequired();

        builder.HasIndex(sl => new { sl.BoardId, sl.StatusId })
            .IsUnique()
            .HasDatabaseName("ux_board_swimlanes_board_id_status_id");

        // A status referenced as a swimlane cannot be hard-deleted out from under the board
        // (status deletion is soft-delete only — SPEC/20-feature-boards-and-statuses.md #5).
        builder.HasOne<Status>()
            .WithMany()
            .HasForeignKey(sl => sl.StatusId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
