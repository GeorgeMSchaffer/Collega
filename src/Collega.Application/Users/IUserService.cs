using Collega.Application.Common;

namespace Collega.Application.Users;

public interface IUserService
{
    Task<PagedResult<UserListItem>> ListByOrganizationAsync(Guid organizationId, UserListQuery query, CancellationToken cancellationToken = default);

    /// <summary>Active, assignable members of an organization (id + name + email only), for the idea
    /// assignee picker and mention lookup. Readable by any authenticated caller scoped to the
    /// organization — not restricted to admins like <see cref="ListByOrganizationAsync"/>.</summary>
    Task<IReadOnlyList<OrganizationMember>> ListAssignableMembersAsync(Guid organizationId, CancellationToken cancellationToken = default);

    Task<CreateUserResult> CreateAsync(Guid organizationId, CreateUserCommand command, CancellationToken cancellationToken = default);

    /// <summary>Bulk-create users from parsed CSV rows; each row succeeds or is rejected individually
    /// (SPEC/30-Contracts.md user import). Created users get a system-generated temporary password.</summary>
    Task<UserImportResult> ImportAsync(Guid organizationId, IReadOnlyList<UserImportRow> rows, CancellationToken cancellationToken = default);

    Task<UserDetail> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<UserDetail> UpdateAsync(Guid userId, UpdateUserCommand command, CancellationToken cancellationToken = default);
}
