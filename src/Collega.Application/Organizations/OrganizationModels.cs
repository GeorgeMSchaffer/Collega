using Collega.Application.Common;

namespace Collega.Application.Organizations;

public sealed record OrganizationProfileFields(
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? Phone,
    string? PrimaryContactFirstName,
    string? PrimaryContactLastName);

public sealed record CreateOrganizationCommand(
    string Title,
    string Description,
    string? LogoUrl,
    OrganizationProfileFields Profile);

public sealed record UpdateOrganizationCommand(
    string Title,
    string Description,
    string? LogoUrl,
    OrganizationProfileFields Profile);

public sealed record OrganizationListQuery(
    int? Page,
    int? PageSize,
    string? Search,
    bool IncludeArchived,
    string? SortBy,
    string? SortDirection);

/// <summary>Shape matches a <c>GET /api/v1/organizations</c> paged item.</summary>
public sealed record OrganizationListItem(
    Guid OrganizationId,
    string Title,
    string Description,
    string InviteCode,
    string? City,
    string? State,
    string? Phone,
    string? LogoThumbnailUrl,
    bool IsArchived);

/// <summary>Shape matches <c>GET /api/v1/organizations/{id}</c>.</summary>
public sealed record OrganizationDetail(
    Guid OrganizationId,
    string Title,
    string Description,
    string InviteCode,
    string? LogoUrl,
    string? LogoThumbnailUrl,
    int? LogoHeightPx,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? Phone,
    string? PrimaryContactFirstName,
    string? PrimaryContactLastName,
    bool IsArchived,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

/// <summary>Shape matches the <c>POST /api/v1/organizations</c> success response.</summary>
public sealed record CreateOrganizationResult(
    Guid OrganizationId,
    string InviteCode,
    Guid DefaultBoardId,
    int DefaultStatusCount);

/// <summary>Shape matches the invite-code regenerate response.</summary>
public sealed record RegenerateInviteCodeResult(string InviteCode);

/// <summary>A resized logo (image data URI) and its rendered height, produced client-side.</summary>
public sealed record SetLogoCommand(string? ThumbnailDataUri, int HeightPx);
