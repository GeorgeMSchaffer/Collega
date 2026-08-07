using Collega.Application.Abstractions;
using Collega.Domain.Enums;

namespace Collega.Application.Auth;

public sealed class TokenAuthenticationService : ITokenAuthenticationService
{
    private readonly IAccessTokenValidator _tokenValidator;
    private readonly IUserRepository _userRepository;
    private readonly IClock _clock;

    public TokenAuthenticationService(IAccessTokenValidator tokenValidator, IUserRepository userRepository, IClock clock)
    {
        _tokenValidator = tokenValidator;
        _userRepository = userRepository;
        _clock = clock;
    }

    public async Task<AuthenticatedPrincipal?> AuthenticateAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token) || !_tokenValidator.TryValidate(token, _clock.UtcNow, out var userId, out var securityStamp))
        {
            return null;
        }

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken);

        // Re-checked against live state on every request (not cached in the token) so a
        // deactivation mid-session takes effect immediately (auth requirement #15 for tokens too,
        // not just fresh logins).
        if (user is null || user.Status != UserStatus.Active)
        {
            return null;
        }

        // SPEC/20-feature-auth.md #35-36: a token whose embedded SecurityStamp no longer matches
        // the user's current value was issued before the most recent password
        // change/administrative reset and is treated as invalid, exactly like an expired token.
        if (!string.Equals(user.SecurityStamp, securityStamp, StringComparison.Ordinal))
        {
            return null;
        }

        return new AuthenticatedPrincipal(user.Id, user.OrganizationId, user.Role, user.FirstName, user.LastName, user.Email, user.Status);
    }
}
