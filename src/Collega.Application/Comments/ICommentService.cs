using Collega.Application.Common;

namespace Collega.Application.Comments;

/// <summary>
/// Comment use cases (SPEC/20-feature-ideas-and-engagement.md "Comments", SPEC/30-Contracts.md
/// "Comment Contracts"). All authenticated users, including Read Only, can comment; authors edit and
/// delete their own; in-scope admins can delete any.
/// </summary>
public interface ICommentService
{
    Task<PagedResult<CommentListItem>> ListByIdeaAsync(Guid ideaId, CommentListQuery query, CancellationToken cancellationToken = default);

    Task<CreateCommentResult> CreateAsync(Guid ideaId, CreateCommentCommand command, CancellationToken cancellationToken = default);

    Task<CommentListItem> UpdateAsync(Guid commentId, UpdateCommentCommand command, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid commentId, CancellationToken cancellationToken = default);
}
