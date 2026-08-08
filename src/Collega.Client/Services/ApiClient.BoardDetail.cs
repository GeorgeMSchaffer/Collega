namespace Collega.Client.Services;

// Board detail (B2) API methods: the board's idea list and minimal idea create.
// Partial of ApiClient so this page slice's methods live apart from the shared/auth core and from
// the board configuration methods in ApiClient.Boards.cs (GetBoardsAsync/GetBoardAsync are there).
// The status move lives on the single ChangeIdeaStatusAsync in ApiClient.Ideas.cs.
public sealed partial class ApiClient
{
    public Task<ApiResult<PagedResultDto<IdeaListItemDto>>> GetBoardIdeasAsync(string boardId, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<IdeaListItemDto>>($"{BasePath}/boards/{boardId}/ideas?pageSize=100", ct);

    public Task<ApiResult<CreateIdeaResultDto>> CreateIdeaAsync(string boardId, CreateIdeaRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<CreateIdeaResultDto>(HttpMethod.Post, $"{BasePath}/boards/{boardId}/ideas", body, ct);

    // Status moves go through the single ChangeIdeaStatusAsync in ApiClient.Ideas.cs.
}
