using Collega.Application.Common;

namespace Collega.Application.Users;

public interface IUserService
{
    Task<PagedResult<UserListItem>> ListByOrganizationAsync(Guid organizationId, UserListQuery query, CancellationToken cancellationToken = default);

    Task<CreateUserResult> CreateAsync(Guid organizationId, CreateUserCommand command, CancellationToken cancellationToken = default);

    Task<UserDetail> GetByIdAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<UserDetail> UpdateAsync(Guid userId, UpdateUserCommand command, CancellationToken cancellationToken = default);
}
