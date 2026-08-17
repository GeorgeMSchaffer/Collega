using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace Collega.API.Conventions;

/// <summary>
/// Marks a controller as reachable only when the host is running in the Development environment.
/// Enforced by <see cref="DevelopmentOnlyControllerConvention"/>.
/// </summary>
/// <remarks>
/// For developer tooling that must never exist in a deployed environment — surfaces that accept
/// operator-supplied input the product itself never accepts, or that expose internals for
/// debugging. It is not an authorization mechanism: a Development-only controller still carries
/// whatever <c>[Authorize]</c> it needs, because "only developers can reach it" is a statement
/// about the environment, not about the caller.
/// </remarks>
[AttributeUsage(AttributeTargets.Class, Inherited = false)]
public sealed class DevelopmentOnlyAttribute : Attribute
{
}

/// <summary>
/// Removes every <see cref="DevelopmentOnlyAttribute"/>-marked controller from the application model
/// unless the host is running in Development.
/// </summary>
/// <remarks>
/// <para>Removal from the model — rather than a filter returning 404 — is the point. A controller
/// that is not in the model has no routes registered, so a request for one is unmatched by routing
/// and never reaches filter execution, DI activation, model binding or authentication. It is also
/// absent from ApiExplorer, so it cannot appear in the OpenAPI document even if Swagger were
/// enabled outside Development.</para>
/// <para>The environment is captured at construction rather than read per request: the application
/// model is built once at startup, and <see cref="IApplicationModelConvention"/> runs once against
/// it, so there is no per-request moment at which to re-evaluate.</para>
/// </remarks>
public sealed class DevelopmentOnlyControllerConvention : IApplicationModelConvention
{
    private readonly bool _isDevelopment;

    public DevelopmentOnlyControllerConvention(bool isDevelopment) => _isDevelopment = isDevelopment;

    public void Apply(ApplicationModel application)
    {
        if (_isDevelopment)
        {
            return;
        }

        // Iterate backwards: removing from the live list while walking it forwards skips the element
        // after each removal, which would leave adjacent marked controllers registered.
        for (var i = application.Controllers.Count - 1; i >= 0; i--)
        {
            if (application.Controllers[i].Attributes.OfType<DevelopmentOnlyAttribute>().Any())
            {
                application.Controllers.RemoveAt(i);
            }
        }
    }
}
