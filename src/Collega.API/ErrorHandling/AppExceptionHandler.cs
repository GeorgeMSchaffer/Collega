using Collega.Application.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.ErrorHandling;

/// <summary>
/// Maps Application-layer <see cref="AppException"/> subtypes thrown by use-case code to the
/// contract's problem-details error envelope, so controllers can simply let these propagate
/// instead of hand-mapping status codes in every action. Registered via
/// <c>services.AddExceptionHandler&lt;AppExceptionHandler&gt;()</c> ahead of the generic
/// AddProblemDetails() fallback wired by <see cref="ProblemDetailsServiceCollectionExtensions"/>
/// (which still handles unrecognized exceptions and bodiless non-2xx status codes).
/// </summary>
public sealed class AppExceptionHandler : IExceptionHandler
{
    // SPEC/30-Contracts.md "Error Envelope" requires a `type` member on every non-2xx response.
    // Named per problem kind (consistent with the validation-error type) rather than restating status.
    private static string TypeFor(int statusCode) => statusCode switch
    {
        StatusCodes.Status401Unauthorized => "https://collega.dev/problems/unauthorized",
        StatusCodes.Status403Forbidden => "https://collega.dev/problems/forbidden",
        StatusCodes.Status404NotFound => "https://collega.dev/problems/not-found",
        StatusCodes.Status409Conflict => "https://collega.dev/problems/conflict",
        StatusCodes.Status429TooManyRequests => "https://collega.dev/problems/too-many-requests",
        _ => "https://collega.dev/problems/error",
    };

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, problemDetails) = exception switch
        {
            ValidationAppException validation => (
                StatusCodes.Status400BadRequest,
                (ProblemDetails)new ValidationProblemDetails(new Dictionary<string, string[]>(validation.Errors))
                {
                    Type = ProblemDetailsServiceCollectionExtensions.ValidationProblemType,
                    Title = "One or more fields are invalid.",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "The request failed validation. See the errors property for field-level details."
                }),
            UnauthorizedAppException unauthorized => (
                StatusCodes.Status401Unauthorized,
                new ProblemDetails { Type = TypeFor(StatusCodes.Status401Unauthorized), Title = "Unauthorized", Status = StatusCodes.Status401Unauthorized, Detail = unauthorized.Message }),
            ForbiddenAppException forbidden => (
                StatusCodes.Status403Forbidden,
                new ProblemDetails { Type = TypeFor(StatusCodes.Status403Forbidden), Title = "Forbidden", Status = StatusCodes.Status403Forbidden, Detail = forbidden.Message }),
            NotFoundAppException notFound => (
                StatusCodes.Status404NotFound,
                new ProblemDetails { Type = TypeFor(StatusCodes.Status404NotFound), Title = "Not Found", Status = StatusCodes.Status404NotFound, Detail = notFound.Message }),
            ConflictAppException conflict => (
                StatusCodes.Status409Conflict,
                new ProblemDetails { Type = TypeFor(StatusCodes.Status409Conflict), Title = "Conflict", Status = StatusCodes.Status409Conflict, Detail = conflict.Message }),
            LockedOutAppException lockedOut => (
                StatusCodes.Status429TooManyRequests,
                new ProblemDetails { Type = TypeFor(StatusCodes.Status429TooManyRequests), Title = "Too Many Requests", Status = StatusCodes.Status429TooManyRequests, Detail = lockedOut.Message }),
            _ => (0, null)
        };

        if (problemDetails is null)
        {
            // Not one of ours — let the default AddProblemDetails() handler render it.
            return false;
        }

        problemDetails.Instance = httpContext.Request.Path;
        problemDetails.Extensions.TryAdd("traceId", httpContext.TraceIdentifier);

        httpContext.Response.StatusCode = status;
        // WriteAsJsonAsync sets its own Content-Type unless one is passed explicitly here, so
        // setting httpContext.Response.ContentType beforehand alone would get overwritten.
        //
        // Serialize the RUNTIME type, not the declared one. The switch above widens every arm to
        // ProblemDetails, and System.Text.Json writes only the declared type's members — so the
        // generic overload silently dropped ValidationProblemDetails.Errors, and every 400 shipped
        // an envelope whose own `detail` referred the client to an `errors` property that was not
        // there. Passing the concrete type keeps the subtype's members.
        await httpContext.Response.WriteAsJsonAsync(
            problemDetails, problemDetails.GetType(), options: null, contentType: "application/problem+json", cancellationToken);

        return true;
    }
}
