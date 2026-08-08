namespace Collega.Application.IdeaFields;

/// <summary>
/// Idea Type and Business Impact option administration (SPEC/30-Contracts.md "Idea Field Option
/// Contracts"). Listing is available to any member of the organization (idea forms need the option
/// catalog); create/update/reorder/delete are Site Admin (any org) or in-scope Org Admin only.
/// </summary>
public interface IIdeaFieldService
{
    Task<IReadOnlyList<IdeaTypeItem>> ListIdeaTypesAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<IdeaTypeItem> CreateIdeaTypeAsync(Guid organizationId, CreateIdeaTypeCommand command, CancellationToken cancellationToken = default);

    Task<IdeaTypeItem> UpdateIdeaTypeAsync(Guid ideaTypeId, UpdateIdeaTypeCommand command, CancellationToken cancellationToken = default);

    Task ReorderIdeaTypesAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default);

    Task DeleteIdeaTypeAsync(Guid ideaTypeId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BusinessImpactItem>> ListBusinessImpactsAsync(Guid organizationId, bool includeDeleted, CancellationToken cancellationToken = default);

    Task<BusinessImpactItem> CreateBusinessImpactAsync(Guid organizationId, CreateBusinessImpactCommand command, CancellationToken cancellationToken = default);

    Task<BusinessImpactItem> UpdateBusinessImpactAsync(Guid businessImpactId, UpdateBusinessImpactCommand command, CancellationToken cancellationToken = default);

    Task ReorderBusinessImpactsAsync(Guid organizationId, IReadOnlyList<Guid> orderedIds, CancellationToken cancellationToken = default);

    Task DeleteBusinessImpactAsync(Guid businessImpactId, CancellationToken cancellationToken = default);
}
