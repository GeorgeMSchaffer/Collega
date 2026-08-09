using Collega.API.Contracts.IdeaFields;
using Collega.Application.IdeaFields;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Business Impact option administration (SPEC/30-Contracts.md "Idea Field Option Contracts"). Same
/// shape as <see cref="IdeaTypesController"/> but each option carries an editable <c>#RRGGBB</c> color.
/// </summary>
[ApiController]
[Authorize]
public sealed class BusinessImpactsController : ControllerBase
{
    private readonly IIdeaFieldService _service;

    public BusinessImpactsController(IIdeaFieldService service)
    {
        _service = service;
    }

    /// <summary>List Business Impact options for an organization, including archived options.</summary>
    [HttpGet("organizations/{organizationId:guid}/business-impacts")]
    [ProducesResponseType(typeof(IEnumerable<BusinessImpactItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _service.ListBusinessImpactsAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    /// <summary>Create an active Business Impact at the end of the organization's current option order.</summary>
    [HttpPost("organizations/{organizationId:guid}/business-impacts")]
    [ProducesResponseType(typeof(BusinessImpactItem), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateBusinessImpactRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateBusinessImpactCommand(request.Name, request.Color, request.SortOrder);
        var result = await _service.CreateBusinessImpactAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Rename, recolor, or reorder an active Business Impact.</summary>
    [HttpPut("business-impacts/{businessImpactId:guid}")]
    [ProducesResponseType(typeof(BusinessImpactItem), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid businessImpactId, [FromBody] UpdateBusinessImpactRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateBusinessImpactCommand(request.Name, request.Color, request.SortOrder);
        var result = await _service.UpdateBusinessImpactAsync(businessImpactId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Replace the complete Business Impact order atomically.</summary>
    [HttpPost("organizations/{organizationId:guid}/business-impacts/reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reorder(Guid organizationId, [FromBody] ReorderBusinessImpactsRequest request, CancellationToken cancellationToken)
    {
        await _service.ReorderBusinessImpactsAsync(organizationId, request.OrderedBusinessImpactIds, cancellationToken);
        return NoContent();
    }

    /// <summary>Soft-delete a Business Impact. Rejected with 400 when it is the organization's last active Business Impact.</summary>
    [HttpDelete("business-impacts/{businessImpactId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid businessImpactId, CancellationToken cancellationToken)
    {
        await _service.DeleteBusinessImpactAsync(businessImpactId, cancellationToken);
        return NoContent();
    }
}
