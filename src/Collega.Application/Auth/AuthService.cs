using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Auth;

public sealed class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAccessTokenIssuer _tokenIssuer;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public AuthService(
        IUserRepository userRepository,
        IOrganizationRepository organizationRepository,
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IAccessTokenIssuer tokenIssuer,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _userRepository = userRepository;
        _organizationRepository = organizationRepository;
        _unitOfWork = unitOfWork;
        _passwordHasher = passwordHasher;
        _tokenIssuer = tokenIssuer;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<LoginResult> LoginAsync(LoginCommand command, CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;
        var normalizedEmail = EmailNormalizer.Normalize(command.Email ?? string.Empty);
        var user = await _userRepository.GetByNormalizedEmailAsync(normalizedEmail, cancellationToken);

        if (user is null)
        {
            await AuditAsync("AuthLoginFailed", null, null, null, "Login failed: no account found for the provided email.", now, new { email = normalizedEmail }, cancellationToken);
            throw new UnauthorizedAppException("Invalid email or password.");
        }

        // Inactive accounts are denied outright (auth requirement #15), ahead of lockout/password
        // checks, so a deactivated account never leaks lockout state or accepts a correct password.
        if (user.Status != UserStatus.Active)
        {
            await AuditAsync("AuthLoginFailed", user.OrganizationId, user.Id, null, "Login failed: account is inactive.", now, new { reason = "Inactive" }, cancellationToken);
            throw new ForbiddenAppException("This account is inactive.");
        }

        if (user.IsLockedOut(now))
        {
            await AuditAsync("AuthLoginFailed", user.OrganizationId, user.Id, null, "Login failed: account is locked out.", now, new { reason = "LockedOut" }, cancellationToken);
            throw new LockedOutAppException("This account is locked due to too many failed login attempts. Try again in 15 minutes.");
        }

        // An admin-issued temporary password that has expired unused (auth requirement #13) is
        // treated as an invalid credential even if the hash still matches.
        var credentialIsUsable = !user.IsTemporaryPasswordExpired(now);
        var passwordMatches = credentialIsUsable && _passwordHasher.Verify(command.Password ?? string.Empty, user.PasswordHash);

        if (!passwordMatches)
        {
            user.RegisterFailedLoginAttempt(now);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            if (user.IsLockedOut(now))
            {
                await AuditAsync("AuthLoginFailed", user.OrganizationId, user.Id, null, "Login failed: incorrect password (account now locked out).", now, new { reason = "LockedOut" }, cancellationToken);
                throw new LockedOutAppException("This account is locked due to too many failed login attempts. Try again in 15 minutes.");
            }

            await AuditAsync("AuthLoginFailed", user.OrganizationId, user.Id, null, "Login failed: incorrect password.", now, new { reason = "InvalidPassword" }, cancellationToken);
            throw new UnauthorizedAppException("Invalid email or password.");
        }

        user.RegisterSuccessfulLogin(now);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var token = _tokenIssuer.Issue(user.Id, user.SecurityStamp, now);

        await AuditAsync("AuthLoginSucceeded", user.OrganizationId, user.Id, user.Id, "Login succeeded.", now, null, cancellationToken);

        return new LoginResult(token.Token, token.ExpiresInSeconds, user.MustChangePassword, ToSummary(user));
    }

    public async Task<CurrentUserSummary> GetCurrentUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new UnauthorizedAppException("Caller identity could not be resolved.");

        return ToSummary(user);
    }

    public async Task<CurrentUserSummary> UpdateProfileAsync(Guid userId, UpdateProfileCommand command, CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new UnauthorizedAppException("Caller identity could not be resolved.");

        // Names are validated for shape at the API boundary; the entity trims and enforces non-empty.
        user.UpdateName(command.FirstName, command.LastName, now, user.Id);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("UserProfileUpdated", user.OrganizationId, user.Id, user.Id, "User updated their profile name.", now, null, cancellationToken);

        return ToSummary(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordCommand command, CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;
        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new UnauthorizedAppException("Caller identity could not be resolved.");

        if (!_passwordHasher.Verify(command.CurrentPassword ?? string.Empty, user.PasswordHash))
        {
            await AuditAsync("AuthPasswordChangeFailed", user.OrganizationId, user.Id, user.Id, "Password change failed: current password is incorrect.", now, null, cancellationToken);
            throw new UnauthorizedAppException("Current password is incorrect.");
        }

        var errors = PasswordPolicy.Validate(command.NewPassword);
        if (errors.Count > 0)
        {
            throw new ValidationAppException("newPassword", errors);
        }

        var newHash = _passwordHasher.Hash(command.NewPassword);
        user.ChangePassword(newHash, now);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("AuthPasswordChanged", user.OrganizationId, user.Id, user.Id, "Password changed successfully.", now, null, cancellationToken);
    }

    public async Task<RegisterResult> RegisterAsync(RegisterCommand command, CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;
        var inviteCode = (command.InviteCode ?? string.Empty).Trim();

        if (string.IsNullOrWhiteSpace(inviteCode))
        {
            throw new ValidationAppException("inviteCode", new[] { "Invite code is required." });
        }

        var organization = await _organizationRepository.GetByInviteCodeAsync(inviteCode, cancellationToken);

        // Archived organizations' invite codes are invalid (org-and-users requirement #9); surfaced
        // identically to "unknown code" so the API doesn't leak archive state to an anonymous caller.
        if (organization is null || organization.IsArchived)
        {
            throw new ValidationAppException("inviteCode", new[] { "Invite code is invalid. Please provide a valid organization invite code." });
        }

        var email = command.Email ?? string.Empty;
        var normalizedEmail = EmailNormalizer.Normalize(email);
        if (await _userRepository.ExistsByNormalizedEmailAsync(normalizedEmail, cancellationToken))
        {
            throw new ConflictAppException("Email is already in use.");
        }

        var passwordErrors = PasswordPolicy.Validate(command.Password);
        if (passwordErrors.Count > 0)
        {
            throw new ValidationAppException("password", passwordErrors);
        }

        var passwordHash = _passwordHasher.Hash(command.Password);

        // Self-registered users always get role User / status Active (auth requirement #17,
        // org-and-users requirement #4) and are not forced to change their own chosen password.
        var user = User.CreateOrganizationUser(
            organization.Id,
            command.FirstName,
            command.LastName,
            email,
            passwordHash,
            Role.User,
            UserStatus.Active,
            mustChangePassword: false,
            now);

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("UserSelfRegistered", organization.Id, user.Id, user.Id, "User self-registered using an organization invite code.", now, null, cancellationToken);

        return new RegisterResult(user.Id, organization.Id, user.Email, user.Role.ToString(), user.Status.ToString());
    }

    public async Task<TemporaryPasswordResult> IssueTemporaryPasswordAsync(Guid targetUserId, CancellationToken cancellationToken = default)
    {
        var now = _clock.UtcNow;

        if (!_currentUser.IsAuthenticated || _currentUser.UserId is null || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        var targetUser = await _userRepository.GetByIdAsync(targetUserId, cancellationToken)
            ?? throw new NotFoundAppException("User not found.");

        var isSiteAdmin = _currentUser.Role == Role.SiteAdmin;
        var isOrgAdminForTarget = _currentUser.Role == Role.OrgAdmin
            && _currentUser.OrganizationId.HasValue
            && targetUser.OrganizationId.HasValue
            && _currentUser.OrganizationId.Value == targetUser.OrganizationId.Value;

        if (!isSiteAdmin && !isOrgAdminForTarget)
        {
            throw new ForbiddenAppException("You are not allowed to issue a temporary password for this user.");
        }

        var temporaryPassword = TemporaryPasswordGenerator.Generate();
        var passwordHash = _passwordHasher.Hash(temporaryPassword);
        targetUser.IssueTemporaryPassword(passwordHash, now, _currentUser.UserId.Value);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync(
            "AuthTemporaryPasswordIssued",
            targetUser.OrganizationId,
            targetUser.Id,
            _currentUser.UserId,
            "An administrator issued a temporary password for this account.",
            now,
            null,
            cancellationToken);

        // Plaintext value is returned exactly once and is never persisted or logged (auth
        // requirement #30's no-plaintext-persistence rule applies here by the same principle even
        // though #30 is written against the post-MVP self-service reset token).
        return new TemporaryPasswordResult(temporaryPassword, true);
    }

    private static CurrentUserSummary ToSummary(User user) => new(
        user.Id,
        user.OrganizationId,
        user.Role.ToString(),
        user.FirstName,
        user.LastName,
        user.Email,
        user.Status.ToString());

    private async Task AuditAsync(
        string eventType,
        Guid? organizationId,
        Guid? entityId,
        Guid? actorUserId,
        string message,
        DateTime nowUtc,
        object? metadata,
        CancellationToken cancellationToken)
    {
        var metadataJson = metadata is null ? null : JsonSerializer.Serialize(metadata);
        var auditEvent = AuditEvent.Create(eventType, "User", message, nowUtc, organizationId, actorUserId, entityId, metadataJson);
        await _auditEventWriter.WriteAsync(auditEvent, cancellationToken);
    }
}
