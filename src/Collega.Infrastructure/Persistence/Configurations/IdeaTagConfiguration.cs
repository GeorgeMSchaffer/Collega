using Collega.Domain.Ideas;
using Collega.Domain.Tags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaTagConfiguration : IEntityTypeConfiguration<IdeaTag>
{
    public void Configure(EntityTypeBuilder<IdeaTag> builder)
    {
        builder.ToTable("idea_tags");

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(t => t.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(t => t.TagId)
            .HasColumnName("tag_id")
            .IsRequired();

        builder.HasIndex(t => new { t.IdeaId, t.TagId })
            .IsUnique()
            .HasDatabaseName("ux_idea_tags_idea_id_tag_id");

        builder.HasOne<Tag>()
            .WithMany()
            .HasForeignKey(t => t.TagId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
