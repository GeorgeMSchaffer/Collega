namespace Collega.Application.Boards;

/// <summary>
/// Board configuration (SPEC/20-feature-boards-and-statuses.md "Board Rules",
/// SPEC/30-Contracts.md "Board Contracts"). Enforces the 2-swimlane minimum (T022), that a board's
/// swimlanes are a subset of the organization's active statuses (T023), and immediate persistence of
/// swimlane reorder (T024).
/// </summary>
public interface IBoardService
{
    Task<IReadOnlyList<BoardListItem>> ListAsync(Guid organizationId, CancellationToken cancellationToken = default);

    Task<CreateBoardResult> CreateAsync(Guid organizationId, CreateBoardCommand command, CancellationToken cancellationToken = default);

    Task<BoardDetail> GetByIdAsync(Guid boardId, CancellationToken cancellationToken = default);

    Task<BoardDetail> UpdateAsync(Guid boardId, UpdateBoardCommand command, CancellationToken cancellationToken = default);

    Task ReorderSwimlanesAsync(Guid boardId, ReorderSwimlanesCommand command, CancellationToken cancellationToken = default);
}
