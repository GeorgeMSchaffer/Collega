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

    [HttpGet("organizations/{organizationId:guid}/statuses")]
    public async Task<IActionResult> List(Guid organizationId, [FromQuery] bool includeDeleted, CancellationToken cancellationToken)
    {
        var result = await _statusService.ListAsync(organizationId, includeDeleted, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/statuses")]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateStatusRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateStatusCommand(request.Name, request.Color, request.SortOrder);
        var result = await _statusService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("statuses/{statusId:guid}")]
    public async Task<IActionResult> Update(Guid statusId, [FromBody] UpdateStatusRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateStatusCommand(request.Name, request.Color, request.SortOrder);
        var result = await _statusService.UpdateAsync(statusId, command, cancellationToken);
        return Ok(result);
    }

    [HttpDelete("statuses/{statusId:guid}")]
    public async Task<IActionResult> Delete(Guid statusId, CancellationToken cancellationToken)
    {
        await _statusService.DeleteAsync(statusId, cancellationToken);
        return NoContent();
    }
}
