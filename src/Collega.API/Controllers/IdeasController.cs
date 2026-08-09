using Collega.API.Contracts.Ideas;
using Collega.Application.Common;
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

    /// <summary>List ideas on a board with pagination and filtering.</summary>
    [HttpGet("boards/{boardId:guid}/ideas")]
    [ProducesResponseType(typeof(PagedResult<IdeaListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
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

    /// <summary>Cross-board, organization-scoped idea list for the global /ideas page.</summary>
    [HttpGet("organizations/{organizationId:guid}/ideas")]
    [ProducesResponseType(typeof(PagedResult<IdeaListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
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

    /// <summary>Create a new idea on a board.</summary>
    [HttpPost("boards/{boardId:guid}/ideas")]
    [ProducesResponseType(typeof(CreateIdeaResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid boardId, [FromBody] CreateIdeaRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateIdeaCommand(
            request.Title,
            request.Description,
            request.Priority,
            request.IdeaTypeId,
            request.BusinessImpactId,
            request.DueDate,
            request.AssigneeUserIds,
            request.StatusId,
            request.TagNames,
            request.MentionEmails,
            ToFieldValues(request.FieldValues));

        var result = await _ideaService.CreateAsync(boardId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Return full idea detail.</summary>
    [HttpGet("ideas/{ideaId:guid}")]
    [ProducesResponseType(typeof(IdeaDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid ideaId, CancellationToken cancellationToken)
    {
        var result = await _ideaService.GetByIdAsync(ideaId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Update idea content, fields, assignees, tags, and mentions.</summary>
    [HttpPut("ideas/{ideaId:guid}")]
    [ProducesResponseType(typeof(IdeaDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid ideaId, [FromBody] UpdateIdeaRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateIdeaCommand(
            request.Title,
            request.Description,
            request.Priority,
            request.IdeaTypeId,
            request.BusinessImpactId,
            request.DueDate,
            request.AssigneeUserIds,
            request.TagNames,
            request.MentionEmails,
            ToFieldValues(request.FieldValues));

        var result = await _ideaService.UpdateAsync(ideaId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Move an idea to another board status.</summary>
    [HttpPost("ideas/{ideaId:guid}/status")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ChangeStatus(Guid ideaId, [FromBody] ChangeIdeaStatusRequest request, CancellationToken cancellationToken)
    {
        await _ideaService.ChangeStatusAsync(ideaId, new ChangeIdeaStatusCommand(request.StatusId), cancellationToken);
        return NoContent();
    }

    /// <summary>Soft-delete an idea. Site Admin or in-scope Org Admin only.</summary>
    [HttpDelete("ideas/{ideaId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid ideaId, CancellationToken cancellationToken)
    {
        await _ideaService.DeleteAsync(ideaId, cancellationToken);
        return NoContent();
    }

    /// <summary>Toggle the caller's upvote on an idea.</summary>
    [HttpPost("ideas/{ideaId:guid}/upvote/toggle")]
    [ProducesResponseType(typeof(UpvoteToggleResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ToggleUpvote(Guid ideaId, CancellationToken cancellationToken)
    {
        var result = await _ideaService.ToggleUpvoteAsync(ideaId, cancellationToken);
        return Ok(result);
    }

    private static IReadOnlyList<IdeaFieldValueWrite>? ToFieldValues(List<IdeaFieldValueRequest>? fieldValues) =>
        fieldValues?.Select(f => new IdeaFieldValueWrite(f.FieldDefinitionId, f.Value)).ToList();
}
