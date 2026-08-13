using Collega.Application.Common;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<User?> GetByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<bool> ExistsByNormalizedEmailAsync(string normalizedEmail, CancellationToken cancellationToken = default);

    Task<bool> AnySiteAdminAsync(CancellationToken cancellationToken = default);

    /// <summary>Paged user list within one organization (SPEC/30-Contracts.md org users list).</summary>
    Task<PagedResult<User>> ListByOrganizationAsync(UserListFilter filter, CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads users by their ids. Used by the Collaboration slice to validate idea assignees and to
    /// project assignee/mention display names without an N+1 lookup.
    /// </summary>
    Task<IReadOnlyList<User>> ListByIdsAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Number of active <see cref="Role.OrgAdmin"/> users in an organization, used to enforce the
    /// last-Org-Admin safeguard (org-and-users requirement #8).
    /// </summary>
    /// <summary>
    /// Users the View As picker may offer. <paramref name="organizationId"/> is null for a Site
    /// Admin (all organizations) and set for an Org Admin, so the scope restriction is applied in
    /// the query rather than filtered afterwards — an Org Admin's result set never contains a user
    /// they may not target.
    /// </summary>
    Task<IReadOnlyList<User>> SearchForImpersonationAsync(Guid? organizationId, string? search, CancellationToken cancellationToken = default);

    Task<int> CountActiveOrgAdminsAsync(Guid organizationId, Guid? excludingUserId = null, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);
}

/// <summary>Store-facing filter for org-scoped user listing.</summary>
public sealed record UserListFilter(
    Guid OrganizationId,
    PageRequest Page,
    string? Search,
    Role? Role,
    UserStatus? Status,
    string? SortBy,
    string? SortDirection);
