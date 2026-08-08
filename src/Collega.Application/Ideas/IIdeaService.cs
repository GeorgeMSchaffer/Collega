using Collega.Application.Common;

namespace Collega.Application.Ideas;

/// <summary>
/// Idea use cases (SPEC/20-feature-ideas-and-engagement.md, SPEC/30-Contracts.md "Idea Contracts"
/// and "Upvote Contracts"). Authorization and organization scoping are enforced here.
/// </summary>
public interface IIdeaService
{
    Task<PagedResult<IdeaListItem>> ListByBoardAsync(Guid boardId, IdeaListQuery query, CancellationToken cancellationToken = default);

    Task<CreateIdeaResult> CreateAsync(Guid boardId, CreateIdeaCommand command, CancellationToken cancellationToken = default);

    Task<IdeaDetail> GetByIdAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task<IdeaDetail> UpdateAsync(Guid ideaId, UpdateIdeaCommand command, CancellationToken cancellationToken = default);

    Task ChangeStatusAsync(Guid ideaId, ChangeIdeaStatusCommand command, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task<UpvoteToggleResult> ToggleUpvoteAsync(Guid ideaId, CancellationToken cancellationToken = default);
}
