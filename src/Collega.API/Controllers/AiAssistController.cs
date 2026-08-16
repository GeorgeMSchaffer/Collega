using Collega.Application.Ai;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// AI assist usage reporting per SPEC/30-Contracts.md → "AI Idea Assist Contracts". Read-only —
/// nothing here mutates organization content, so the Site-Admin mutation guard does not apply.
/// </summary>
/// <remarks>
/// The drafting endpoint (<c>POST /boards/{boardId}/idea-assist/turns</c>) is not here yet: it
/// arrives with the idea-assist slice. These endpoints stand alone because the meter they read is
/// independent of the model provider.
///
/// Role checks live in <see cref="IAiUsageService"/>, not in this controller — authorization is a
/// use-case concern (Collega.Application/CLAUDE.md). The <c>[Authorize]</c> attributes here are a
/// coarse first gate only.
/// </remarks>
[ApiController]
[Route("ai-assist")]
public sealed class AiAssistController : ControllerBase
{
    private readonly IAiUsageService _usageService;

    public AiAssistController(IAiUsageService usageService)
    {
        _usageService = usageService;
    }

    /// <summary>Platform-wide AI consumption, one entry per organization.</summary>
    [Authorize(Roles = "SiteAdmin")]
    [HttpGet("usage")]
    [ProducesResponseType(typeof(AiUsageReport), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPlatformUsage(
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var report = await _usageService.GetPlatformUsageAsync(fromUtc, toUtc, cancellationToken);
        return Ok(report);
    }
}

/// <summary>
/// The organization-scoped half of the usage contract. Its own controller so the route sits under
/// <c>organizations/{organizationId}</c> without fighting the class-level route above.
/// </summary>
[ApiController]
[Route("organizations/{organizationId:guid}/ai-assist")]
public sealed class OrganizationAiAssistController : ControllerBase
{
    private readonly IAiUsageService _usageService;

    public OrganizationAiAssistController(IAiUsageService usageService)
    {
        _usageService = usageService;
    }

    /// <summary>
    /// One organization's AI consumption. Site Admin may read any organization; an Org Admin only
    /// their own — enforced in the service, which answers 404 rather than 403 for a foreign
    /// organization so the response cannot confirm that it exists.
    /// </summary>
    [Authorize(Roles = "OrgAdmin,SiteAdmin")]
    [HttpGet("usage")]
    [ProducesResponseType(typeof(AiUsageReport), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrganizationUsage(
        Guid organizationId,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        CancellationToken cancellationToken)
    {
        var report = await _usageService.GetOrganizationUsageAsync(organizationId, fromUtc, toUtc, cancellationToken);
        return Ok(report);
    }
}
