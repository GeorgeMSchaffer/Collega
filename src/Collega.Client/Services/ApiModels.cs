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
