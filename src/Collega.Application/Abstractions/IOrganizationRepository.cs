using Collega.Application.Common;
using Collega.Domain.Organizations;

namespace Collega.Application.Abstractions;

public interface IOrganizationRepository
{
    Task<Organization?> GetByIdAsync(Guid organizationId, CancellationToken cancellationToken = default);

    Task<Organization?> GetByInviteCodeAsync(string inviteCode, CancellationToken cancellationToken = default);

    /// <summary>Paged organization list for Site Admin (SPEC/30-Contracts.md <c>GET /organizations</c>).</summary>
    Task<PagedResult<Organization>> ListAsync(OrganizationListFilter filter, CancellationToken cancellationToken = default);

    Task<bool> InviteCodeExistsAsync(string inviteCode, CancellationToken cancellationToken = default);

    Task AddAsync(Organization organization, CancellationToken cancellationToken = default);
}

/// <summary>
/// Store-facing filter for organization listing. Archived organizations are excluded unless
/// <see cref="IncludeArchived"/> is set (SPEC/30-Contracts.md "Collection Conventions").
/// </summary>
public sealed record OrganizationListFilter(
    PageRequest Page,
    string? Search,
    bool IncludeArchived,
    string? SortBy,
    string? SortDirection);
