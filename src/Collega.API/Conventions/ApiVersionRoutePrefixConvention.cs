using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace Collega.API.Conventions;

/// <summary>
/// Prefixes every controller route with "api/v1" so individual controllers never repeat the
/// version segment. Per SPEC/30-Contracts.md, HTTP APIs use path versioning under /api/v1 and
/// plural-noun resource routes.
/// </summary>
public sealed class ApiVersionRoutePrefixConvention : IApplicationModelConvention
{
    private static readonly AttributeRouteModel Prefix = new(new RouteAttribute("api/v1"));

    public void Apply(ApplicationModel application)
    {
        foreach (var controller in application.Controllers)
        {
            foreach (var selector in controller.Selectors)
            {
                selector.AttributeRouteModel = selector.AttributeRouteModel is null
                    ? Prefix
                    : AttributeRouteModel.CombineAttributeRouteModel(Prefix, selector.AttributeRouteModel);
            }
        }
    }
}
