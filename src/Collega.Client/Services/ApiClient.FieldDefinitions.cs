using System.Net.Http.Json;

namespace Collega.Client.Services;

// Organization User-Defined Field definition API methods (UDF client slice). Partial of ApiClient so
// this area's methods live apart from the shared/auth core in ApiClient.cs. Beyond the six CRUD/reorder
// endpoints, this file owns a small in-memory cache of an org's ACTIVE field definitions: the idea
// forms (new-idea mini form, idea detail) read the schema through it so they don't refetch on every
// open. Any mutation here invalidates the org's cached entry.
public sealed partial class ApiClient
{
    private readonly Dictionary<string, IReadOnlyList<FieldDefinitionDto>> _activeFieldDefinitionsCache = new();

    public Task<ApiResult<List<FieldDefinitionDto>>> GetFieldDefinitionsAsync(
        string organizationId, bool includeDeleted = false, CancellationToken ct = default) =>
        GetAsync<List<FieldDefinitionDto>>(
            $"{BasePath}/organizations/{organizationId}/field-definitions{(includeDeleted ? "?includeDeleted=true" : string.Empty)}",
            ct);

    public Task<ApiResult<FieldDefinitionDto>> GetFieldDefinitionAsync(
        string organizationId, string id, CancellationToken ct = default) =>
        GetAsync<FieldDefinitionDto>($"{BasePath}/organizations/{organizationId}/field-definitions/{id}", ct);

    public async Task<ApiResult<FieldDefinitionDto>> CreateFieldDefinitionAsync(
        string organizationId, SaveFieldDefinitionRequestDto body, CancellationToken ct = default)
    {
        var result = await SendJsonAsync<FieldDefinitionDto>(
            HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/field-definitions", body, ct);
        if (result.Succeeded)
        {
            InvalidateFieldDefinitions(organizationId);
        }
        return result;
    }

    public async Task<ApiResult<FieldDefinitionDto>> UpdateFieldDefinitionAsync(
        string organizationId, string id, SaveFieldDefinitionRequestDto body, CancellationToken ct = default)
    {
        var result = await SendJsonAsync<FieldDefinitionDto>(
            HttpMethod.Put, $"{BasePath}/organizations/{organizationId}/field-definitions/{id}", body, ct);
        if (result.Succeeded)
        {
            InvalidateFieldDefinitions(organizationId);
        }
        return result;
    }

    /// <summary>Sets the display order for the org's active definitions. Returns 204 (no body), so it's
    /// built by hand rather than via the JSON-reading <c>SendJsonAsync</c> helper.</summary>
    public async Task<ApiResult<bool>> ReorderFieldDefinitionsAsync(
        string organizationId, ReorderFieldDefinitionsRequestDto body, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Put, $"{BasePath}/organizations/{organizationId}/field-definitions/reorder")
        {
            Content = JsonContent.Create(body),
        };
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
            }

            InvalidateFieldDefinitions(organizationId);
            return ApiResult<bool>.Success(true, (int)response.StatusCode);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<bool>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    /// <summary>Soft-deletes (archives) a definition. Returns 204; values are preserved server-side.</summary>
    public async Task<ApiResult<bool>> DeleteFieldDefinitionAsync(
        string organizationId, string id, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Delete, $"{BasePath}/organizations/{organizationId}/field-definitions/{id}");
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
            }

            InvalidateFieldDefinitions(organizationId);
            return ApiResult<bool>.Success(true, (int)response.StatusCode);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<bool>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    /// <summary>
    /// The org's ACTIVE field definitions ordered by display order, served from an in-memory cache so
    /// idea forms avoid a refetch per open. The cache is dropped whenever a definition is created,
    /// updated, reordered, or deleted through this client.
    /// </summary>
    public async Task<ApiResult<IReadOnlyList<FieldDefinitionDto>>> GetActiveFieldDefinitionsAsync(
        string organizationId, CancellationToken ct = default)
    {
        if (_activeFieldDefinitionsCache.TryGetValue(organizationId, out var cached))
        {
            return ApiResult<IReadOnlyList<FieldDefinitionDto>>.Success(cached);
        }

        var result = await GetFieldDefinitionsAsync(organizationId, includeDeleted: false, ct);
        if (!result.Succeeded)
        {
            return ApiResult<IReadOnlyList<FieldDefinitionDto>>.Failure(
                result.StatusCode, result.Error ?? "Loading field definitions failed.");
        }

        var active = result.Value!
            .Where(f => !f.IsDeleted)
            .OrderBy(f => f.DisplayOrder)
            .ToList();
        _activeFieldDefinitionsCache[organizationId] = active;
        return ApiResult<IReadOnlyList<FieldDefinitionDto>>.Success(active);
    }

    private void InvalidateFieldDefinitions(string organizationId) =>
        _activeFieldDefinitionsCache.Remove(organizationId);
}
