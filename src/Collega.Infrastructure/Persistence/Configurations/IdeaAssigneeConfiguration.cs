using Collega.Domain.Ideas;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaAssigneeConfiguration : IEntityTypeConfiguration<IdeaAssignee>
{
    public void Configure(EntityTypeBuilder<IdeaAssignee> builder)
    {
        builder.ToTable("idea_assignees");

        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(a => a.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.HasIndex(a => new { a.IdeaId, a.UserId })
            .IsUnique()
            .HasDatabaseName("ux_idea_assignees_idea_id_user_id");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
