using Collega.Application.Abstractions;
using Collega.Domain.Boards;
using Microsoft.EntityFrameworkCore;

namespace Collega.Infrastructure.Persistence.Repositories;

public sealed class EfBoardRepository : IBoardRepository
{
    private readonly CollegaDbContext _dbContext;

    public EfBoardRepository(CollegaDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(Board board, CancellationToken cancellationToken = default) =>
        await _dbContext.Boards.AddAsync(board, cancellationToken);

    // Tracked, with swimlanes loaded, so update/reorder mutations persist through the unit of work.
    public Task<Board?> GetByIdAsync(Guid boardId, CancellationToken cancellationToken = default) =>
        _dbContext.Boards
            .Include(b => b.Swimlanes)
            .FirstOrDefaultAsync(b => b.Id == boardId, cancellationToken);

    public async Task<IReadOnlyList<Board>> ListByOrganizationAsync(Guid organizationId, CancellationToken cancellationToken = default) =>
        await _dbContext.Boards
            .AsNoTracking()
            .Include(b => b.Swimlanes)
            .Where(b => b.OrganizationId == organizationId)
            .OrderBy(b => b.Name)
            .ToListAsync(cancellationToken);

    public Task<bool> IsStatusReferencedAsync(Guid statusId, CancellationToken cancellationToken = default) =>
        _dbContext.BoardSwimlanes.AnyAsync(sl => sl.StatusId == statusId, cancellationToken);
}
