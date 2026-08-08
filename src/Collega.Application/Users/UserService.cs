using System.Text.Json;
using Collega.Application.Abstractions;
using Collega.Application.Common;
using Collega.Application.Exceptions;
using Collega.Domain.Auditing;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Users;

/// <summary>
/// User administration use cases (SPEC/20-feature-organizations-and-users.md "User Rules",
/// SPEC/30-Contracts.md "User Contracts"). Enforces organization scoping, one-org/one-role
/// (requirement #3-4), globally unique email (#6), Active/Inactive-only states (#10), and the
/// last-Org-Admin safeguard (#8).
/// </summary>
public sealed class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditEventWriter _auditEventWriter;
    private readonly ICurrentUserContext _currentUser;
    private readonly IClock _clock;

    public UserService(
        IUserRepository userRepository,
        IOrganizationRepository organizationRepository,
        IPasswordHasher passwordHasher,
        IUnitOfWork unitOfWork,
        IAuditEventWriter auditEventWriter,
        ICurrentUserContext currentUser,
        IClock clock)
    {
        _userRepository = userRepository;
        _organizationRepository = organizationRepository;
        _passwordHasher = passwordHasher;
        _unitOfWork = unitOfWork;
        _auditEventWriter = auditEventWriter;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PagedResult<UserListItem>> ListByOrganizationAsync(Guid organizationId, UserListQuery query, CancellationToken cancellationToken = default)
    {
        await AuthorizeOrganizationScopeAsync(organizationId, cancellationToken);

        var filter = new UserListFilter(
            organizationId,
            new PageRequest(query.Page, query.PageSize),
            query.Search?.Trim(),
            ParseOptionalRole(query.Role),
            ParseOptionalStatus(query.Status),
            query.SortBy,
            query.SortDirection);

        var page = await _userRepository.ListByOrganizationAsync(filter, cancellationToken);
        var items = page.Items.Select(ToListItem).ToList();
        return new PagedResult<UserListItem>(items, page.Page, page.PageSize, page.TotalCount, page.SortBy, page.SortDirection);
    }

    public async Task<CreateUserResult> CreateAsync(Guid organizationId, CreateUserCommand command, CancellationToken cancellationToken = default)
    {
        await AuthorizeOrganizationScopeAsync(organizationId, cancellationToken);

        var now = _clock.UtcNow;
        var role = ParseAssignableRole(command.Role);
        var status = ParseStatus(command.Status, defaultStatus: UserStatus.Active) ?? UserStatus.Active;

        var email = command.Email ?? string.Empty;
        var normalizedEmail = EmailNormalizer.Normalize(email);
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new ValidationAppException("email", new[] { "Email is required." });
        }

        if (await _userRepository.ExistsByNormalizedEmailAsync(normalizedEmail, cancellationToken))
        {
            throw new ConflictAppException("Email is already in use.");
        }

        var passwordErrors = PasswordPolicy.Validate(command.InitialPassword);
        if (passwordErrors.Count > 0)
        {
            throw new ValidationAppException("initialPassword", passwordErrors);
        }

        var passwordHash = _passwordHasher.Hash(command.InitialPassword);

        // An admin-provided initial credential forces a change on first login (auth requirement #31).
        var user = User.CreateOrganizationUser(
            organizationId,
            command.FirstName,
            command.LastName,
            email,
            passwordHash,
            role,
            status,
            mustChangePassword: true,
            now,
            _currentUser.UserId);

        await _userRepository.AddAsync(user, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync("UserCreated", organizationId, user.Id, _currentUser.UserId, $"User '{user.Email}' created with role {role}.", now, new { user.Email, Role = role.ToString(), Status = status.ToString() }, cancellationToken);

        return new CreateUserResult(user.Id, organizationId, user.Email, user.Role.ToString(), user.Status.ToString());
    }

    public async Task<UserDetail> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var user = await LoadInScopeAsync(userId, cancellationToken);
        return ToDetail(user);
    }

    public async Task<UserDetail> UpdateAsync(Guid userId, UpdateUserCommand command, CancellationToken cancellationToken = default)
    {
        var user = await LoadInScopeAsync(userId, cancellationToken);
        var now = _clock.UtcNow;

        var newRole = ParseAssignableRole(command.Role);
        var newStatus = ParseStatus(command.Status, defaultStatus: null)
            ?? throw new ValidationAppException("status", AllowedStatusMessage());

        // Email uniqueness is enforced only when the address actually changes (requirement #6).
        var newEmail = command.Email ?? string.Empty;
        var newNormalizedEmail = EmailNormalizer.Normalize(newEmail);
        if (string.IsNullOrWhiteSpace(newNormalizedEmail))
        {
            throw new ValidationAppException("email", new[] { "Email is required." });
        }

        if (!string.Equals(newNormalizedEmail, user.NormalizedEmail, StringComparison.Ordinal)
            && await _userRepository.ExistsByNormalizedEmailAsync(newNormalizedEmail, cancellationToken))
        {
            throw new ConflictAppException("Email is already in use.");
        }

        await EnforceLastOrgAdminSafeguardAsync(user, newRole, newStatus, cancellationToken);

        var previousRole = user.Role;
        var previousStatus = user.Status;

        user.Administer(command.FirstName, command.LastName, newEmail, newRole, newStatus, now, _currentUser.UserId);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        await AuditAsync(
            "UserUpdated",
            user.OrganizationId,
            user.Id,
            _currentUser.UserId,
            $"User '{user.Email}' updated.",
            now,
            new
            {
                RoleChanged = previousRole != newRole,
                StatusChanged = previousStatus != newStatus,
                Role = newRole.ToString(),
                Status = newStatus.ToString()
            },
            cancellationToken);

        return ToDetail(user);
    }

    /// <summary>
    /// Requirement #8: the last Org Admin cannot remove their own admin role or deactivate
    /// themselves. Scoped to self-action — a Site Admin may still change the last Org Admin.
    /// </summary>
    private async Task EnforceLastOrgAdminSafeguardAsync(User target, Role newRole, UserStatus newStatus, CancellationToken cancellationToken)
    {
        var actingOnSelf = _currentUser.UserId == target.Id;
        if (!actingOnSelf || target.Role != Role.OrgAdmin || target.OrganizationId is null)
        {
            return;
        }

        var losingAdmin = newRole != Role.OrgAdmin;
        var deactivating = newStatus != UserStatus.Active;
        if (!losingAdmin && !deactivating)
        {
            return;
        }

        var otherActiveAdmins = await _userRepository.CountActiveOrgAdminsAsync(target.OrganizationId.Value, target.Id, cancellationToken);
        if (otherActiveAdmins > 0)
        {
            return;
        }

        if (losingAdmin)
        {
            throw new ValidationAppException("role", new[] { "You cannot remove your own Org Admin role because you are the last Org Admin in this organization." });
        }

        throw new ValidationAppException("status", new[] { "You cannot deactivate yourself because you are the last Org Admin in this organization." });
    }

    /// <summary>Verifies the caller may administer users in the target organization; 404 if it does not exist.</summary>
    private async Task AuthorizeOrganizationScopeAsync(Guid organizationId, CancellationToken cancellationToken)
    {
        var role = RequireAuthenticatedRole();

        if (role == Role.SiteAdmin)
        {
            var organization = await _organizationRepository.GetByIdAsync(organizationId, cancellationToken)
                ?? throw new NotFoundAppException("Organization not found.");
            _ = organization;
            return;
        }

        if (role == Role.OrgAdmin && _currentUser.OrganizationId == organizationId)
        {
            return;
        }

        if (role == Role.OrgAdmin)
        {
            // An Org Admin targeting another org is told the org does not exist in their scope.
            throw new NotFoundAppException("Organization not found.");
        }

        throw new ForbiddenAppException("You are not allowed to manage users in this organization.");
    }

    /// <summary>Loads a user the caller may view/administer, or 404 if it is outside their scope.</summary>
    private async Task<User> LoadInScopeAsync(Guid userId, CancellationToken cancellationToken)
    {
        var role = RequireAuthenticatedRole();

        var user = await _userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundAppException("User not found.");

        if (role == Role.SiteAdmin)
        {
            return user;
        }

        if (role == Role.OrgAdmin && user.OrganizationId is not null && user.OrganizationId == _currentUser.OrganizationId)
        {
            return user;
        }

        if (role == Role.OrgAdmin)
        {
            throw new NotFoundAppException("User not found.");
        }

        throw new ForbiddenAppException("You are not allowed to manage this user.");
    }

    private Role RequireAuthenticatedRole()
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        return _currentUser.Role.Value;
    }

    private static Role ParseAssignableRole(string? value)
    {
        // Site Admin is a global platform account that cannot be assigned to an organization user.
        if (Enum.TryParse<Role>(value?.Trim(), ignoreCase: true, out var role) && role != Role.SiteAdmin)
        {
            return role;
        }

        throw new ValidationAppException("role", new[]
        {
            $"Role must be one of: {Role.OrgAdmin}, {Role.User}, {Role.ReadOnly}."
        });
    }

    private static Role? ParseOptionalRole(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Enum.TryParse<Role>(value.Trim(), ignoreCase: true, out var role) ? role : null;
    }

    private static UserStatus? ParseStatus(string? value, UserStatus? defaultStatus)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return defaultStatus;
        }

        return Enum.TryParse<UserStatus>(value.Trim(), ignoreCase: true, out var status)
            ? status
            : throw new ValidationAppException("status", AllowedStatusMessage());
    }

    private static UserStatus? ParseOptionalStatus(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return Enum.TryParse<UserStatus>(value.Trim(), ignoreCase: true, out var status) ? status : null;
    }

    private static string[] AllowedStatusMessage() => new[]
    {
        $"Status must be one of: {UserStatus.Active}, {UserStatus.Inactive}."
    };

    private static UserListItem ToListItem(User u) => new(
        u.Id, u.OrganizationId, u.FirstName, u.LastName, u.Email, u.Role.ToString(), u.Status.ToString());

    private static UserDetail ToDetail(User u) => new(
        u.Id, u.OrganizationId, u.FirstName, u.LastName, u.Email, u.Role.ToString(), u.Status.ToString(),
        u.MustChangePassword, u.CreatedAtUtc, u.UpdatedAtUtc);

    private async Task AuditAsync(
        string eventType,
        Guid? organizationId,
        Guid entityId,
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
