using Collega.Application.Auth;
using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `POST /api/v1/auth/view-as` (SPEC/30-Contracts.md).</summary>
public sealed class StartViewAsRequest
{
    [RequiredField]
    // Nullable on purpose. RequiredAttribute only rejects null, so on a non-nullable Guid the
    // annotation was a no-op: a missing or empty id bound to Guid.Empty, passed validation, and came
    // back 404 from the repository instead of the 400 the contract specifies.
    public Guid? TargetUserId { get; set; }
}

/// <summary>
/// Matches SPEC/30-Contracts.md → View As: both identities inline so the caller does not need a
/// follow-up GET /auth/me to render the banner.
/// </summary>
public sealed record StartViewAsResponse(
    CurrentUserSummary Impersonating,
    CurrentUserSummary RealUser,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);

/// <summary>
/// A picker row. <c>Selectable</c> is false for users shown but not actionable — inactive accounts
/// and members of archived organizations. The server refuses them on start regardless of this flag.
/// </summary>
public sealed record ViewAsCandidateResponse(
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    Guid OrganizationId,
    string OrganizationName,
    bool Selectable);
