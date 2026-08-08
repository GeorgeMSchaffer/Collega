using Collega.API.Contracts.Comments;
using Collega.Application.Comments;
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

    [HttpGet("ideas/{ideaId:guid}/comments")]
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

    [HttpPost("ideas/{ideaId:guid}/comments")]
    public async Task<IActionResult> Create(Guid ideaId, [FromBody] CreateCommentRequest request, CancellationToken cancellationToken)
    {
        var result = await _commentService.CreateAsync(ideaId, new CreateCommentCommand(request.Body, request.MentionEmails), cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPut("comments/{commentId:guid}")]
    public async Task<IActionResult> Update(Guid commentId, [FromBody] UpdateCommentRequest request, CancellationToken cancellationToken)
    {
        var result = await _commentService.UpdateAsync(commentId, new UpdateCommentCommand(request.Body, request.MentionEmails), cancellationToken);
        return Ok(result);
    }

    [HttpDelete("comments/{commentId:guid}")]
    public async Task<IActionResult> Delete(Guid commentId, CancellationToken cancellationToken)
    {
        await _commentService.DeleteAsync(commentId, cancellationToken);
        return NoContent();
    }
}
