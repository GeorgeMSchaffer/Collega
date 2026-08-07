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
                new ProblemDetails { Title = "Unauthorized", Status = StatusCodes.Status401Unauthorized, Detail = unauthorized.Message }),
            ForbiddenAppException forbidden => (
                StatusCodes.Status403Forbidden,
                new ProblemDetails { Title = "Forbidden", Status = StatusCodes.Status403Forbidden, Detail = forbidden.Message }),
            NotFoundAppException notFound => (
                StatusCodes.Status404NotFound,
                new ProblemDetails { Title = "Not Found", Status = StatusCodes.Status404NotFound, Detail = notFound.Message }),
            ConflictAppException conflict => (
                StatusCodes.Status409Conflict,
                new ProblemDetails { Title = "Conflict", Status = StatusCodes.Status409Conflict, Detail = conflict.Message }),
            LockedOutAppException lockedOut => (
                StatusCodes.Status429TooManyRequests,
                new ProblemDetails { Title = "Too Many Requests", Status = StatusCodes.Status429TooManyRequests, Detail = lockedOut.Message }),
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
        await httpContext.Response.WriteAsJsonAsync(problemDetails, options: null, contentType: "application/problem+json", cancellationToken);

        return true;
    }
}
