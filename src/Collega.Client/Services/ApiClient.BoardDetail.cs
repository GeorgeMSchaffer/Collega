using System.Net.Http.Json;

namespace Collega.Client.Services;

// Board detail (B2) API methods: the board's idea list, minimal idea create, and status move.
// Partial of ApiClient so this page slice's methods live apart from the shared/auth core and from
// the board configuration methods in ApiClient.Boards.cs (GetBoardsAsync/GetBoardAsync are there).
public sealed partial class ApiClient
{
    public Task<ApiResult<PagedResultDto<IdeaListItemDto>>> GetBoardIdeasAsync(string boardId, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<IdeaListItemDto>>($"{BasePath}/boards/{boardId}/ideas?pageSize=100", ct);

    public Task<ApiResult<CreateIdeaResultDto>> CreateIdeaAsync(string boardId, CreateIdeaRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<CreateIdeaResultDto>(HttpMethod.Post, $"{BasePath}/boards/{boardId}/ideas", body, ct);

    // The status-move endpoint returns 204 No Content, so it can't go through SendAsync (which
    // expects a JSON body). Build it by hand like DeleteStatusAsync, surfacing problem-details on 4xx.
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
                : ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<bool>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }
}
