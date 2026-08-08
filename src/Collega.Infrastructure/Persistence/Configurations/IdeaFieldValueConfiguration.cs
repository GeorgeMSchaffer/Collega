using Collega.Domain.Fields;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaFieldValueConfiguration : IEntityTypeConfiguration<IdeaFieldValue>
{
    public void Configure(EntityTypeBuilder<IdeaFieldValue> builder)
    {
        builder.ToTable("idea_field_values");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(v => v.IdeaId)
            .HasColumnName("idea_id")
            .IsRequired();

        builder.Property(v => v.FieldDefinitionId)
            .HasColumnName("field_definition_id")
            .IsRequired();

        builder.Property(v => v.Value)
            .HasColumnName("value")
            .HasMaxLength(IdeaFieldValue.ValueMaxLength);

        builder.Property(v => v.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(v => v.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(v => v.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(v => v.UpdatedByUserId).HasColumnName("updated_by_user_id");

        // At most one value row per (idea, field definition).
        builder.HasIndex(v => new { v.IdeaId, v.FieldDefinitionId })
            .IsUnique()
            .HasDatabaseName("ux_idea_field_values_idea_id_field_definition_id");

        // Supports filter/search on a field's values. `value` is an included column, not a key column,
        // because NVARCHAR(4000) exceeds SQL Server's index-key size limit (the spec's composite-key
        // form is not creatable as written).
        builder.HasIndex(v => v.FieldDefinitionId)
            .IncludeProperties(v => v.Value)
            .HasDatabaseName("ix_idea_field_values_field_definition_id");

        builder.HasOne<FieldDefinition>()
            .WithMany()
            .HasForeignKey(v => v.FieldDefinitionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
