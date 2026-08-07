using Collega.Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.ToTable("organizations");

        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(o => o.Title)
            .HasColumnName("title")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(o => o.InviteCode)
            .HasColumnName("invite_code")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(o => o.IsArchived)
            .HasColumnName("is_archived")
            .IsRequired();

        builder.Property(o => o.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(o => o.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(o => o.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(o => o.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(o => o.InviteCode)
            .IsUnique()
            .HasDatabaseName("ux_organizations_invite_code");
    }
}
