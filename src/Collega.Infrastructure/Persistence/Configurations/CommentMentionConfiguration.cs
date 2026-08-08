using Collega.Domain.Comments;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class CommentMentionConfiguration : IEntityTypeConfiguration<CommentMention>
{
    public void Configure(EntityTypeBuilder<CommentMention> builder)
    {
        builder.ToTable("comment_mentions");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(m => m.CommentId)
            .HasColumnName("comment_id")
            .IsRequired();

        builder.Property(m => m.MentionedUserId)
            .HasColumnName("mentioned_user_id")
            .IsRequired();

        builder.HasIndex(m => new { m.CommentId, m.MentionedUserId })
            .IsUnique()
            .HasDatabaseName("ux_comment_mentions_comment_id_mentioned_user_id");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(m => m.MentionedUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
