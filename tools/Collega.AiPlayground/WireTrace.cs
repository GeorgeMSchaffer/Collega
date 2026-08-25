using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace Collega.AiPlayground;

/// <summary>
/// Captures the exact HTTP request and response the Anthropic SDK exchanges, and writes each one as a
/// runnable <c>.http</c> file plus the raw response JSON.
/// </summary>
/// <remarks>
/// <para><b>Wire bytes, not a reconstruction.</b> The body written here is the one the SDK actually
/// sent — captured by sitting in the handler pipeline — so a <c>.http</c> file cannot drift from what
/// the product does. Rebuilding the request from context and transcript would have been easier and
/// would have reproduced exactly the copy-drift problem this tool exists to avoid.</para>
///
/// <para><b>The API key is never written.</b> <c>x-api-key</c> is replaced with a
/// <c>{{apiKey}}</c> variable that resolves from the environment, so a trace directory can be shared
/// or attached to a bug report without leaking a credential.</para>
///
/// <para>Assumes calls are sequential, which the sweep is — <see cref="CurrentLabel"/> is set by the
/// runner immediately before each call. Parallelising the sweep would require an
/// <see cref="System.Threading.AsyncLocal{T}"/> here.</para>
/// </remarks>
public sealed class WireTrace
{
    private readonly string _directory;
    private readonly List<string> _written = new();

    public WireTrace(string directory)
    {
        _directory = directory;
        Directory.CreateDirectory(directory);
    }

    /// <summary>Set by the runner before each call so files are named after the case and turn.</summary>
    public string CurrentLabel { get; set; } = "call";

    public IReadOnlyList<string> Written => _written;

    public void Record(
        HttpMethod method,
        Uri uri,
        IEnumerable<(string Name, string Value)> requestHeaders,
        string requestBody,
        int statusCode,
        string responseBody,
        long elapsedMs)
    {
        var stem = Path.Combine(_directory, Sanitize(CurrentLabel));
        var http = new StringBuilder();

        http.AppendLine($"### {CurrentLabel}");
        http.AppendLine($"# HTTP {statusCode} in {elapsedMs} ms. Response body: {Path.GetFileName(stem)}.response.json");
        http.AppendLine("#");
        http.AppendLine("# Runnable as-is in VS Code REST Client / JetBrains / Visual Studio, provided");
        http.AppendLine("# ANTHROPIC_API_KEY is set in the environment. The key is deliberately NOT in this file.");
        http.AppendLine();
        http.AppendLine("@apiKey = {{$processEnv ANTHROPIC_API_KEY}}");
        http.AppendLine();
        http.AppendLine($"{method} {uri}");

        foreach (var (name, value) in requestHeaders)
        {
            // Content-Length is deliberately omitted. It described the body as sent; the moment you
            // edit the body to try something, a stale value truncates or rejects the request. Every
            // REST client computes it, so emitting it can only do harm.
            if (string.Equals(name, "Content-Length", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            http.AppendLine($"{name}: {value}");
        }

        http.AppendLine();
        http.AppendLine(Pretty(requestBody));

        File.WriteAllText($"{stem}.http", http.ToString());
        File.WriteAllText($"{stem}.response.json", Pretty(responseBody));

        _written.Add($"{stem}.http");
    }

    /// <summary>
    /// Pretty-printed for reading. Semantically identical to the bytes sent, but not byte-identical —
    /// which matters only if you are counting bytes rather than reading or replaying the call.
    /// </summary>
    private static readonly JsonSerializerOptions Readable = new()
    {
        WriteIndented = true,

        // The default encoder escapes every non-ASCII character, which turns the system prompt into a
        // wall of < and —. Still valid JSON, but these files exist to be read and edited.
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static string Pretty(string json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return json;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            return JsonSerializer.Serialize(document, Readable);
        }
        catch (JsonException)
        {
            // A non-JSON body (an HTML error page from a proxy, say) is worth keeping verbatim —
            // that is exactly the case you would be tracing to diagnose.
            return json;
        }
    }

    private static string Sanitize(string label) =>
        string.Concat(label.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '.' ? c : '-'));
}

/// <summary>
/// Sits in the SDK's handler pipeline and hands each exchange to a <see cref="WireTrace"/>.
/// </summary>
public sealed class WireTraceHandler : DelegatingHandler
{
    private static readonly string[] RedactedHeaders = { "x-api-key", "authorization" };

    private readonly WireTrace _trace;

    public WireTraceHandler(WireTrace trace, HttpMessageHandler inner)
        : base(inner)
    {
        _trace = trace;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var requestBody = request.Content is null
            ? string.Empty
            : await request.Content.ReadAsStringAsync(cancellationToken);

        var headers = request.Headers
            .Concat(request.Content?.Headers.AsEnumerable() ?? Enumerable.Empty<KeyValuePair<string, IEnumerable<string>>>())
            .Select(h => (
                Name: h.Key,
                Value: RedactedHeaders.Contains(h.Key, StringComparer.OrdinalIgnoreCase)
                    ? "{{apiKey}}"
                    : string.Join(", ", h.Value)))
            .OrderBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var stopwatch = Stopwatch.StartNew();
        var response = await base.SendAsync(request, cancellationToken);
        stopwatch.Stop();

        var responseBody = response.Content is null
            ? string.Empty
            : await response.Content.ReadAsStringAsync(cancellationToken);

        _trace.Record(
            request.Method,
            request.RequestUri!,
            headers,
            requestBody,
            (int)response.StatusCode,
            responseBody,
            stopwatch.ElapsedMilliseconds);

        // The body was consumed above, so hand the SDK a fresh copy with the original content headers
        // intact — otherwise deserialization downstream reads an empty stream.
        if (response.Content is not null)
        {
            var replacement = new StringContent(responseBody);
            foreach (var header in response.Content.Headers)
            {
                replacement.Headers.Remove(header.Key);
                replacement.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            response.Content = replacement;
        }

        return response;
    }
}
