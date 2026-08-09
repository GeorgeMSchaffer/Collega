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

    /// <summary>List boards for an organization.</summary>
    [HttpGet("organizations/{organizationId:guid}/boards")]
    [ProducesResponseType(typeof(IEnumerable<BoardListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> List(Guid organizationId, CancellationToken cancellationToken)
    {
        var result = await _boardService.ListAsync(organizationId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Create a board with at least two swimlanes.</summary>
    [HttpPost("organizations/{organizationId:guid}/boards")]
    [ProducesResponseType(typeof(CreateBoardResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid organizationId, [FromBody] CreateBoardRequest request, CancellationToken cancellationToken)
    {
        var command = new CreateBoardCommand(request.Name, request.AllowUserStatusUpdate, ToSwimlaneInputs(request.Swimlanes));
        var result = await _boardService.CreateAsync(organizationId, command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Return board detail including swimlanes.</summary>
    [HttpGet("boards/{boardId:guid}")]
    [ProducesResponseType(typeof(BoardDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid boardId, CancellationToken cancellationToken)
    {
        var result = await _boardService.GetByIdAsync(boardId, cancellationToken);
        return Ok(result);
    }

    /// <summary>Update board name, status-update policy, or selected swimlanes.</summary>
    [HttpPut("boards/{boardId:guid}")]
    [ProducesResponseType(typeof(BoardDetail), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid boardId, [FromBody] UpdateBoardRequest request, CancellationToken cancellationToken)
    {
        var command = new UpdateBoardCommand(request.Name, request.AllowUserStatusUpdate, ToSwimlaneInputs(request.Swimlanes));
        var result = await _boardService.UpdateAsync(boardId, command, cancellationToken);
        return Ok(result);
    }

    /// <summary>Persist swimlane reorder immediately after drag-and-drop.</summary>
    [HttpPost("boards/{boardId:guid}/swimlanes/reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
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
