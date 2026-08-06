using Collega.Domain.Enums;

namespace Collega.Application.Abstractions;

public interface ICurrentUserContext
{
    bool IsAuthenticated { get; }
    Guid? UserId { get; }
    Guid? OrganizationId { get; }
    Role? Role { get; }
}
