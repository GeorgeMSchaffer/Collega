using Collega.Domain.Comments;
using Collega.Domain.Ideas;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");

        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(c => c.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(c => c.AuthorUserId)
            .HasColumnName("author_user_id")
            .IsRequired();

        builder.Property(c => c.Body)
            .HasColumnName("body")
            .HasMaxLength(Comment.BodyMaxLength)
            .IsRequired();

        builder.Property(c => c.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(c => c.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(c => c.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(c => c.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(c => new { c.IdeaId, c.CreatedAtUtc })
            .HasDatabaseName("ix_comments_idea_id_created_at_utc");

        // A comment is removed with its idea (idea soft-delete leaves comments in place; a hard
        // delete of the row cascades to the comment's mentions only).
        builder.HasOne<Idea>()
            .WithMany()
            .HasForeignKey(c => c.IdeaId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Mentions)
            .WithOne()
            .HasForeignKey(m => m.CommentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Metadata.FindNavigation(nameof(Comment.Mentions))!.SetPropertyAccessMode(PropertyAccessMode.Field);
    }
}
