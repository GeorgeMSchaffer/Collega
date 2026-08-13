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
    string Status,
    string? PortraitDataUrl = null,
    ViewingAsSummary? ViewingAs = null);

/// <summary>
/// Present on <c>GET /auth/me</c> only while a View As session is live. The client renders the
/// persistent banner from this rather than from remembered local state, so a session ended or
/// expired server-side cannot leave a stale banner on screen (SPEC/30-Contracts.md → View As).
/// </summary>
public sealed record ViewingAsSummary(
    Guid RealUserId,
    string RealUserName,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);

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
/// <param name="MustChangePassword">
/// Live persisted state, not a token claim, so a rotation completed in another tab lifts the
/// restriction on the next request. The API refuses all but a small allowlist of endpoints while
/// this is true (auth requirement #31); the client's own gate is a UX convenience on top of it.
/// </param>
/// <summary>
/// The identity a request acts under. While a View As session is active, every field here describes
/// the <b>impersonated</b> user — that is what makes existing org-scoping and role checks apply
/// unchanged (SPEC/20-feature-view-as.md rule 4) — and <see cref="Impersonation"/> carries the real
/// administrator alongside, for audit and for the banner.
/// </summary>
public sealed record AuthenticatedPrincipal(
    Guid UserId,
    Guid? OrganizationId,
    Role Role,
    string FirstName,
    string LastName,
    string Email,
    UserStatus Status,
    bool MustChangePassword,
    ImpersonationContext? Impersonation = null);

/// <summary>The real administrator behind an active View As session, and when it must end.</summary>
public sealed record ImpersonationContext(
    Guid RealUserId,
    string RealUserFirstName,
    string RealUserLastName,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);
