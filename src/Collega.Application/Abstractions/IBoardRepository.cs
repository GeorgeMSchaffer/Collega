using Collega.Domain.Boards;

namespace Collega.Application.Abstractions;

public interface IBoardRepository
{
    Task AddAsync(Board board, CancellationToken cancellationToken = default);
}
