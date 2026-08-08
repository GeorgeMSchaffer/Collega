namespace Collega.Application.Users;

public sealed record CreateUserCommand(
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string InitialPassword,
    string? Status);

public sealed record UpdateUserCommand(
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status);

public sealed record UpdateProfileCommand(string FirstName, string LastName);

public sealed record UserListQuery(
    int? Page,
    int? PageSize,
    string? Search,
    string? Role,
    string? Status,
    string? SortBy,
    string? SortDirection);

/// <summary>Shape matches a org-users paged item.</summary>
public sealed record UserListItem(
    Guid UserId,
    Guid? OrganizationId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status);

/// <summary>Shape matches <c>GET /api/v1/users/{id}</c> detail.</summary>
public sealed record UserDetail(
    Guid UserId,
    Guid? OrganizationId,
    string FirstName,
    string LastName,
    string Email,
    string Role,
    string Status,
    bool MustChangePassword,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc);

/// <summary>Shape matches the <c>POST .../users</c> create response.</summary>
public sealed record CreateUserResult(
    Guid UserId,
    Guid OrganizationId,
    string Email,
    string Role,
    string Status);
