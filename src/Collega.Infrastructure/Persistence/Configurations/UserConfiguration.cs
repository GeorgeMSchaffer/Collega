using Collega.Domain.Organizations;
using Collega.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Collega.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(u => u.OrganizationId)
            .HasColumnName("organization_id");

        builder.Property(u => u.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.Email)
            .HasColumnName("email")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(u => u.NormalizedEmail)
            .HasColumnName("normalized_email")
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(u => u.PasswordHash)
            .HasColumnName("password_hash")
            .IsRequired();

        builder.Property(u => u.Role)
            .HasColumnName("role")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(u => u.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(u => u.MustChangePassword)
            .HasColumnName("must_change_password")
            .IsRequired();

        builder.Property(u => u.FailedLoginCount)
            .HasColumnName("failed_login_count")
            .IsRequired();

        builder.Property(u => u.LockoutWindowStartUtc)
            .HasColumnName("lockout_window_start_utc");

        builder.Property(u => u.LockedUntilUtc)
            .HasColumnName("locked_until_utc");

        builder.Property(u => u.TemporaryPasswordExpiresAtUtc)
            .HasColumnName("temporary_password_expires_at_utc");

        builder.Property(u => u.SecurityStamp)
            .HasColumnName("security_stamp")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(u => u.PortraitPng)
            .HasColumnName("portrait_png");

        builder.Property(u => u.CreatedAtUtc).HasColumnName("created_at_utc").IsRequired();
        builder.Property(u => u.UpdatedAtUtc).HasColumnName("updated_at_utc").IsRequired();
        builder.Property(u => u.CreatedByUserId).HasColumnName("created_by_user_id");
        builder.Property(u => u.UpdatedByUserId).HasColumnName("updated_by_user_id");

        builder.HasIndex(u => u.NormalizedEmail)
            .IsUnique()
            .HasDatabaseName("ux_users_normalized_email");

        builder.HasIndex(u => u.OrganizationId)
            .HasDatabaseName("ix_users_organization_id");

        // OrganizationId is null only for the global Site Admin, so this is deliberately not a
        // required/navigable relationship — no navigation property is exposed from either side to
        // keep User/Organization decoupled at the domain-model level.
        builder.HasOne<Organization>()
            .WithMany()
            .HasForeignKey(u => u.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
