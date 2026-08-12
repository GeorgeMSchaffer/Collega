using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Components;
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
    private readonly NavigationManager _navigation;
    private bool _validatingUnauthorizedSession;

    public ApiClient(HttpClient http, AuthSessionStore store, NavigationManager navigation)
    {
        _http = http;
        _store = store;
        _navigation = navigation;
    }

    public async Task<ApiResult<LoginResponseDto>> LoginAsync(string email, string password, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/auth/login")
        {
            Content = JsonContent.Create(new LoginRequestDto(email, password)),
        };
        return await SendAsync<LoginResponseDto>(request, ct);
    }

    public Task<ApiResult<UserSummaryDto>> GetCurrentUserAsync(CancellationToken ct = default) =>
        GetAsync<UserSummaryDto>($"{BasePath}/auth/me", ct);

    public Task<ApiResult<UserSummaryDto>> UpdateCurrentUserAsync(string firstName, string lastName, CancellationToken ct = default) =>
        SendJsonAsync<UserSummaryDto>(HttpMethod.Put, $"{BasePath}/auth/me", new UpdateCurrentUserRequestDto(firstName, lastName), ct);

    /// <summary>Uploads the raw image bytes as the caller's portrait; the server validates + resizes. Returns the updated summary.</summary>
    public Task<ApiResult<UserSummaryDto>> UpdatePortraitAsync(byte[] imageBytes, CancellationToken ct = default) =>
        SendJsonAsync<UserSummaryDto>(HttpMethod.Put, $"{BasePath}/auth/me/portrait", new UpdatePortraitRequestDto(Convert.ToBase64String(imageBytes)), ct);

    /// <summary>Removes the caller's portrait, reverting to the initials avatar. Returns the updated summary.</summary>
    public async Task<ApiResult<UserSummaryDto>> RemovePortraitAsync(CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/auth/me/portrait");
        return await SendAsync<UserSummaryDto>(request, ct);
    }

    /// <summary>Site Admin: one page of organizations.</summary>
    public Task<ApiResult<PagedResultDto<OrganizationListItemDto>>> GetOrganizationsAsync(int page = 1, int pageSize = 100, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<OrganizationListItemDto>>($"{BasePath}/organizations?page={page}&pageSize={pageSize}", ct);

    public async Task<ApiResult<List<OrganizationListItemDto>>> GetAllOrganizationsAsync(CancellationToken ct = default)
    {
        var items = new List<OrganizationListItemDto>();
        for (var page = 1; ; page++)
        {
            var result = await GetOrganizationsAsync(page, 100, ct);
            if (!result.Succeeded)
            {
                return ApiResult<List<OrganizationListItemDto>>.Failure(result.StatusCode, result.Error ?? "Couldn't load organizations.");
            }

            items.AddRange(result.Value!.Items);
            if (items.Count >= result.Value.TotalCount || result.Value.Items.Count == 0)
            {
                return ApiResult<List<OrganizationListItemDto>>.Success(items, result.StatusCode);
            }
        }
    }

    /// <summary>The users belonging to one organization (Org Admin's own org, or any org for a Site Admin).</summary>
    public Task<ApiResult<PagedResultDto<UserListItemDto>>> GetOrganizationUsersAsync(string organizationId, int page = 1, int pageSize = 100, CancellationToken ct = default) =>
        GetAsync<PagedResultDto<UserListItemDto>>($"{BasePath}/organizations/{organizationId}/users?page={page}&pageSize={pageSize}", ct);

    /// <summary>Active, assignable members of an organization (id + name + email). Available to any
    /// authenticated caller in the org, so a plain User can populate the idea assignee picker.</summary>
    public Task<ApiResult<List<OrganizationMemberDto>>> GetAssignableMembersAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<List<OrganizationMemberDto>>($"{BasePath}/organizations/{organizationId}/members", ct);

    public async Task<ApiResult<List<UserListItemDto>>> GetAllOrganizationUsersAsync(string organizationId, CancellationToken ct = default)
    {
        var items = new List<UserListItemDto>();
        for (var page = 1; ; page++)
        {
            var result = await GetOrganizationUsersAsync(organizationId, page, 100, ct);
            if (!result.Succeeded)
            {
                return ApiResult<List<UserListItemDto>>.Failure(result.StatusCode, result.Error ?? "Couldn't load users.");
            }

            items.AddRange(result.Value!.Items);
            if (items.Count >= result.Value.TotalCount || result.Value.Items.Count == 0)
            {
                return ApiResult<List<UserListItemDto>>.Success(items, result.StatusCode);
            }
        }
    }

    public Task<ApiResult<OrganizationDetailDto>> GetOrganizationAsync(string organizationId, CancellationToken ct = default) =>
        GetAsync<OrganizationDetailDto>($"{BasePath}/organizations/{organizationId}", ct);

    public Task<ApiResult<OrganizationListItemDto>> CreateOrganizationAsync(SaveOrganizationRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<OrganizationListItemDto>(HttpMethod.Post, $"{BasePath}/organizations", body, ct);

    public Task<ApiResult<OrganizationDetailDto>> UpdateOrganizationAsync(string organizationId, SaveOrganizationRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<OrganizationDetailDto>(HttpMethod.Put, $"{BasePath}/organizations/{organizationId}", body, ct);

    /// <summary>Regenerates the org's invite code, invalidating the previous one; returns the new code.</summary>
    public Task<ApiResult<RegenerateInviteCodeResultDto>> RegenerateInviteCodeAsync(string organizationId, CancellationToken ct = default) =>
        SendJsonAsync<RegenerateInviteCodeResultDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/invite-code/regenerate", new { }, ct);

    /// <summary>Archives an organization (Site Admin). Returns 204.</summary>
    public async Task<ApiResult<bool>> ArchiveOrganizationAsync(string organizationId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/archive");
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

    /// <summary>Stores a client-resized logo (image data URI) for the org; returns the updated detail.</summary>
    public Task<ApiResult<OrganizationDetailDto>> SetOrganizationLogoAsync(string organizationId, SetLogoRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<OrganizationDetailDto>(HttpMethod.Put, $"{BasePath}/organizations/{organizationId}/logo", body, ct);

    /// <summary>Removes the org's uploaded logo; returns the updated detail.</summary>
    public async Task<ApiResult<OrganizationDetailDto>> ClearOrganizationLogoAsync(string organizationId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/organizations/{organizationId}/logo");
        return await SendAsync<OrganizationDetailDto>(request, ct);
    }

    public Task<ApiResult<UserDetailDto>> GetUserAsync(string userId, CancellationToken ct = default) =>
        GetAsync<UserDetailDto>($"{BasePath}/users/{userId}", ct);

    public Task<ApiResult<UserListItemDto>> CreateUserAsync(string organizationId, CreateUserRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<UserListItemDto>(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/users", body, ct);

    public Task<ApiResult<UserDetailDto>> UpdateUserAsync(string userId, UpdateUserRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<UserDetailDto>(HttpMethod.Put, $"{BasePath}/users/{userId}", body, ct);

    /// <summary>Issues a one-time admin-generated temporary password for the user (forces a change on next login).</summary>
    public Task<ApiResult<TemporaryPasswordResultDto>> IssueTemporaryPasswordAsync(string userId, CancellationToken ct = default) =>
        SendJsonAsync<TemporaryPasswordResultDto>(HttpMethod.Post, $"{BasePath}/users/{userId}/temporary-password", new { }, ct);

    /// <summary>Self-registers a new user with an organization invite code (anonymous).</summary>
    public Task<ApiResult<RegisterResultDto>> RegisterAsync(RegisterRequestDto body, CancellationToken ct = default) =>
        SendJsonAsync<RegisterResultDto>(HttpMethod.Post, $"{BasePath}/auth/register", body, ct);

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
                return ApiResult<UserImportResultDto>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
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

    /// <summary>Replaces the active-status order. Returns 204 (no body), so it's built by hand rather than
    /// via the JSON-reading <c>SendJsonAsync</c> helper.</summary>
    public async Task<ApiResult<bool>> ReorderStatusesAsync(string organizationId, ReorderStatusesRequestDto body, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/organizations/{organizationId}/statuses/reorder")
        {
            Content = JsonContent.Create(body),
        };
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
    }

    public async Task<ApiResult<bool>> DeleteStatusAsync(string statusId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{BasePath}/statuses/{statusId}");
        await AttachTokenAsync(request);
        using var response = await _http.SendAsync(request, ct);
        return response.IsSuccessStatusCode
            ? ApiResult<bool>.Success(true, (int)response.StatusCode)
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
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
            : ApiResult<bool>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
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
                return ApiResult<T>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
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

    private async Task HandleUnauthorizedAsync(HttpRequestMessage request, HttpResponseMessage response)
    {
        if (response.StatusCode != System.Net.HttpStatusCode.Unauthorized
            || request.Headers.Authorization is null
            || request.RequestUri?.ToString().Contains("/auth/login", StringComparison.OrdinalIgnoreCase) == true
            || _validatingUnauthorizedSession)
        {
            return;
        }

        var isCurrentUserRequest = request.RequestUri?.ToString().Contains("/auth/me", StringComparison.OrdinalIgnoreCase) == true;
        if (!isCurrentUserRequest)
        {
            _validatingUnauthorizedSession = true;
            try
            {
                using var validationRequest = new HttpRequestMessage(HttpMethod.Get, $"{BasePath}/auth/me");
                validationRequest.Headers.Authorization = request.Headers.Authorization;
                using var validationResponse = await _http.SendAsync(validationRequest);
                if (validationResponse.StatusCode != System.Net.HttpStatusCode.Unauthorized)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                return;
            }
            finally
            {
                _validatingUnauthorizedSession = false;
            }
        }

        await _store.ClearAsync("expired");
        _navigation.NavigateTo("/login?sessionExpired=true", forceLoad: true, replace: true);
    }

    private async Task<string> ReadFailureAsync(HttpRequestMessage request, HttpResponseMessage response, CancellationToken ct)
    {
        await HandleUnauthorizedAsync(request, response);
        return await ReadErrorAsync(response, ct);
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
