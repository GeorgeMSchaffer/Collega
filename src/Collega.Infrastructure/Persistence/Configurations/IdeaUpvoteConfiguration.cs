using Collega.Domain.Ideas;
using Collega.Domain.Upvotes;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaUpvoteConfiguration : IEntityTypeConfiguration<IdeaUpvote>
{
    public void Configure(EntityTypeBuilder<IdeaUpvote> builder)
    {
        builder.ToTable("idea_upvotes");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(u => u.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(u => u.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(u => u.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        // One active upvote per user per idea (SPEC/20-feature-ideas-and-engagement.md "Upvotes" #3).
        builder.HasIndex(u => new { u.IdeaId, u.UserId })
            .IsUnique()
            .HasDatabaseName("ux_idea_upvotes_idea_id_user_id");

        builder.HasOne<Idea>()
            .WithMany()
            .HasForeignKey(u => u.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(u => u.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
