using Collega.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

/// <summary>
/// Read-only board/swimlane/status access for the Collaboration slice. Reads through the existing
/// <see cref="CollegaDbContext"/> DbSets that the Workflow Configuration slice owns for writes,
/// keeping the two slices decoupled at the abstraction level (see <see cref="IBoardReader"/>).
/// </summary>
public sealed class EfBoardReader : IBoardReader
{
    private readonly CollegaDbContext _dbContext;

    public EfBoardReader(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<BoardContext?> GetBoardContextAsync(Guid boardId, CancellationToken cancellationToken = default)
    {
        var board = await _dbContext.Boards
            .AsNoTracking()
            .Include(b => b.Swimlanes)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

        if (board is null)
        {
            return null;
        }

        var swimlanes = board.Swimlanes
            .Select(s => new SwimlaneInfo(s.StatusId, s.DisplayOrder))
            .ToList();

        return new BoardContext(board.Id, board.OrganizationId, board.Name, board.AllowUserStatusUpdate, swimlanes);
    }

    public async Task<IReadOnlyDictionary<Guid, StatusInfo>> GetStatusInfoAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        var statuses = await _dbContext.Statuses
            .AsNoTracking()
            .Where(s => s.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

        return statuses.ToDictionary(
            s => s.Id,
            s => new StatusInfo(s.Id, s.Name, s.Color, s.IsDeleted));
    }
}
