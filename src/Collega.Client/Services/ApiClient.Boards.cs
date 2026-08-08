namespace Collega.Client.Services;

// Board configuration API methods (Workflow Configuration slice). Partial of ApiClient so this
// area's methods live apart from the shared/auth core in ApiClient.cs.
public sealed partial class ApiClient
{
    public Task<ApiResult<List<BoardListItemDto>>> GetBoardsAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<BoardListItemDto>>($"{BasePath}/organizations/{organizationId}/boards", ct);

    public Task<ApiResult<BoardDetailDto>> GetBoardAsync(string boardId, CancellationToken ct = default) =>
        GetAsync<BoardDetailDto>($"{BasePath}/boards/{boardId}", ct);

    public Task<ApiResult<CreateBoardResultDto>> CreateBoardAsync(string organizationId, SaveBoardRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<CreateBoardResultDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/boards", body, ct);

    public Task<ApiResult<BoardDetailDto>> UpdateBoardAsync(string boardId, SaveBoardRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<BoardDetailDto>(HttpMethod.Put, $"{BasePath}/boards/{boardId}", body, ct);
}
