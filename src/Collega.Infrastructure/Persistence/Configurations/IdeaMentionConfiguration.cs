using Collega.Domain.Ideas;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaMentionConfiguration : IEntityTypeConfiguration<IdeaMention>
{
    public void Configure(EntityTypeBuilder<IdeaMention> builder)
    {
        builder.ToTable("idea_mentions");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(m => m.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(m => m.MentionedUserId)
            .HasColumnName("mentioned_user_id")
            .IsRequired();

        builder.HasIndex(m => new { m.IdeaId, m.MentionedUserId })
            .IsUnique()
            .HasDatabaseName("ux_idea_mentions_idea_id_mentioned_user_id");

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(m => m.MentionedUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
