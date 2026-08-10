using Collega.API.Contracts.Statuses;
using Collega.Application.Statuses;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Organization status configuration (SPEC/30-Contracts.md "Status Contracts"). Org-scoped list and
/// create hang off `/organizations/{organizationId}/statuses`; update and soft-delete are keyed by
/// status id under `/statuses/{statusId}`. Controllers stay thin — authorization, the 2-active-status
/// floor, and the board-reference guard live in <see cref="IStatusService"/>.
/// </summary>
[ApiController]
[Authorize]
public sealed class StatusesController : ControllerBase
{
    private readonly IStatusService _statusService;

    public StatusesController(IStatusService statusService)
    {
        _statusService = statusService;
    }

    /// <summary>List statuses for an organization. Authorized admins may pass <paramref name="includeDeleted"/>.</summary>
    [HttpGet("organizations/{organizationId:guid}/statuses")]
    [ProducesResponseType(typeof(IEnumerable<StatusItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _statusService.ListAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    /// <summary>Create a new organization status.</summary>
    [HttpPost("organizations/{organizationId:guid}/statuses")]
    [ProducesResponseType(typeof(CreateStatusResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateStatusRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateStatusCommand(request.Name, request.Color, request.SortOrder);
        var result = await _statusService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Rename or recolor a status.</summary>
    [HttpPut("statuses/{statusId:guid}")]
    [ProducesResponseType(typeof(StatusItem), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid statusId, [FromBody] UpdateStatusRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateStatusCommand(request.Name, request.Color, request.SortOrder);
        var result = await _statusService.UpdateAsync(statusId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Replace the complete active-status order atomically.</summary>
    [HttpPost("organizations/{organizationId:guid}/statuses/reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Reorder(Guid organizationId, [FromBody] ReorderStatusesRequest request, CancellationToken cancellationToken)
    {
        await _statusService.ReorderAsync(organizationId, request.OrderedStatusIds, cancellationToken);
        return NoContent();
    }

    /// <summary>Soft-delete a status while preserving existing references. Rejected when it would drop below the active-status floor.</summary>
    [HttpDelete("statuses/{statusId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid statusId, CancellationToken cancellationToken)
    {
        await _statusService.DeleteAsync(statusId, cancellationToken);
        return NoContent();
    }
}
