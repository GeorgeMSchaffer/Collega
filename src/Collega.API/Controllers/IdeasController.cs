using Collega.API.Contracts.Ideas;
using Collega.Application.Fields;
using Collega.Application.Ideas;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Idea lifecycle and upvotes (SPEC/30-Contracts.md "Idea Contracts" and "Upvote Contracts").
/// Spans the board-nested list/create routes and the idea-scoped detail/update/status/delete/upvote
/// routes; authorization and scoping live in <see cref="IIdeaService"/>. Controllers stay thin.
/// </summary>
[ApiController]
[Authorize]
public sealed class IdeasController : ControllerBase
{
    private readonly IIdeaService _ideaService;

    public IdeasController(IIdeaService ideaService)
    {
        _ideaService = ideaService;
    }

    [HttpGet("boards/{boardId:guid}/ideas")]
    public async Task<IActionResult> ListByBoard(
        Guid boardId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] Guid? statusId,
        [FromQuery] string? tag,
        [FromQuery] string? priority,
        [FromQuery] string? dueBefore,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        CancellationToken cancellationToken)
    {
        var query = new IdeaListQuery(page, pageSize, search, statusId, tag, priority, dueBefore, sortBy, sortDirection);
        var result = await _ideaService.ListByBoardAsync(boardId, query, cancellationToken);
        return Ok(result);
    }

    [HttpGet("organizations/{organizationId:guid}/ideas")]
    public async Task<IActionResult> ListByOrganization(
        Guid organizationId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? search,
        [FromQuery] string? scope,
        [FromQuery] string? sortBy,
        [FromQuery] string? sortDirection,
        CancellationToken cancellationToken)
    {
        var query = new OrganizationIdeaListQuery(page, pageSize, search, scope, sortBy, sortDirection);
        var result = await _ideaService.ListByOrganizationAsync(organizationId, query, cancellationToken);
        return Ok(result);
    }

    [HttpPost("boards/{boardId:guid}/ideas")]
    public async Task<IActionResult> Create(Guid boardId, [FromBody] CreateIdeaRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateIdeaCommand(
            request.Title,
            request.Description,
            request.Priority,
            request.DueDate,
            request.AssigneeUserIds,
            request.StatusId,
            request.TagNames,
            request.MentionEmails,
            ToFieldValues(request.FieldValues));

        var result = await _ideaService.CreateAsync(boardId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("ideas/{ideaId:guid}")]
    public async Task<IActionResult> GetById(Guid ideaId, CancellationToken cancellationToken)
    {
        var result = await _ideaService.GetByIdAsync(ideaId, cancellationToken);
        return Ok(result);
    }

    [HttpPut("ideas/{ideaId:guid}")]
    public async Task<IActionResult> Update(Guid ideaId, [FromBody] UpdateIdeaRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateIdeaCommand(
            request.Title,
            request.Description,
            request.Priority,
            request.DueDate,
            request.AssigneeUserIds,
            request.TagNames,
            request.MentionEmails,
            ToFieldValues(request.FieldValues));

        var result = await _ideaService.UpdateAsync(ideaId, command, cancellationToken);
        return Ok(result);
    }

    [HttpPost("ideas/{ideaId:guid}/status")]
    public async Task<IActionResult> ChangeStatus(Guid ideaId, [FromBody] ChangeIdeaStatusRequest request, CancellationToken cancellationToken)
    {
        await _ideaService.ChangeStatusAsync(ideaId, new ChangeIdeaStatusCommand(request.StatusId), cancellationToken);
        return NoContent();
    }

    [HttpDelete("ideas/{ideaId:guid}")]
    public async Task<IActionResult> Delete(Guid ideaId, CancellationToken cancellationToken)
    {
        await _ideaService.DeleteAsync(ideaId, cancellationToken);
        return NoContent();
    }

    [HttpPost("ideas/{ideaId:guid}/upvote/toggle")]
    public async Task<IActionResult> ToggleUpvote(Guid ideaId, CancellationToken cancellationToken)
    {
        var result = await _ideaService.ToggleUpvoteAsync(ideaId, cancellationToken);
        return Ok(result);
    }

    private static IReadOnlyList<IdeaFieldValueWrite>? ToFieldValues(List<IdeaFieldValueRequest>? fieldValues) =>
        fieldValues?.Select(f => new IdeaFieldValueWrite(f.FieldDefinitionId, f.Value)).ToList();
}
