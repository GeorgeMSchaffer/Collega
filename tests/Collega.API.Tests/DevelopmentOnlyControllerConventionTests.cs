using System.Reflection;
using Collega.API.Conventions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace Collega.API.Tests;

/// <summary>
/// The deterministic guard that developer-only surfaces cannot route outside Development.
/// </summary>
/// <remarks>
/// Hermetic on purpose: no host, no environment variables, no <c>WebApplicationFactory</c>. An
/// end-to-end version of this check has to mutate <c>ASPNETCORE_ENVIRONMENT</c>, which is a
/// process-global and therefore races other xUnit collections. This test has no such caveat, so it
/// is the guarantee the design rests on rather than a convenience.
/// </remarks>
public class DevelopmentOnlyControllerConventionTests
{
    [DevelopmentOnly]
    private sealed class MarkedController : ControllerBase
    {
    }

    private sealed class PlainController : ControllerBase
    {
    }

    [DevelopmentOnly]
    private sealed class SecondMarkedController : ControllerBase
    {
    }

    [Fact]
    public void OutsideDevelopment_TheMarkedControllerIsRemoved()
    {
        var application = ApplicationModelWith(typeof(MarkedController), typeof(PlainController));

        new DevelopmentOnlyControllerConvention(isDevelopment: false).Apply(application);

        Assert.Equal(
            new[] { nameof(PlainController) },
            application.Controllers.Select(c => c.ControllerType.Name).ToArray());
    }

    [Fact]
    public void InDevelopment_EveryControllerIsKept()
    {
        var application = ApplicationModelWith(typeof(MarkedController), typeof(PlainController));

        new DevelopmentOnlyControllerConvention(isDevelopment: true).Apply(application);

        Assert.Equal(2, application.Controllers.Count);
    }

    /// <summary>
    /// Regression guard on the removal loop: walking the list forwards while removing from it skips
    /// the element after each removal, so two adjacent marked controllers would leave one routed.
    /// </summary>
    [Fact]
    public void OutsideDevelopment_AdjacentMarkedControllersAreBothRemoved()
    {
        var application = ApplicationModelWith(
            typeof(MarkedController), typeof(SecondMarkedController), typeof(PlainController));

        new DevelopmentOnlyControllerConvention(isDevelopment: false).Apply(application);

        Assert.Equal(
            new[] { nameof(PlainController) },
            application.Controllers.Select(c => c.ControllerType.Name).ToArray());
    }

    [Fact]
    public void OutsideDevelopment_AnApplicationWithNoMarkedControllersIsUntouched()
    {
        var application = ApplicationModelWith(typeof(PlainController));

        new DevelopmentOnlyControllerConvention(isDevelopment: false).Apply(application);

        Assert.Single(application.Controllers);
    }

    private static ApplicationModel ApplicationModelWith(params Type[] controllerTypes)
    {
        var application = new ApplicationModel();

        foreach (var controllerType in controllerTypes)
        {
            var typeInfo = controllerType.GetTypeInfo();

            // The convention reads ControllerModel.Attributes, which the real MVC model builder
            // populates from the type's own attributes — mirror that rather than leaving it empty,
            // or the marked controllers would look unmarked and every assertion here would pass
            // vacuously.
            application.Controllers.Add(
                new ControllerModel(typeInfo, typeInfo.GetCustomAttributes(inherit: false).ToArray()));
        }

        return application;
    }
}
