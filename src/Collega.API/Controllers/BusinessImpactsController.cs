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

    [HttpGet("organizations/{organizationId:guid}/business-impacts")]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _service.ListBusinessImpactsAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/business-impacts")]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateBusinessImpactRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateBusinessImpactCommand(request.Name, request.Color, request.SortOrder);
        var result = await _service.CreateBusinessImpactAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("business-impacts/{businessImpactId:guid}")]
    public async Task<IActionResult> Update(Guid businessImpactId, [FromBody] UpdateBusinessImpactRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateBusinessImpactCommand(request.Name, request.Color, request.SortOrder);
        var result = await _service.UpdateBusinessImpactAsync(businessImpactId, command, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/business-impacts/reorder")]
    public async Task<IActionResult> Reorder(Guid organizationId, [FromBody] ReorderBusinessImpactsRequest request, CancellationToken cancellationToken)
    {
        await _service.ReorderBusinessImpactsAsync(organizationId, request.OrderedBusinessImpactIds, cancellationToken);
        return NoContent();
    }

    [HttpDelete("business-impacts/{businessImpactId:guid}")]
    public async Task<IActionResult> Delete(Guid businessImpactId, CancellationToken cancellationToken)
    {
        await _service.DeleteBusinessImpactAsync(businessImpactId, cancellationToken);
        return NoContent();
    }
}
