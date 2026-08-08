using Collega.Domain.Common;

namespace Collega.Domain.Tags;

/// <summary>
/// Reusable organization-scoped tag (SPEC/20-feature-ideas-and-engagement.md "Tags"). Tags are
/// trimmed, compared case-insensitively via <see cref="NormalizedName"/>, and unique within an
/// organization. Concurrent creation of the same normalized name is merged into a single tag by the
/// application layer.
/// </summary>
public sealed class Tag : AuditableEntityBase
{
    public const int NameMaxLength = 100;

    public Guid OrganizationId { get; private set; }

    /// <summary>Display value as first entered (trimmed).</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Lower-cased, trimmed form used for uniqueness and prefix matching.</summary>
    public string NormalizedName { get; private set; } = string.Empty;

    private Tag()
    {
    }

    public static Tag Create(Guid organizationId, string name, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        var normalized = Normalize(name);
        if (string.IsNullOrEmpty(normalized))
        {
            throw new ArgumentException("Tag name is required.", nameof(name));
        }

        var tag = new Tag
        {
            OrganizationId = organizationId,
            Name = name.Trim(),
            NormalizedName = normalized
        };
        tag.MarkCreated(nowUtc, actorUserId);
        return tag;
    }

    /// <summary>Trims surrounding whitespace and lower-cases for case-insensitive comparison.</summary>
    public static string Normalize(string? name) => name?.Trim().ToLowerInvariant() ?? string.Empty;
}
