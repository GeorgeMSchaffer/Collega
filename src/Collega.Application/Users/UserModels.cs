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

/// <summary>One parsed CSV row for bulk user import (SPEC/30-Contracts.md user import). Role is
/// optional and defaults to <c>User</c>.</summary>
public sealed record UserImportRow(int RowNumber, string? FirstName, string? LastName, string? Email, string? Role);

/// <summary>Per-row outcome of a bulk import. <c>Outcome</c> is <c>created</c> or <c>rejected</c>;
/// <c>TemporaryPassword</c> is populated only for created rows, <c>Error</c> only for rejected ones.</summary>
public sealed record UserImportRowResult(int RowNumber, string? Email, string Outcome, string? Error, string? TemporaryPassword);

/// <summary>Result of <c>POST .../users/import</c>: created/rejected counts plus per-row outcomes.</summary>
public sealed record UserImportResult(int CreatedCount, int RejectedCount, IReadOnlyList<UserImportRowResult> Rows);
