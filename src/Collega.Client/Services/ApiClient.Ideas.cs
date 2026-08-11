using System.Net.Http.Json;

namespace Collega.Client.Services;

// Idea detail, status, upvote, and comment API methods (Ideas & Engagement slice). Partial of
// ApiClient so this area's methods live apart from the shared/auth core in ApiClient.cs.
public sealed partial class ApiClient
{
    public Task<ApiResult<IdeaDetailDto>> GetIdeaAsync(string ideaId, CancellationToken ct = default) =>
        GetAsync<IdeaDetailDto>($"{BasePath}/ideas/{ideaId}", ct);

    /// <summary>The organization-wide idea list for the global /ideas page. <paramref name="scope"/>
    /// is all/created/assigned; newest-first by default. <paramref name="tag"/> filters by normalized
    /// tag name, <paramref name="user"/> (a GUID string) filters to ideas the given user authored or is
    /// assigned to, and <paramref name="sortBy"/>/<paramref name="sortDirection"/> drive server-side
    /// column sorting (SPEC/30-Contracts.md org ideas route).</summary>
    public Task<ApiResult<PagedResultDto<IdeaListItemDto>>> GetOrganizationIdeasAsync(
        string organizationId, string? scope, string? search, int page, int pageSize,
        IReadOnlyDictionary<string, string>? fieldFilters = null,
        string? tag = null, string? user = null, string? sortBy = null, string? sortDirection = null,
        CancellationToken ct = default)
    {
        var direction = string.IsNullOrWhiteSpace(sortDirection) ? "desc" : sortDirection;
        var url = $"{BasePath}/organizations/{organizationId}/ideas?page={page}&pageSize={pageSize}&sortDirection={Uri.EscapeDataString(direction)}";
        if (!string.IsNullOrWhiteSpace(sortBy))
        {
            url += $"&sortBy={Uri.EscapeDataString(sortBy)}";
        }
        if (!string.IsNullOrWhiteSpace(scope) && scope != "all")
        {
            url += $"&scope={Uri.EscapeDataString(scope)}";
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            url += $"&search={Uri.EscapeDataString(search)}";
        }
        if (!string.IsNullOrWhiteSpace(tag))
        {
            url += $"&tag={Uri.EscapeDataString(tag)}";
        }
        if (!string.IsNullOrWhiteSpace(user))
        {
            url += $"&user={Uri.EscapeDataString(user)}";
        }
        // User-Defined Field filters serialize as fieldFilters[<fieldDefinitionId>]=<value> (T059).
        if (fieldFilters is not null)
        {
            foreach (var (fieldId, value) in fieldFilters)
            {
                if (!string.IsNullOrWhiteSpace(value))
                {
                    url += $"&fieldFilters%5B{Uri.EscapeDataString(fieldId)}%5D={Uri.EscapeDataString(value)}";
                }
            }
        }
        return GetAsync<PagedResultDto<IdeaListItemDto>>(url, ct);
    }

    public async Task<ApiResult<List<IdeaListItemDto>>> GetAllOrganizationIdeasAsync(
        string organizationId, string? search, CancellationToken ct = default)
    {
        var items = new List<IdeaListItemDto>();
        for (var page = 1; ; page++)
        {
            var result = await GetOrganizationIdeasAsync(organizationId, "all", search, page, 250, null, ct: ct);
            if (!result.Succeeded)
            {
                return ApiResult<List<IdeaListItemDto>>.Failure(result.StatusCode, result.Error ?? "Couldn't load ideas.");
            }

            items.AddRange(result.Value!.Items);
            if (items.Count >= result.Value.TotalCount || result.Value.Items.Count == 0)
            {
                return ApiResult<List<IdeaListItemDto>>.Success(items, result.StatusCode);
            }
        }
    }

    public Task<ApiResult<IdeaDetailDto>> UpdateIdeaAsync(string ideaId, UpdateIdeaRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<IdeaDetailDto>(HttpMethod.Put, $"{BasePath}/ideas/{ideaId}", body, ct);

    /// <summary>Soft-deletes an idea (admin-only server-side, SPEC/30-Contracts.md
    /// <c>DELETE /ideas/{ideaId}</c>). Returns 204 with no body, so it's built by hand rather than via
    /// the JSON-reading <c>SendAsync</c> helper (mirrors <c>ChangeIdeaStatusAsync</c>).</summary>
    public async Task<ApiResult<bool>> DeleteIdeaAsync(string ideaId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/ideas/{ideaId}");
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            return response.IsSuccessStatusCode
                ? ApiResult<bool>.Success(true, (int)response.StatusCode)
                : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<bool>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    /// <summary>Moves the idea to a new status. Returns 204 with no body, so it's built by hand
    /// rather than via the JSON-reading <c>SendAsync</c> helper (mirrors <c>DeleteStatusAsync</c>).
    /// This is the single status-move method shared by Idea Detail and Board detail.</summary>
    public async Task<ApiResult<bool>> ChangeIdeaStatusAsync(string ideaId, ChangeIdeaStatusRequestDto body, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/ideas/{ideaId}/status")
        {
            Content = JsonContent.Create(body),
        };
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            return response.IsSuccessStatusCode
                ? ApiResult<bool>.Success(true, (int)response.StatusCode)
                : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<bool>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    /// <summary>Toggles the current user's upvote (POST with no body, returns the new count/state).</summary>
    public async Task<ApiResult<UpvoteToggleResultDto>> ToggleUpvoteAsync(string ideaId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/ideas/{ideaId}/upvote/toggle");
        return await SendAsync<UpvoteToggleResultDto>(request, ct);
    }

    /// <summary>Comments for an idea, oldest first (chronological, SPEC/20-feature-ideas-and-engagement #2).</summary>
    public Task<ApiResult<PagedResultDto<CommentListItemDto>>> GetIdeaCommentsAsync(string ideaId, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<CommentListItemDto>>($"{BasePath}/ideas/{ideaId}/comments?pageSize=250&sortDirection=asc", ct);

    public Task<ApiResult<CreateCommentResultDto>> AddIdeaCommentAsync(string ideaId, CreateCommentRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<CreateCommentResultDto>(HttpMethod.Post, $"{BasePath}/ideas/{ideaId}/comments", body, ct);
}
