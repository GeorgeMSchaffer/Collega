using Collega.Application.Abstractions;
using Collega.Application.Exceptions;
using Collega.Domain.Enums;
using Collega.Domain.Users;

namespace Collega.Application.Collaboration;

/// <inheritdoc />
public sealed class MentionResolver : IMentionResolver
{
    private readonly IUserRepository _userRepository;

    public MentionResolver(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<IReadOnlyList<Guid>> ResolveAsync(
        Guid organizationId,
        IReadOnlyCollection<string>? mentionEmails,
        string fieldName,
        CancellationToken cancellationToken = default)
    {
        if (mentionEmails is null || mentionEmails.Count == 0)
        {
            return Array.Empty<Guid>();
        }

        var resolved = new List<Guid>();
        var errors = new List<string>();

        // Distinct by normalized email so the same person mentioned twice resolves once.
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var raw in mentionEmails)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                continue;
            }

            var normalized = EmailNormalizer.Normalize(raw);
            if (!seen.Add(normalized))
            {
                continue;
            }

            var user = await _userRepository.GetByNormalizedEmailAsync(normalized, cancellationToken);
            if (user is null
                || user.OrganizationId != organizationId
                || user.Role == Role.SiteAdmin
                || user.Status != UserStatus.Active)
            {
                errors.Add($"Mention '{raw.Trim()}' could not be resolved to a user in your organization.");
                continue;
            }

            resolved.Add(user.Id);
        }

        if (errors.Count > 0)
        {
            throw new ValidationAppException(fieldName, errors);
        }

        return resolved;
    }
}
