using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Collega.API.ErrorHandling;

/// <summary>
/// Wires the error envelope required by SPEC/30-Contracts.md "Error Envelope": every non-2xx
/// response uses a problem-details-style payload with type/title/status/detail/instance, and
/// validation failures add an errors object keyed by field name.
/// </summary>
public static class ProblemDetailsServiceCollectionExtensions
{
    public const string ValidationProblemType = "https://collega.dev/problems/validation-error";

    public static IServiceCollection AddCollegaProblemDetails(this IServiceCollection services)
    {
        // Backs UseExceptionHandler()/UseStatusCodePages(): any non-2xx response that doesn't
        // already carry a body (unhandled exceptions, 401/403/404 from routing/auth, etc.) is
        // rendered as application/problem+json with type/title/status/detail/instance populated.
        services.AddProblemDetails(options =>
        {
            options.CustomizeProblemDetails = context =>
            {
                context.ProblemDetails.Instance = context.HttpContext.Request.Path;
                context.ProblemDetails.Detail ??=
                    $"No further details are available for this {context.ProblemDetails.Status} response.";
                context.ProblemDetails.Extensions.TryAdd("traceId", context.HttpContext.TraceIdentifier);
            };
        });

        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = CreateValidationProblemResult;
        });

        return services;
    }

    private static IActionResult CreateValidationProblemResult(ActionContext context)
    {
        // ModelState keys are the C# property names/paths from model binding. Contract request
        // bodies use camelCase field names, so the "errors" keys are translated to match what the
        // client actually sent (e.g. "Assignees[0].UserId" -> "assignees[0].userId").
        var errors = context.ModelState
            .Where(entry => entry.Value is { Errors.Count: > 0 })
            .ToDictionary(
                entry => ToCamelCasePath(entry.Key),
                entry => entry.Value!.Errors.Select(error => error.ErrorMessage).ToArray());

        var problemDetails = new ValidationProblemDetails(errors)
        {
            Type = ValidationProblemType,
            Title = "One or more fields are invalid.",
            Status = StatusCodes.Status400BadRequest,
            Detail = "The request failed validation. See the errors property for field-level details.",
            Instance = context.HttpContext.Request.Path
        };

        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    }

    private static string ToCamelCasePath(string modelStateKey)
    {
        if (string.IsNullOrEmpty(modelStateKey))
        {
            return modelStateKey;
        }

        var segments = modelStateKey.Split('.');
        for (var i = 0; i < segments.Length; i++)
        {
            var segment = segments[i];
            var bracketIndex = segment.IndexOf('[');
            var propertyPart = bracketIndex >= 0 ? segment[..bracketIndex] : segment;
            var suffix = bracketIndex >= 0 ? segment[bracketIndex..] : string.Empty;

            if (propertyPart.Length > 0)
            {
                propertyPart = JsonNamingPolicy.CamelCase.ConvertName(propertyPart);
            }

            segments[i] = propertyPart + suffix;
        }

        return string.Join('.', segments);
    }
}
