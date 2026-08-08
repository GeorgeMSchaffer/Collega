using Collega.Application.Abstractions;
using Collega.Domain.Boards;

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
}
