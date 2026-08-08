namespace Collega.Client.Services;

// Wire DTOs for the API's auth contracts (SPEC/30-Contracts.md). The WASM client cannot
// reference Collega.API/Application (layering), so it carries its own request/response shapes
// that mirror the JSON. JSON is matched case-insensitively by the ApiClient's serializer options.

public sealed record LoginRequestDto(string Email, string Password);

public sealed record ChangePasswordRequestDto(string CurrentPassword, string NewPassword);

/// <summary>Response body of <c>POST /auth/login</c>.</summary>
public sealed record LoginResponseDto(
    string AccessToken,
    int ExpiresInSeconds,
    bool RequiresPasswordChange,
    UserSummaryDto User);

/// <summary>The authenticated user projection returned by login and <c>GET /auth/me</c>.</summary>
public sealed record UserSummaryDto(
    string UserId,
    string? OrganizationId,
    string Role,
    string FirstName,
    string LastName,
    string Email,
    string Status);

/// <summary>RFC 7807 problem-details envelope the API returns for every non-2xx response.</summary>
public sealed record ProblemDetailsDto(string? Title, int? Status, string? Detail);

/// <summary>Canonical paged-collection envelope (SPEC/30-Contracts.md "Shared Data Rules").</summary>
public sealed record PagedResultDto<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    string? SortBy,
    string? SortDirection);

/// <summary>A row of <c>GET /organizations</c> (Site Admin org list).</summary>
public sealed record OrganizationListItemDto(
    string OrganizationId,
    string Title,
    string Description,
    string InviteCode,
    string? City,
    string? State,
    string? Phone,
    string? LogoThumbnailUrl,
    bool IsArchived);

/// <summary>A row of <c>GET /organizations/{id}/users</c> (org-scoped user list).</summary>
public sealed record UserListItemDto(
    string UserId,
    string? OrganizationId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status);
