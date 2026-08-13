using Collega.Application.Auth;
using Collega.Domain.Enums;

namespace Collega.Application.Impersonation;

public interface IViewAsService
{
    Task<ViewAsSessionResult> StartAsync(Guid targetUserId, CancellationToken cancellationToken = default);

    /// <summary>Idempotent — ending with no active session succeeds rather than erroring.</summary>
    Task EndAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ViewAsCandidate>> ListCandidatesAsync(string? search, CancellationToken cancellationToken = default);
}

/// <summary>
/// Response of starting a session. Carries both identities inline, per SPEC/30-Contracts.md → View
/// As: the caller can render the banner and the rail from this alone, and can confirm the server
/// still recognises the same real actor, without a follow-up GET /auth/me.
/// </summary>
public sealed record ViewAsSessionResult(
    CurrentUserSummary Impersonating,
    CurrentUserSummary RealUser,
    DateTime StartedAtUtc,
    DateTime ExpiresAtUtc);

/// <summary>
/// A row in the View As picker. <paramref name="Selectable"/> is false for users the picker shows
/// but may not be acted as — inactive accounts, or members of an archived organization. The server
/// refuses them on start regardless of this flag; it exists so the UI can grey them out rather than
/// hide them, which is what the locked comp shows.
/// </summary>
public sealed record ViewAsCandidate(
    Guid UserId,
    string FirstName,
    string LastName,
    string Email,
    Role Role,
    UserStatus Status,
    Guid OrganizationId,
    string OrganizationName,
    bool Selectable);
