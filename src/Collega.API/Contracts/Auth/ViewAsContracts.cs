using Collega.API.Validation;

namespace Collega.API.Contracts.Auth;

/// <summary>Request shape for `POST /api/v1/auth/view-as` (SPEC/30-Contracts.md).</summary>
public sealed class StartViewAsRequest
{
    [RequiredField]
    public Guid TargetUserId { get; set; }
}

public sealed record StartViewAsResponse(Guid TargetUserId, DateTime StartedAtUtc, DateTime ExpiresAtUtc);

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
