using Collega.Application.Common;

namespace Collega.Application.Organizations;

public interface IOrganizationService
{
    Task<PagedResult<OrganizationListItem>> ListAsync(OrganizationListQuery query, CancellationToken cancellationToken = default);

    Task<CreateOrganizationResult> CreateAsync(CreateOrganizationCommand command, CancellationToken cancellationToken = default);

    Task<OrganizationDetail> GetByIdAsync(Guid organizationId, CancellationToken cancellationToken = default);

    Task<OrganizationDetail> UpdateAsync(Guid organizationId, UpdateOrganizationCommand command, CancellationToken cancellationToken = default);

    Task<RegenerateInviteCodeResult> RegenerateInviteCodeAsync(Guid organizationId, CancellationToken cancellationToken = default);

    Task ArchiveAsync(Guid organizationId, CancellationToken cancellationToken = default);
}
