namespace Collega.Application.Organizations;

/// <summary>
/// Provisions the default statuses and one default board for a newly created organization
/// (SPEC/20-feature-organizations-and-users.md rule #10, boards-and-statuses "Board Rules" #4).
/// Staged into the current unit of work; the caller owns the commit.
/// </summary>
public interface IOrganizationBootstrapService
{
    Task<OrganizationBootstrapResult> ProvisionDefaultsAsync(
        Guid organizationId,
        DateTime nowUtc,
        Guid? actorUserId,
        CancellationToken cancellationToken = default);
}

/// <summary>Identifiers/counts a caller needs to report after provisioning (contract create response).</summary>
public sealed record OrganizationBootstrapResult(Guid DefaultBoardId, int DefaultStatusCount);
