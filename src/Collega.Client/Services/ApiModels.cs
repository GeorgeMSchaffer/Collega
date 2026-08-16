namespace Collega.Client.Services;

// Wire DTOs for the API's auth contracts (SPEC/30-Contracts.md). The WASM client cannot
// reference Collega.API/Application (layering), so it carries its own request/response shapes
// that mirror the JSON. JSON is matched case-insensitively by the ApiClient's serializer options.

public sealed record LoginRequestDto(string Email, string Password);

public sealed record ChangePasswordRequestDto(string CurrentPassword, string NewPassword);

public sealed record UpdateCurrentUserRequestDto(string FirstName, string LastName);

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
    string Status,
    string? PortraitDataUrl = null,
    ViewingAsDto? ViewingAs = null);

/// <summary>
/// Present on `GET /auth/me` only while a View As session is live. The banner is rendered from this
/// server-supplied value rather than from remembered client state, so a session that expired or was
/// ended elsewhere cannot leave a stale banner on screen.
/// </summary>
public sealed record ViewingAsDto(
    string RealUserId,
    string RealUserName,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);

/// <summary>A row in the View As picker (`GET /auth/view-as/candidates`).</summary>
public sealed record ViewAsCandidateDto(
    string UserId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    string OrganizationId,
    string OrganizationName,
    bool Selectable);

/// <summary>
/// Response of `POST /auth/view-as`. Carries both identities inline so the banner and rail can be
/// rendered without a follow-up call; MainLayout still re-reads /auth/me so that one server response
/// remains the single source of shell state, but the data is here if a consumer wants it.
/// </summary>
public sealed record StartViewAsResponseDto(
    UserSummaryDto Impersonating,
    UserSummaryDto RealUser,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);

/// <summary>Request body for `PUT /api/v1/auth/me/portrait` — Base64 of the raw chosen image file.</summary>
public sealed record UpdatePortraitRequestDto(string ImageBase64);

/// <summary>
/// AI consumption for one organization over a window (`GET .../ai-assist/usage`).
/// <c>EstimatedCost</c> is USD, computed server-side from the rates stored on each usage record.
/// </summary>
public sealed record AiUsageSummaryDto(
    string OrganizationId,
    string OrganizationName,
    int Calls,
    long InputTokens,
    long OutputTokens,
    long CacheReadInputTokens,
    long CacheCreationInputTokens,
    decimal EstimatedCost,
    long TotalTokens);

/// <summary>
/// The usage report. <c>DailyTokenLimit</c> and <c>TokensUsedToday</c> are populated only on the
/// platform-wide (Site Admin) report — the ceiling is platform-wide and is not an organization's
/// business, so the org-scoped response omits them.
/// </summary>
public sealed record AiUsageReportDto(
    DateTime FromUtc,
    DateTime ToUtc,
    List<AiUsageSummaryDto> Organizations,
    long? DailyTokenLimit,
    long? TokensUsedToday,
    int TotalCalls,
    long TotalTokens,
    decimal TotalEstimatedCost);

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

/// <summary>A row of <c>GET /organizations/{id}/members</c> — the minimal, non-admin assignable
/// member list used by the idea assignee picker.</summary>
public sealed record OrganizationMemberDto(
    string UserId,
    string FirstName,
    string LastName,
    string Email);

/// <summary>Response of <c>POST /organizations/{id}/invite-code/regenerate</c>.</summary>
public sealed record RegenerateInviteCodeResultDto(string InviteCode);

/// <summary>Detail for <c>GET /organizations/{id}</c>, used to prefill the edit form.</summary>
public sealed record OrganizationDetailDto(
    string OrganizationId,
    string Title,
    string Description,
    string InviteCode,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? Phone,
    string? PrimaryContactFirstName,
    string? PrimaryContactLastName,
    string? LogoThumbnailUrl = null,
    int? LogoHeightPx = null);

/// <summary>Body for <c>PUT /organizations/{id}/logo</c> — a client-resized image data URI + height.</summary>
public sealed record SetLogoRequestDto(string ThumbnailDataUri, int HeightPx);

/// <summary>Body for both <c>POST /organizations</c> and <c>PUT /organizations/{id}</c> (identical shapes).</summary>
public sealed record SaveOrganizationRequestDto(
    string Title,
    string Description,
    string? Address,
    string? City,
    string? State,
    string? Zip,
    string? Phone,
    string? PrimaryContactFirstName,
    string? PrimaryContactLastName);

/// <summary>Detail for <c>GET /users/{id}</c>, used to prefill the edit form.</summary>
public sealed record UserDetailDto(
    string UserId,
    string? OrganizationId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    bool MustChangePassword);

/// <summary>Body for <c>POST /organizations/{id}/users</c>.</summary>
public sealed record CreateUserRequestDto(
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string InitialPassword,
    string? Status);

/// <summary>Body for <c>PUT /users/{id}</c>.</summary>
public sealed record UpdateUserRequestDto(
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status);

/// <summary>Response of <c>POST /users/{id}/temporary-password</c>.</summary>
public sealed record TemporaryPasswordResultDto(string TemporaryPassword, bool MustChangePassword);

/// <summary>Body for <c>POST /auth/register</c> (invite-code self-registration).</summary>
public sealed record RegisterRequestDto(
    string InviteCode,
    string FirstName,
    string LastName,
    string Email,
    string Password);

/// <summary>Response of <c>POST /auth/register</c>.</summary>
public sealed record RegisterResultDto(string UserId, string OrganizationId, string Email, string Role, string Status);

/// <summary>Per-row outcome from <c>POST .../users/import</c>.</summary>
public sealed record UserImportRowResultDto(int RowNumber, string? Email, string Outcome, string? Error, string? TemporaryPassword);

/// <summary>Response of <c>POST .../users/import</c> (bulk CSV user import).</summary>
public sealed record UserImportResultDto(int CreatedCount, int RejectedCount, IReadOnlyList<UserImportRowResultDto> Rows);

/// <summary>A row of <c>GET /organizations/{id}/statuses</c> (plain array, not paged).</summary>
public sealed record StatusItemDto(
    string StatusId,
    string OrganizationId,
    string Name,
    string Color,
    int SortOrder,
    bool IsDeleted);

/// <summary>Body for both <c>POST .../statuses</c> and <c>PUT /statuses/{id}</c>. Color/SortOrder are optional.</summary>
public sealed record SaveStatusRequestDto(string Name, string? Color, int? SortOrder);

/// <summary>Body for <c>POST .../statuses/reorder</c> — the new catalog order by id (active statuses only).</summary>
public sealed record ReorderStatusesRequestDto(List<string> OrderedStatusIds);

/// <summary>Response of <c>POST .../statuses</c>.</summary>
public sealed record CreateStatusResultDto(string StatusId, string Name, string Color, int SortOrder);
