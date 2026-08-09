using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Collega.Client.Services;

// Idea CSV export/import (T059/T060). Partial of ApiClient so this area's methods live apart from the
// shared/auth core. Export downloads the raw CSV bytes (auth header required, so it can't be a plain
// <a href>); import posts the file as multipart, mirroring the user-import client method.
public sealed partial class ApiClient
{
    public async Task<ApiResult<byte[]>> ExportBoardIdeasCsvAsync(string boardId, CancellationToken ct = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{BasePath}/boards/{boardId}/ideas/export");
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<byte[]>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(ct);
            return ApiResult<byte[]>.Success(bytes, (int)response.StatusCode);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<byte[]>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }

    public async Task<ApiResult<IdeaImportResultDto>> ImportBoardIdeasAsync(string boardId, Stream fileStream, string fileName, CancellationToken ct = default)
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new StreamContent(fileStream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "csvFile", fileName);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BasePath}/boards/{boardId}/ideas/import") { Content = content };
        await AttachTokenAsync(request);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                return ApiResult<IdeaImportResultDto>.Failure((int)response.StatusCode, await ReadFailureAsync(request, response, ct));
            }

            var value = await response.Content.ReadFromJsonAsync<IdeaImportResultDto>(JsonOptions, ct);
            return value is null
                ? ApiResult<IdeaImportResultDto>.Failure((int)response.StatusCode, "The server returned an empty response.")
                : ApiResult<IdeaImportResultDto>.Success(value, (int)response.StatusCode);
        }
        catch (HttpRequestException ex)
        {
            return ApiResult<IdeaImportResultDto>.Failure(0, $"Couldn't reach the server. {ex.Message}");
        }
    }
}
