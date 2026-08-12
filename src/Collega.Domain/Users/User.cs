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
    private const int MaxPortraitBytes = 64 * 1024;

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
    /// Optional square profile portrait, stored as a small pre-resized PNG thumbnail (≤25×25 px per
    /// the Bug-Triage requirement). Null when the user has no portrait, in which case callers fall
    /// back to the initials avatar. The domain never decodes or resizes image content — that (and
    /// the "reject anything that isn't a real GIF/JPEG/PNG" security check) happens in the
    /// Application/Infrastructure image pipeline before <see cref="SetPortrait"/> is called; the
    /// entity only guards the stored size so a malformed caller can't persist an oversized blob.
    /// </summary>
    public byte[]? PortraitPng { get; private set; }

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

    /// <summary>
    /// Self-service profile edit (auth requirement #20): first and last name only. Email, role,
    /// organization, and status are administrator-controlled and never change here.
    /// </summary>
    public void UpdateName(string firstName, string lastName, DateTime nowUtc, Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(firstName))
        {
            throw new ArgumentException("First name is required.", nameof(firstName));
        }

        if (string.IsNullOrWhiteSpace(lastName))
        {
            throw new ArgumentException("Last name is required.", nameof(lastName));
        }

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Stores a pre-validated, pre-resized PNG portrait thumbnail on the user record. The bytes must
    /// already be a decoded/re-encoded PNG no larger than 25×25 px produced by the image pipeline —
    /// this method only enforces a defensive upper bound on the stored size, not image validity.
    /// </summary>
    public void SetPortrait(byte[] portraitPng, DateTime nowUtc, Guid? actorUserId)
    {
        if (portraitPng is null || portraitPng.Length == 0)
        {
            throw new ArgumentException("Portrait content is required.", nameof(portraitPng));
        }

        // A 25×25 PNG is well under 4 KB; this cap is a safety net against a caller bypassing the
        // resize pipeline, not a functional limit.
        if (portraitPng.Length > MaxPortraitBytes)
        {
            throw new ArgumentException($"Portrait exceeds the maximum stored size of {MaxPortraitBytes} bytes.", nameof(portraitPng));
        }

        PortraitPng = portraitPng;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Clears the stored portrait so the initials avatar is shown again.</summary>
    public void RemovePortrait(DateTime nowUtc, Guid? actorUserId)
    {
        PortraitPng = null;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Administrator edit of a user's profile, role, and status (org-and-users "User Rules").
    /// A non-Site-Admin account can never be moved to the Site Admin role. Organization membership
    /// is immutable here — a non-Site-Admin user belongs to exactly one organization.
    /// </summary>
    public void Administer(
        string firstName,
        string lastName,
        string email,
        Role role,
        UserStatus status,
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

        if (OrganizationId is not null && role == Role.SiteAdmin)
        {
            throw new ArgumentException("Organization users cannot be assigned the Site Admin role.", nameof(role));
        }

        var trimmedEmail = email.Trim();

        FirstName = firstName.Trim();
        LastName = lastName.Trim();
        Email = trimmedEmail;
        NormalizedEmail = EmailNormalizer.Normalize(trimmedEmail);
        Role = role;
        Status = status;
        MarkUpdated(nowUtc, actorUserId);
    }

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

    /// <summary>
    /// Clears the failed-attempt/lockout counters after a successful authentication.
    /// </summary>
    /// <remarks>
    /// The temporary-password deadline survives here on purpose. Only a completed rotation
    /// (<see cref="ChangePassword"/>) retires it — clearing it on login instead would turn an
    /// unrotated admin-issued temporary password, one the issuing admin still knows, into a
    /// permanent credential, which is what auth requirement #13's expiry exists to prevent.
    /// </remarks>
    public void RegisterSuccessfulLogin(DateTime nowUtc)
    {
        FailedLoginCount = 0;
        LockoutWindowStartUtc = null;
        LockedUntilUtc = null;

        if (!MustChangePassword)
        {
            TemporaryPasswordExpiresAtUtc = null;
        }

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
