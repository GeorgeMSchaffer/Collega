namespace Collega.Client.Services;

// Read-only access to an organization's Idea Type / Business Impact option lists — the required
// classification fields the idea create/edit forms select from. Partial of ApiClient so this area's
// methods live apart from the shared/auth core in ApiClient.cs. The list endpoints are readable by
// any member of the organization, so every idea-creating role (Site Admin, Org Admin, User) can
// populate the selectors. Both default to active-only (archived options are omitted by the server
// unless includeDeleted is requested, which the forms never need).
public sealed partial class ApiClient
{
    public Task<ApiResult<List<IdeaTypeOptionDto>>> GetIdeaTypesAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<IdeaTypeOptionDto>>($"{BasePath}/organizations/{organizationId}/idea-types", ct);

    public Task<ApiResult<List<BusinessImpactOptionDto>>> GetBusinessImpactsAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<BusinessImpactOptionDto>>($"{BasePath}/organizations/{organizationId}/business-impacts", ct);
}
