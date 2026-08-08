using Collega.API.Contracts.Boards;
using Collega.Application.Boards;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Board configuration (SPEC/30-Contracts.md "Board Contracts"). Org-scoped list and create hang off
/// `/organizations/{organizationId}/boards`; detail, update, and swimlane reorder are keyed by board
/// id under `/boards/{boardId}`. Controllers stay thin — the 2-swimlane minimum, status-subset
/// validation, and immediate reorder persistence live in <see cref="IBoardService"/>.
/// </summary>
[ApiController]
[Authorize]
public sealed class BoardsController : ControllerBase
{
    private readonly IBoardService _boardService;

    public BoardsController(IBoardService boardService)
    {
        _boardService = boardService;
    }

    [HttpGet("organizations/{organizationId:guid}/boards")]
    public async Task<IActionResult> List(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _boardService.ListAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    [HttpPost("organizations/{organizationId:guid}/boards")]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateBoardRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateBoardCommand(request.Name, request.AllowUserStatusUpdate, ToSwimlaneInputs(request.Swimlanes));
        var result = await _boardService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("boards/{boardId:guid}")]
    public async Task<IActionResult> GetById(Guid boardId, CancellationToken cancellationToken)
    {
        var result = await _boardService.GetByIdAsync(boardId, cancellationToken);
        return Ok(result);
    }

    [HttpPut("boards/{boardId:guid}")]
    public async Task<IActionResult> Update(Guid boardId, [FromBody] UpdateBoardRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateBoardCommand(request.Name, request.AllowUserStatusUpdate, ToSwimlaneInputs(request.Swimlanes));
        var result = await _boardService.UpdateAsync(boardId, command, cancellationToken);
        return Ok(result);
    }

    [HttpPost("boards/{boardId:guid}/swimlanes/reorder")]
    public async Task<IActionResult> ReorderSwimlanes(Guid boardId, [FromBody] ReorderSwimlanesRequest request, CancellationToken cancellationToken)
    {
        var command = new ReorderSwimlanesCommand(ToSwimlaneInputs(request.Swimlanes));
        await _boardService.ReorderSwimlanesAsync(boardId, command, cancellationToken);
        return NoContent();
    }

    private static IReadOnlyList<SwimlaneInput> ToSwimlaneInputs(IReadOnlyList<SwimlaneRequest>? swimlanes) =>
        (swimlanes ?? new List<SwimlaneRequest>())
            .Select(s => new SwimlaneInput(s.StatusId, s.Order))
            .ToList();
}
