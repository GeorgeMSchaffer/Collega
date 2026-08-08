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
            .HasMaxLength(Organization.TitleMaxLength)
            .IsRequired();

        builder.Property(o => o.Description)
            .HasColumnName("description")
            .HasMaxLength(Organization.DescriptionMaxLength)
            .IsRequired();

        builder.Property(o => o.InviteCode)
            .HasColumnName("invite_code")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(o => o.IsArchived)
            .HasColumnName("is_archived")
            .IsRequired();

        builder.Property(o => o.LogoUrl)
            .HasColumnName("logo_url")
            .HasMaxLength(Organization.LogoUrlMaxLength);

        builder.Property(o => o.LogoThumbnailUrl)
            .HasColumnName("logo_thumbnail_url")
            .HasMaxLength(Organization.LogoUrlMaxLength);

        builder.Property(o => o.LogoHeightPx)
            .HasColumnName("logo_height_px");

        builder.Property(o => o.Address)
            .HasColumnName("address")
            .HasMaxLength(Organization.AddressMaxLength);

        builder.Property(o => o.City)
            .HasColumnName("city")
            .HasMaxLength(Organization.CityMaxLength);

        builder.Property(o => o.State)
            .HasColumnName("state")
            .HasMaxLength(Organization.StateMaxLength);

        builder.Property(o => o.Zip)
            .HasColumnName("zip")
            .HasMaxLength(Organization.ZipMaxLength);

        builder.Property(o => o.Phone)
            .HasColumnName("phone")
            .HasMaxLength(Organization.PhoneMaxLength);

        builder.Property(o => o.PrimaryContactFirstName)
            .HasColumnName("primary_contact_first_name")
            .HasMaxLength(Organization.ContactNameMaxLength);

        builder.Property(o => o.PrimaryContactLastName)
            .HasColumnName("primary_contact_last_name")
            .HasMaxLength(Organization.ContactNameMaxLength);

        builder.Property(o => o.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(o => o.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(o => o.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(o => o.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(o => o.InviteCode)
            .IsUnique()
            .HasDatabaseName("ux_organizations_invite_code");
    }
}
