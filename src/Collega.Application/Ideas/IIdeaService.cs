using Collega.Application.Common;

namespace Collega.Application.Ideas;

/// <summary>
/// Idea use cases (SPEC/20-feature-ideas-and-engagement.md, SPEC/30-Contracts.md "Idea Contracts"
/// and "Upvote Contracts"). Authorization and organization scoping are enforced here.
/// </summary>
public interface IIdeaService
{
    Task<PagedResult<IdeaListItem>> ListByBoardAsync(Guid boardId, IdeaListQuery query, CancellationToken cancellationToken = default);

    /// <summary>Cross-board, organization-scoped idea list for the global <c>/ideas</c> page.</summary>
    Task<PagedResult<IdeaListItem>> ListByOrganizationAsync(Guid organizationId, OrganizationIdeaListQuery query, CancellationToken cancellationToken = default);

    Task<CreateIdeaResult> CreateAsync(Guid boardId, CreateIdeaCommand command, CancellationToken cancellationToken = default);

    Task<IdeaDetail> GetByIdAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task<IdeaDetail> UpdateAsync(Guid ideaId, UpdateIdeaCommand command, CancellationToken cancellationToken = default);

    /// <summary>Admin-only reassignment of an idea's (otherwise immutable) type
    /// (SPEC/20-feature-idea-type-fields.md). Re-resolves fields; out-of-scope values are preserved
    /// (hidden), not dropped; emits an <c>IdeaTypeReassigned</c> audit event.</summary>
    Task ReassignIdeaTypeAsync(Guid organizationId, Guid ideaId, Guid ideaTypeId, CancellationToken cancellationToken = default);

    Task ChangeStatusAsync(Guid ideaId, ChangeIdeaStatusCommand command, CancellationToken cancellationToken = default);

    Task DeleteAsync(Guid ideaId, CancellationToken cancellationToken = default);

    Task<UpvoteToggleResult> ToggleUpvoteAsync(Guid ideaId, CancellationToken cancellationToken = default);

    /// <summary>Exports a board's active ideas as CSV rows (T059/T060). One column per core field plus
    /// one per active User-Defined Field.</summary>
    Task<IdeaCsvExport> ExportBoardIdeasAsync(Guid boardId, CancellationToken cancellationToken = default);

    /// <summary>Create-only CSV import of ideas onto a board (T059/T060). Each valid row creates one
    /// idea (defaulting to the left-most swimlane unless a Status names a board swimlane); invalid rows
    /// are rejected with a per-row message and do not stop the rest.</summary>
    Task<IdeaImportResult> ImportBoardIdeasAsync(Guid boardId, IReadOnlyList<IdeaImportRow> rows, CancellationToken cancellationToken = default);
}
