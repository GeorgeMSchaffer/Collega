namespace Collega.Application.Auth;

/// <summary>
/// Orchestrates the Auth slice use cases (SPEC/20-feature-auth.md, T005-T011). Authorization for
/// <see cref="IssueTemporaryPasswordAsync"/> and identity resolution for the "self" endpoints are
/// resolved from the injected <see cref="Collega.Application.Abstractions.ICurrentUserContext"/>,
/// not passed in by the caller — see AuthService.
/// </summary>
public interface IAuthService
{
    Task<LoginResult> LoginAsync(LoginCommand command, CancellationToken cancellationToken = default);

    Task<CurrentUserSummary> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Self-service update of the caller's own first/last name (auth requirement #20).</summary>
    Task<CurrentUserSummary> UpdateProfileAsync(Guid userId, UpdateProfileCommand command, CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates raw uploaded image bytes through the image pipeline (reject non-images / disguised
    /// content), resizes to the ≤25×25 portrait thumbnail, and stores it on the caller's record.
    /// </summary>
    Task<CurrentUserSummary> UpdatePortraitAsync(Guid userId, byte[] imageBytes, CancellationToken cancellationToken = default);

    /// <summary>Clears the caller's stored portrait so the initials avatar is shown again.</summary>
    Task<CurrentUserSummary> RemovePortraitAsync(Guid userId, CancellationToken cancellationToken = default);

    Task ChangePasswordAsync(Guid userId, ChangePasswordCommand command, CancellationToken cancellationToken = default);

    Task<RegisterResult> RegisterAsync(RegisterCommand command, CancellationToken cancellationToken = default);

    Task<TemporaryPasswordResult> IssueTemporaryPasswordAsync(Guid targetUserId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Validates a bearer token and resolves the live <see cref="AuthenticatedPrincipal"/> behind it.
/// Used exclusively by Collega.API's authentication handler to build the request's ClaimsPrincipal
/// — deliberately independent of ICurrentUserContext, which doesn't exist yet at that point in the
/// pipeline.
/// </summary>
public interface ITokenAuthenticationService
{
    Task<AuthenticatedPrincipal?> AuthenticateAsync(string token, CancellationToken cancellationToken = default);
}
