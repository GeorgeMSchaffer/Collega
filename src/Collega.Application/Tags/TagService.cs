using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Enums;
using Collega.Domain.Tags;

namespace Collega.Application.Tags;

/// <inheritdoc />
public sealed class TagService : ITagService
{
    private const int MinSearchLength = 2;
    private const int DefaultLimit = 10;
    private const int MaxLimit = 50;

    private readonly ITagRepository _tagRepository;
    private readonly ICurrentUserContext _currentUser;

    public TagService(ITagRepository tagRepository, ICurrentUserContext currentUser)
    {
        _tagRepository = tagRepository;
        _currentUser = currentUser;
    }

    public async Task<IReadOnlyList<string>> SuggestAsync(Guid organizationId, string search, int? limit, CancellationToken cancellationToken = default)
    {
        EnsureOrganizationScope(organizationId);

        var prefix = Tag.Normalize(search);
        if (prefix.Length < MinSearchLength)
        {
            return Array.Empty<string>();
        }

        var effectiveLimit = Math.Clamp(limit ?? DefaultLimit, 1, MaxLimit);
        return await _tagRepository.SearchByPrefixAsync(organizationId, prefix, effectiveLimit, cancellationToken);
    }

    private void EnsureOrganizationScope(Guid organizationId)
    {
        if (!_currentUser.IsAuthenticated || _currentUser.Role is null)
        {
            throw new UnauthorizedAppException("Caller identity could not be resolved.");
        }

        if (_currentUser.Role == Role.SiteAdmin)
        {
            return;
        }

        if (_currentUser.OrganizationId != organizationId)
        {
            throw new NotFoundAppException("Organization not found.");
        }
    }
}
