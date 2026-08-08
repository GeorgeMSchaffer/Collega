using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Collega.Client.Services;

/// <summary>
/// Thin typed wrapper over <see cref="HttpClient"/> for the Collega API. Owns the versioned base
/// path, attaches the stored bearer token to authenticated calls, and translates non-2xx responses
/// into <see cref="ApiResult{T}"/> failures carrying the problem-details message — so pages handle
/// expected 4xx flows (bad credentials, lockout, validation) without exception handling.
/// </summary>
// Partial: shared members + auth/org/user/status methods live here; page-slice API methods are
// added in sibling ApiClient.<Area>.cs files so parallel work doesn't collide on this file.
public sealed partial class ApiClient
{
    internal const string BasePath = "api/v1";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly AuthSessionStore _store;

    public ApiClient(HttpClient http, AuthSessionStore store)
    {
        _http = http;
        _store = store;
    }

    public async Task<ApiResult<LoginResponseDto>> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/auth/login")
        {
            Content = JsonContent.Create(new LoginRequestDto(email, password)),
        };
        return await SendAsync<LoginResponseDto>(request, ct);
    }

    /// <summary>Site Admin: the organization list. Pulls a large first page (admin lists are small).</summary>
    public Task<ApiResult<PagedResultDto<OrganizationListItemDto>>> GetOrganizationsAsync(CancellationToken ct = default) =>
        GetAsync<PagedResultDto<OrganizationListItemDto>>($"{BasePath}/organizations?pageSize=100", ct);

    /// <summary>The users belonging to one organization (Org Admin's own org, or any org for a Site Admin).</summary>
    public Task<ApiResult<PagedResultDto<UserListItemDto>>> GetOrganizationUsersAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<UserListItemDto>>($"{BasePath}/organizations/{organizationId}/users?pageSize=100", ct);

    public Task<ApiResult<OrganizationDetailDto>> GetOrganizationAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<OrganizationDetailDto>($"{BasePath}/organizations/{organizationId}", ct);

    public Task<ApiResult<OrganizationListItemDto>> CreateOrganizationAsync(SaveOrganizationRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<OrganizationListItemDto>(HttpMethod.Post, $"{BasePath}/organizations", body, ct);

    public Task<ApiResult<OrganizationDetailDto>> UpdateOrganizationAsync(string organizationId, SaveOrganizationRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<OrganizationDetailDto>(HttpMethod.Put, $"{BasePath}/organizations/{organizationId}", body, ct);

    public Task<ApiResult<UserDetailDto>> GetUserAsync(string userId, CancellationToken ct = default) =>
        GetAsync<UserDetailDto>($"{BasePath}/users/{userId}", ct);

    public Task<ApiResult<UserListItemDto>> CreateUserAsync(string organizationId, CreateUserRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<UserListItemDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/users", body, ct);

    public Task<ApiResult<UserDetailDto>> UpdateUserAsync(string userId, UpdateUserRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<UserDetailDto>(HttpMethod.Put, $"{BasePath}/users/{userId}", body, ct);

    /// <summary>Bulk-imports users from a CSV file (multipart, field <c>csvFile</c>).</summary>
    public async Task<ApiResult<UserImportResultDto>> ImportUsersAsync(string organizationId, Stream fileStream, string fileName, CancellationToken ct = default)
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "csvFile", fileName);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/users/import") { Content = content };
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<UserImportResultDto>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
            }

            var value = await response.Content.ReadFromJsonAsync<UserImportResultDto>(JsonOptions, ct);
            return value is null
                ? ApiResult<UserImportResultDto>.Failure((int)response.StatusCode, "The server returned an empty response.")
                : ApiResult<UserImportResultDto>.Success(value, (int)response.StatusCode);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<UserImportResultDto>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    public Task<ApiResult<List<StatusItemDto>>> GetStatusesAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<StatusItemDto>>($"{BasePath}/organizations/{organizationId}/statuses", ct);

    public Task<ApiResult<CreateStatusResultDto>> CreateStatusAsync(string organizationId, SaveStatusRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<CreateStatusResultDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/statuses", body, ct);

    public Task<ApiResult<StatusItemDto>> UpdateStatusAsync(string statusId, SaveStatusRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<StatusItemDto>(HttpMethod.Put, $"{BasePath}/statuses/{statusId}", body, ct);

    public async Task<ApiResult<bool>> DeleteStatusAsync(string statusId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/statuses/{statusId}");
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
    }

    public async Task<ApiResult<bool>> ChangePasswordAsync(string currentPassword, string newPassword, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/auth/change-password")
        {
            Content = JsonContent.Create(new ChangePasswordRequestDto(currentPassword, newPassword)),
        };
        await AttachTokenAsync(request);

        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
    }

    private async Task<ApiResult<T>> GetAsync<T>(string url, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        return await SendAsync<T>(request, ct);
    }

    private async Task<ApiResult<T>> SendJsonAsync<T>(HttpMethod method, string url, object body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, url) { Content = JsonContent.Create(body) };
        return await SendAsync<T>(request, ct);
    }

    private async Task<ApiResult<T>> SendAsync<T>(HttpRequestMessage request, CancellationToken ct)
    {
        await AttachTokenAsync(request);

        HttpResponseMessage response;
        try
        {
            response = await _http.SendAsync(request, ct);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<T>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<T>.Failure((int)response.StatusCode, await ReadErrorAsync(response, ct));
            }

            var value = await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
            return value is null
                ? ApiResult<T>.Failure((int)response.StatusCode, "The server returned an empty response.")
                : ApiResult<T>.Success(value, (int)response.StatusCode);
        }
    }

    private async Task AttachTokenAsync(HttpRequestMessage request)
    {
        var token = await _store.GetTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    private static async Task<string> ReadErrorAsync(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            var problem = await response.Content.ReadFromJsonAsync<ProblemDetailsDto>(JsonOptions, ct);
            if (!string.IsNullOrWhiteSpace(problem?.Detail))
            {
                return problem!.Detail!;
            }

            if (!string.IsNullOrWhiteSpace(problem?.Title))
            {
                return problem!.Title!;
            }
        }
        catch (JsonException)
        {
            // Non-JSON body (e.g. a bare status page) — fall through to the generic message.
        }

        return $"Request failed ({(int)response.StatusCode}).";
    }
}
