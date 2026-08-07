using System.Security.Cryptography;
using Collega.Domain.Common;
using Collega.Domain.Enums;

namespace Collega.Domain.Users;

/// <summary>
/// Organization-scoped account (SPEC/20-feature-organizations-and-users.md "User Fields",
/// SPEC/20-feature-auth.md). <see cref="OrganizationId"/> is null only for the global Site Admin
/// (auth requirement #7). Owns the invariants for lockout (auth requirement #6) and admin-issued
/// temporary password expiry (auth requirement #13); login orchestration lives in
/// Collega.Application.
/// </summary>
public sealed class User : AuditableEntityBase
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan TemporaryPasswordValidity = TimeSpan.FromHours(24);

    public Guid? OrganizationId { get; private set; }
    public string FirstName { get; private set; } = string.Empty;
    public string LastName { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public Role Role { get; private set; }
    public UserStatus Status { get; private set; }
    public bool MustChangePassword { get; private set; }
    public int FailedLoginCount { get; private set; }
    public DateTime? LockoutWindowStartUtc { get; private set; }
    public DateTime? LockedUntilUtc { get; private set; }

    /// <summary>
    /// Set only while an admin-issued temporary password is outstanding and unused. Cleared on
    /// first successful login with it, or when the password is subsequently changed. Auth
    /// requirement #13: "expire after 24 hours [if unused]".
    /// </summary>
    public DateTime? TemporaryPasswordExpiresAtUtc { get; private set; }

    /// <summary>
    /// Server-side session-revocation stamp (SPEC/20-feature-auth.md #35-36, resolved 2026-08-07).
    /// Embedded in every issued JWT at issuance time; regenerated whenever all of this user's
    /// existing sessions must be invalidated (password change, admin-issued temporary password).
    /// A JWT whose embedded stamp no longer matches this value is rejected the same way an
    /// expired token is — see Collega.Application.Auth.TokenAuthenticationService.
    /// </summary>
    public string SecurityStamp { get; private set; } = string.Empty;

    private User()
    {
    }

    /// <summary>
    /// Seeds the single global platform account (auth requirement #7-9). Always forces a password
    /// change on first login.
    /// </summary>
    public static User CreateSiteAdmin(string firstName, string lastName, string email, string passwordHash, DateTime nowUtc) =>
        CreateInternal(null, firstName, lastName, email, passwordHash, Role.SiteAdmin, UserStatus.Active, mustChangePassword: true, nowUtc, actorUserId: null);

    public static User CreateOrganizationUser(
        Guid organizationId,
        string firstName,
        string lastName,
        string email,
        string passwordHash,
        Role role,
        UserStatus status,
        bool mustChangePassword,
        DateTime nowUtc,
        Guid? actorUserId = null)
    {
        if (role == Role.SiteAdmin)
        {
            throw new ArgumentException("Organization users cannot be assigned the Site Admin role.", nameof(role));
        }

        return CreateInternal(organizationId, firstName, lastName, email, passwordHash, role, status, mustChangePassword, nowUtc, actorUserId);
    }

    private static User CreateInternal(
        Guid? organizationId,
        string firstName,
        string lastName,
        string email,
        string passwordHash,
        Role role,
        UserStatus status,
        bool mustChangePassword,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException("First name is required.", nameof(firstName));
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException("Last name is required.", nameof(lastName));
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(passwordHash));
        }

        var trimmedEmail = email.Trim();

        var user = new User
        {
            OrganizationId = organizationId,
            FirstName = firstName.Trim(),
            LastName = lastName.Trim(),
            Email = trimmedEmail,
            NormalizedEmail = EmailNormalizer.Normalize(trimmedEmail),
            PasswordHash = passwordHash,
            Role = role,
            Status = status,
            MustChangePassword = mustChangePassword,
            SecurityStamp = GenerateSecurityStamp()
        };
        user.MarkCreated(nowUtc, actorUserId);
        return user;
    }

    private static string GenerateSecurityStamp() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

    public bool IsLockedOut(DateTime nowUtc) => LockedUntilUtc.HasValue && LockedUntilUtc.Value > nowUtc;

    public bool IsTemporaryPasswordExpired(DateTime nowUtc) =>
        TemporaryPasswordExpiresAtUtc.HasValue && TemporaryPasswordExpiresAtUtc.Value <= nowUtc;

    /// <summary>
    /// Auth requirement #6: five failed attempts inside a rolling 15-minute window trigger a
    /// 15-minute lockout. Implemented as a window that resets when a failed attempt lands more
    /// than 15 minutes after the previous window started (a fixed-window approximation of a true
    /// sliding window — see Open Items in the implementation tracker).
    /// </summary>
    public void RegisterFailedLoginAttempt(DateTime nowUtc)
    {
        if (LockoutWindowStartUtc is null || nowUtc - LockoutWindowStartUtc.Value > LockoutWindow)
        {
            LockoutWindowStartUtc = nowUtc;
            FailedLoginCount = 1;
        }
        else
        {
            FailedLoginCount++;
        }

        if (FailedLoginCount >= MaxFailedAttempts)
        {
            LockedUntilUtc = nowUtc.Add(LockoutDuration);
        }

        MarkUpdated(nowUtc, null);
    }

    public void RegisterSuccessfulLogin(DateTime nowUtc)
    {
        FailedLoginCount = 0;
        LockoutWindowStartUtc = null;
        LockedUntilUtc = null;
        TemporaryPasswordExpiresAtUtc = null;

        MarkUpdated(nowUtc, Id);
    }

    /// <summary>
    /// Voluntary or forced (first-login) password change. Clears <see cref="MustChangePassword"/>
    /// per auth requirement #31.
    /// </summary>
    public void ChangePassword(string newPasswordHash, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(newPasswordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(newPasswordHash));
        }

        PasswordHash = newPasswordHash;
        MustChangePassword = false;
        TemporaryPasswordExpiresAtUtc = null;
        SecurityStamp = GenerateSecurityStamp();
        MarkUpdated(nowUtc, Id);
    }

    /// <summary>
    /// Admin-issued temporary password (auth requirements #12-13). Forces a change on next login
    /// and starts the 24-hour unused-expiry window. Also clears any active lockout so the new
    /// credential is immediately usable.
    /// </summary>
    public void IssueTemporaryPassword(string temporaryPasswordHash, DateTime nowUtc, Guid actorUserId)
    {
        if (string.IsNullOrWhiteSpace(temporaryPasswordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(temporaryPasswordHash));
        }

        PasswordHash = temporaryPasswordHash;
        MustChangePassword = true;
        TemporaryPasswordExpiresAtUtc = nowUtc.Add(TemporaryPasswordValidity);
        FailedLoginCount = 0;
        LockoutWindowStartUtc = null;
        LockedUntilUtc = null;
        SecurityStamp = GenerateSecurityStamp();

        MarkUpdated(nowUtc, actorUserId);
    }
}
