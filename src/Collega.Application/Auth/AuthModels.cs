using Collega.Domain.Enums;

namespace Collega.Application.Auth;

public sealed record LoginCommand(string Email, string Password);

public sealed record ChangePasswordCommand(string CurrentPassword, string NewPassword);

public sealed record UpdateProfileCommand(string FirstName, string LastName);

public sealed record RegisterCommand(string InviteCode, string FirstName, string LastName, string Email, string Password);

/// <summary>Shape matches `GET /api/v1/auth/me` (SPEC/30-Contracts.md) property-for-property.</summary>
public sealed record CurrentUserSummary(
    Guid UserId,
    Guid? OrganizationId,
    string Role,
    string FirstName,
    string LastName,
    string Email,
    string Status);

/// <summary>Shape matches the `POST /api/v1/auth/login` success response.</summary>
public sealed record LoginResult(
    string AccessToken,
    int ExpiresInSeconds,
    bool RequiresPasswordChange,
    CurrentUserSummary User);

/// <summary>Shape matches the `POST /api/v1/auth/register` success response.</summary>
public sealed record RegisterResult(Guid UserId, Guid OrganizationId, string Email, string Role, string Status);

/// <summary>Shape matches the `POST /api/v1/users/{userId}/temporary-password` success response.</summary>
public sealed record TemporaryPasswordResult(string TemporaryPassword, bool MustChangePassword);

/// <summary>
/// Resolved identity for a validated bearer token, built fresh from persisted state on every
/// request (see ITokenAuthenticationService) so a mid-session deactivation or role change takes
/// effect immediately rather than trusting stale token claims.
/// </summary>
public sealed record AuthenticatedPrincipal(
    Guid UserId,
    Guid? OrganizationId,
    Role Role,
    string FirstName,
    string LastName,
    string Email,
    UserStatus Status);
