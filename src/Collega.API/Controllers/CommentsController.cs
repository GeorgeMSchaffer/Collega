using Collega.API.Contracts.Comments;
using Collega.Application.Comments;
using Collega.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Collega.API.Controllers;

/// <summary>
/// Idea comments (SPEC/30-Contracts.md "Comment Contracts"). The idea-nested list/create routes and
/// the comment-scoped edit/delete routes; permissions live in <see cref="ICommentService"/>.
/// </summary>
[ApiController]
[Authorize]
public sealed class CommentsController : ControllerBase
{
    private readonly ICommentService _commentService;

    public CommentsController(ICommentService commentService)
    {
        _commentService = commentService;
    }

    /// <summary>List comments for an idea with pagination and chronological ordering.</summary>
    [HttpGet("ideas/{ideaId:guid}/comments")]
    [ProducesResponseType(typeof(PagedResult<CommentListItem>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListByIdea(
        Guid ideaId,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sortDirection,
        CancellationToken cancellationToken)
    {
        var result = await _commentService.ListByIdeaAsync(ideaId, new CommentListQuery(page, pageSize, sortDirection), cancellationToken);
        return Ok(result);
    }

    /// <summary>Add a comment to an idea.</summary>
    [HttpPost("ideas/{ideaId:guid}/comments")]
    [ProducesResponseType(typeof(CreateCommentResult), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(Guid ideaId, [FromBody] CreateCommentRequest request, CancellationToken cancellationToken)
    {
        var result = await _commentService.CreateAsync(ideaId, new CreateCommentCommand(request.Body, request.MentionEmails), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>Edit a comment authored by the caller.</summary>
    [HttpPut("comments/{commentId:guid}")]
    [ProducesResponseType(typeof(CommentListItem), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid commentId, [FromBody] UpdateCommentRequest request, CancellationToken cancellationToken)
    {
        var result = await _commentService.UpdateAsync(commentId, new UpdateCommentCommand(request.Body, request.MentionEmails), cancellationToken);
        return Ok(result);
    }

    /// <summary>Delete a comment authored by the caller or by an authorized admin.</summary>
    [HttpDelete("comments/{commentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid commentId, CancellationToken cancellationToken)
    {
        await _commentService.DeleteAsync(commentId, cancellationToken);
        return NoContent();
    }
}
