using Collega.Domain.Fields;
using Collega.Domain.IdeaFields;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class IdeaTypeFieldConfiguration : IEntityTypeConfiguration<IdeaTypeField>
{
    public void Configure(EntityTypeBuilder<IdeaTypeField> builder)
    {
        builder.ToTable("idea_type_fields");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(f => f.IdeaTypeId).HasColumnName("idea_type_id").IsRequired();
        builder.Property(f => f.FieldDefinitionId).HasColumnName("field_definition_id").IsRequired();
        builder.Property(f => f.DisplayOrder).HasColumnName("display_order").IsRequired();
        builder.Property(f => f.IsRequired).HasColumnName("is_required").IsRequired();

        // A field appears at most once per type.
        builder.HasIndex(f => new { f.IdeaTypeId, f.FieldDefinitionId })
            .IsUnique()
            .HasDatabaseName("ux_idea_type_fields_idea_type_id_field_definition_id");

        // FK to idea_types is configured from the owning IdeaType side (cascade). Restrict on the field
        // definition so a referenced definition can't be hard-deleted out from under a link.
        builder.HasOne<FieldDefinition>()
            .WithMany()
            .HasForeignKey(f => f.FieldDefinitionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
