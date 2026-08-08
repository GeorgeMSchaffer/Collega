namespace Collega.Client.Services;

/// <summary>
/// Outcome of an API call: either a success (optionally carrying a value) or a failure with the
/// HTTP status and a human-readable message pulled from the problem-details envelope. Lets pages
/// branch on <see cref="Succeeded"/> and surface <see cref="Error"/> without throwing for the
/// expected 4xx flows (bad credentials, lockout, validation).
/// </summary>
public sealed class ApiResult<T>
{
    private ApiResult(bool succeeded, T? value, int statusCode, string? error)
    {
        Succeeded = succeeded;
        Value = value;
        StatusCode = statusCode;
        Error = error;
    }

    public bool Succeeded { get; }

    public T? Value { get; }

    public int StatusCode { get; }

    public string? Error { get; }

    public static ApiResult<T> Success(T value, int statusCode = 200) => new(true, value, statusCode, null);

    public static ApiResult<T> Failure(int statusCode, string error) => new(false, default, statusCode, error);
}
