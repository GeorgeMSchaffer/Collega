using System.Net.Http.Json;

namespace Collega.Client.Services;

// Access to an organization's Idea Type / Business Impact option lists — the required classification
// fields the idea create/edit forms select from. Partial of ApiClient so this area's methods live apart
// from the shared/auth core in ApiClient.cs. The list endpoints are readable by any member of the
// organization, so every idea-creating role (Site Admin, Org Admin, User) can populate the selectors.
// Idea Type create/update/reorder/delete are admin-only (the server enforces scope); Business Impact
// stays read-only here until it gets its own admin surface.
public sealed partial class ApiClient
{
    public Task<ApiResult<List<IdeaTypeOptionDto>>> GetIdeaTypesAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<IdeaTypeOptionDto>>($"{BasePath}/organizations/{organizationId}/idea-types", ct);

    public Task<ApiResult<IdeaTypeOptionDto>> CreateIdeaTypeAsync(string organizationId, SaveIdeaTypeRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<IdeaTypeOptionDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/idea-types", body, ct);

    public Task<ApiResult<IdeaTypeOptionDto>> UpdateIdeaTypeAsync(string ideaTypeId, SaveIdeaTypeRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<IdeaTypeOptionDto>(HttpMethod.Put, $"{BasePath}/idea-types/{ideaTypeId}", body, ct);

    /// <summary>Replaces the active Idea Type order. Returns 204 (no body), so it's built by hand rather
    /// than via the JSON-reading <c>SendJsonAsync</c> helper.</summary>
    public async Task<ApiResult<bool>> ReorderIdeaTypesAsync(string organizationId, ReorderIdeaTypesRequestDto body, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/idea-types/reorder")
        {
            Content = JsonContent.Create(body),
        };
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
    }

    public async Task<ApiResult<bool>> DeleteIdeaTypeAsync(string ideaTypeId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/idea-types/{ideaTypeId}");
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
    }

    public Task<ApiResult<List<BusinessImpactOptionDto>>> GetBusinessImpactsAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<BusinessImpactOptionDto>>($"{BasePath}/organizations/{organizationId}/business-impacts", ct);
}
