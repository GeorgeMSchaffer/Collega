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
public sealed class ApiClient
{
    private const string BasePath = "api/v1";

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
