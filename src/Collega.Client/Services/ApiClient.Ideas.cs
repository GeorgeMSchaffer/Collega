using System.Net.Http.Json;

namespace Collega.Client.Services;

// Idea detail, status, upvote, and comment API methods (Ideas & Engagement slice). Partial of
// ApiClient so this area's methods live apart from the shared/auth core in ApiClient.cs.
public sealed partial class ApiClient
{
    public Task<ApiResult<IdeaDetailDto>> GetIdeaAsync(string ideaId, CancellationToken ct = default) =>
        GetAsync<IdeaDetailDto>($"{BasePath}/ideas/{ideaId}", ct);

    public Task<ApiResult<IdeaDetailDto>> UpdateIdeaAsync(string ideaId, UpdateIdeaRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<IdeaDetailDto>(HttpMethod.Put, $"{BasePath}/ideas/{ideaId}", body, ct);

    /// <summary>Moves the idea to a new status. Returns 204 with no body, so it can't use the
    /// JSON-reading <c>SendAsync</c> helper (mirrors <c>DeleteStatusAsync</c>).</summary>
    public async Task<ApiResult<bool>> ChangeIdeaStatusAsync(string ideaId, string statusId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/ideas/{ideaId}/status")
        {
            Content = JsonContent.Create(new ChangeIdeaStatusRequestDto(statusId)),
        };
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
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
