namespace Collega.Application.Exceptions;

/// <summary>
/// Base type for Application-layer business-rule failures. Collega.API maps each subtype to the
/// corresponding problem-details HTTP response (see Collega.API.ErrorHandling.AppExceptionHandler)
/// so use-case code can simply throw the outcome instead of every controller action hand-rolling
/// status-code mapping.
/// </summary>
public abstract class AppException : Exception
{
    protected AppException(string message)
        : base(message)
    {
    }
}

/// <summary>Maps to 400 with a field-keyed errors object, mirroring ValidationProblemDetails.</summary>
public sealed class ValidationAppException : AppException
{
    public IReadOnlyDictionary<string, string[]> Errors { get; }

    public ValidationAppException(IReadOnlyDictionary<string, string[]> errors)
        : base("Validation failed.")
    {
        Errors = errors;
    }

    public ValidationAppException(string field, IEnumerable<string> messages)
        : this(new Dictionary<string, string[]> { [field] = messages.ToArray() })
    {
    }
}

/// <summary>Maps to 401: caller is unauthenticated, or the supplied credential is invalid.</summary>
public sealed class UnauthorizedAppException : AppException
{
    public UnauthorizedAppException(string message)
        : base(message)
    {
    }
}

/// <summary>Maps to 403: caller is authenticated but not permitted to perform this action.</summary>
public sealed class ForbiddenAppException : AppException
{
    public ForbiddenAppException(string message)
        : base(message)
    {
    }
}

/// <summary>Maps to 404: target resource does not exist or is outside caller scope.</summary>
public sealed class NotFoundAppException : AppException
{
    public NotFoundAppException(string message)
        : base(message)
    {
    }
}

/// <summary>Maps to 409: request conflicts with existing state (e.g. duplicate email).</summary>
public sealed class ConflictAppException : AppException
{
    public ConflictAppException(string message)
        : base(message)
    {
    }
}

/// <summary>Maps to 429: account locked out after too many failed login attempts.</summary>
public sealed class LockedOutAppException : AppException
{
    public LockedOutAppException(string message)
        : base(message)
    {
    }
}

/// <summary>
/// Maps to 429: the caller exceeded a rate limit. Distinct from <see cref="LockedOutAppException"/>
/// even though both are 429 — a lockout is an auth outcome tied to an account, a rate limit is a
/// throughput policy that clears on its own.
/// </summary>
/// <param name="RetryAfterSeconds">
/// How long until the window has room again, surfaced as the <c>Retry-After</c> header. A 429 that
/// doesn't say when to come back leaves a well-behaved client guessing and a badly-behaved one
/// hammering.
/// </param>
public sealed class RateLimitedAppException : AppException
{
    public RateLimitedAppException(string message, int retryAfterSeconds)
        : base(message)
    {
        RetryAfterSeconds = retryAfterSeconds;
    }

    public int RetryAfterSeconds { get; }
}
