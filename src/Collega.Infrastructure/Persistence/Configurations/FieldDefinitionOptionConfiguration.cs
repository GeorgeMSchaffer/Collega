using Collega.Domain.Fields;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class FieldDefinitionOptionConfiguration : IEntityTypeConfiguration<FieldDefinitionOption>
{
    public void Configure(EntityTypeBuilder<FieldDefinitionOption> builder)
    {
        builder.ToTable("field_definition_options");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(o => o.FieldDefinitionId)
            .HasColumnName("field_definition_id")
            .IsRequired();

        builder.Property(o => o.Label)
            .HasColumnName("label")
            .HasMaxLength(FieldDefinitionOption.LabelMaxLength)
            .IsRequired();

        builder.Property(o => o.DisplayOrder)
            .HasColumnName("display_order")
            .IsRequired();

        builder.HasIndex(o => new { o.FieldDefinitionId, o.DisplayOrder })
            .HasDatabaseName("ix_field_definition_options_field_definition_id_display_order");
    }
}
