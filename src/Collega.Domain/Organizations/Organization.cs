using Collega.Domain.Common;

namespace Collega.Domain.Organizations;

/// <summary>
/// The top-level ownership boundary for all business data (SPEC/20-feature-organizations-and-users.md
/// "Organization Rules"). Created by Site Admin with only a Title and Description; a Logo Address is
/// optional. Owns invite-code regeneration and archive invariants. Binary logo upload
/// (<see cref="LogoThumbnailUrl"/>/<see cref="LogoHeightPx"/> population) and organization AI-key
/// management are separate follow-ups and are not built on this entity yet.
/// </summary>
public sealed class Organization : AuditableEntityBase
{
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 1000;
    public const int LogoUrlMaxLength = 500;

    /// <summary>Max length of the stored logo thumbnail data URI (~a small resized PNG in base64).</summary>
    public const int LogoThumbnailMaxLength = 300_000;

    /// <summary>The uploaded logo is rendered at most this tall.</summary>
    public const int LogoMaxHeightPx = 150;
    public const int AddressMaxLength = 200;
    public const int CityMaxLength = 100;
    public const int StateMaxLength = 50;
    public const int ZipMaxLength = 20;
    public const int PhoneMaxLength = 25;
    public const int ContactNameMaxLength = 100;

    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string InviteCode { get; private set; } = string.Empty;
    public bool IsArchived { get; private set; }

    /// <summary>Optional org-provided logo address (contract field <c>logoUrl</c>).</summary>
    public string? LogoUrl { get; private set; }

    /// <summary>System-managed after a binary logo upload; null until that feature lands.</summary>
    public string? LogoThumbnailUrl { get; private set; }

    /// <summary>System-managed rendered height, capped at 150px; null until a logo is uploaded.</summary>
    public int? LogoHeightPx { get; private set; }

    // Optional profile fields, editable after creation.
    public string? Address { get; private set; }
    public string? City { get; private set; }
    public string? State { get; private set; }
    public string? Zip { get; private set; }
    public string? Phone { get; private set; }
    public string? PrimaryContactFirstName { get; private set; }
    public string? PrimaryContactLastName { get; private set; }

    private Organization()
    {
    }

    public static Organization Create(
        string title,
        string description,
        string inviteCode,
        DateTime nowUtc,
        Guid? actorUserId = null,
        string? logoUrl = null,
        OrganizationProfile? profile = null)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description is required.", nameof(description));
        }

        if (string.IsNullOrWhiteSpace(inviteCode))
        {
            throw new ArgumentException("Invite code is required.", nameof(inviteCode));
        }

        var organization = new Organization
        {
            Title = title.Trim(),
            Description = description.Trim(),
            InviteCode = inviteCode.Trim(),
            LogoUrl = Normalize(logoUrl)
        };
        organization.ApplyProfile(profile);
        organization.MarkCreated(nowUtc, actorUserId);
        return organization;
    }

    /// <summary>
    /// Applies an edit to organization detail (org-and-users requirement #7). Invite code, archive
    /// state, and system-managed logo fields are changed only through their dedicated methods.
    /// </summary>
    public void Update(
        string title,
        string description,
        string? logoUrl,
        OrganizationProfile profile,
        DateTime nowUtc,
        Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            throw new ArgumentException("Description is required.", nameof(description));
        }

        Title = title.Trim();
        Description = description.Trim();
        LogoUrl = Normalize(logoUrl);
        ApplyProfile(profile);
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Stores an uploaded logo as a resized image data URI plus its rendered height (org-and-users
    /// binary-logo feature). The image is resized client-side to at most <see cref="LogoMaxHeightPx"/>;
    /// this validates the payload is an image data URI within the size cap and clamps the height.
    /// </summary>
    public void SetLogo(string thumbnailDataUri, int heightPx, DateTime nowUtc, Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(thumbnailDataUri))
        {
            throw new ArgumentException("A logo image is required.", nameof(thumbnailDataUri));
        }

        if (!thumbnailDataUri.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Logo must be an image.", nameof(thumbnailDataUri));
        }

        if (thumbnailDataUri.Length > LogoThumbnailMaxLength)
        {
            throw new ArgumentException("Logo image is too large.", nameof(thumbnailDataUri));
        }

        LogoThumbnailUrl = thumbnailDataUri;
        LogoHeightPx = Math.Clamp(heightPx, 1, LogoMaxHeightPx);
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Removes the uploaded logo. Idempotent.</summary>
    public void ClearLogo(DateTime nowUtc, Guid? actorUserId)
    {
        LogoThumbnailUrl = null;
        LogoHeightPx = null;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Regenerates the invite code, immediately invalidating the previous one (org-and-users
    /// requirement #6). Uniqueness across organizations is enforced by the caller against the store.
    /// </summary>
    public void RegenerateInviteCode(string newInviteCode, DateTime nowUtc, Guid? actorUserId)
    {
        if (string.IsNullOrWhiteSpace(newInviteCode))
        {
            throw new ArgumentException("Invite code is required.", nameof(newInviteCode));
        }

        InviteCode = newInviteCode.Trim();
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Archives without hard-deleting (org-and-users requirement #8). Idempotent.</summary>
    public void Archive(DateTime nowUtc, Guid? actorUserId)
    {
        if (IsArchived)
        {
            return;
        }

        IsArchived = true;
        MarkUpdated(nowUtc, actorUserId);
    }

    private void ApplyProfile(OrganizationProfile? profile)
    {
        if (profile is null)
        {
            return;
        }

        Address = Normalize(profile.Address);
        City = Normalize(profile.City);
        State = Normalize(profile.State);
        Zip = Normalize(profile.Zip);
        Phone = Normalize(profile.Phone);
        PrimaryContactFirstName = Normalize(profile.PrimaryContactFirstName);
        PrimaryContactLastName = Normalize(profile.PrimaryContactLastName);
    }

    private static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }
}

/// <summary>Optional, editable organization profile fields grouped for construction and update.</summary>
public sealed record OrganizationProfile(
    string? Address = null,
    string? City = null,
    string? State = null,
    string? Zip = null,
    string? Phone = null,
    string? PrimaryContactFirstName = null,
    string? PrimaryContactLastName = null);
