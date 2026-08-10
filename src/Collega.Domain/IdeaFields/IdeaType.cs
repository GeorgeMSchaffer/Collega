using System.Text.RegularExpressions;
using Collega.Domain.Common;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// Organization-scoped Idea Type option (SPEC/30-Contracts.md "Idea Field Option Contracts",
/// SPEC/20-feature-boards-and-statuses.md). Options are ordered by <see cref="SortOrder"/>; the
/// first active option is the default for new ideas. Soft-deletion preserves existing idea
/// references (their prior label stays readable with an archived indicator). Every organization must
/// retain at least one active Idea Type.
/// </summary>
/// <remarks>
/// A type also owns an optional badge appearance (<see cref="ColorHex"/> + <see cref="Icon"/>) and a
/// <see cref="FieldMode"/> that governs which User-Defined Fields its ideas resolve to
/// (SPEC/20-feature-idea-type-fields.md).
/// </remarks>
public sealed partial class IdeaType : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int ColorHexLength = 7;
    public const int IconMaxLength = 64;

    /// <summary>Every organization must keep at least this many active options.</summary>
    public const int MinimumActivePerOrganization = 1;

    private readonly List<IdeaTypeField> _fields = new();

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; private set; }

    /// <summary>Badge color as <c>#RRGGBB</c>; null falls back to a neutral badge.</summary>
    public string? ColorHex { get; private set; }

    /// <summary>Short badge token (emoji or icon key); null renders no icon.</summary>
    public string? Icon { get; private set; }

    /// <summary>Which fields this type's ideas resolve to (SPEC/20-feature-idea-type-fields.md).</summary>
    public IdeaTypeFieldMode FieldMode { get; private set; }

    /// <summary>The type's curated field selection; only consulted when <see cref="FieldMode"/> is <c>Curated</c>.</summary>
    public IReadOnlyList<IdeaTypeField> Fields => _fields;

    private IdeaType()
    {
    }

    public static IdeaType Create(Guid organizationId, string name, int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        var option = new IdeaType
        {
            OrganizationId = organizationId,
            Name = name.Trim(),
            SortOrder = sortOrder
        };
        option.MarkCreated(nowUtc, actorUserId);
        return option;
    }

    public void Update(string name, int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted Idea Type cannot be updated.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        Name = name.Trim();
        SortOrder = sortOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    public void SetSortOrder(int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        SortOrder = sortOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Soft-deletes the option so existing idea references stay valid. Idempotent.</summary>
    public void SoftDelete(DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            return;
        }

        IsDeleted = true;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Sets or clears the badge appearance. <paramref name="colorHex"/> must be <c>#RRGGBB</c> when non-null;
    /// either argument may be null to clear that part of the badge.
    /// </summary>
    public void SetAppearance(string? colorHex, string? icon, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted Idea Type cannot be updated.");
        }

        var normalizedColor = string.IsNullOrWhiteSpace(colorHex) ? null : colorHex.Trim();
        if (normalizedColor is not null && !HexColorRegex().IsMatch(normalizedColor))
        {
            throw new ArgumentException("Color must be a valid #RRGGBB hex color.", nameof(colorHex));
        }

        var normalizedIcon = string.IsNullOrWhiteSpace(icon) ? null : icon.Trim();
        if (normalizedIcon is not null && normalizedIcon.Length > IconMaxLength)
        {
            throw new ArgumentException($"Icon must be {IconMaxLength} characters or fewer.", nameof(icon));
        }

        ColorHex = normalizedColor;
        Icon = normalizedIcon;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>
    /// Replaces the type's field selection and switches it to <see cref="IdeaTypeFieldMode.Curated"/>. A
    /// field appears at most once; duplicates are rejected. An empty list is equivalent to
    /// <see cref="ClearFieldSelection"/>. Callers validate that each field is active and in-org first.
    /// </summary>
    public void SetFieldSelection(IReadOnlyList<IdeaTypeFieldInput> links, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted Idea Type cannot be updated.");
        }

        ArgumentNullException.ThrowIfNull(links);

        if (links.Count == 0)
        {
            ClearFieldSelection(nowUtc, actorUserId);
            return;
        }

        var seen = new HashSet<Guid>();
        var replacement = new List<IdeaTypeField>(links.Count);
        foreach (var link in links)
        {
            if (!seen.Add(link.FieldDefinitionId))
            {
                throw new InvalidOperationException($"Field '{link.FieldDefinitionId}' is selected more than once.");
            }

            replacement.Add(new IdeaTypeField(Id, link.FieldDefinitionId, link.DisplayOrder, link.IsRequired));
        }

        _fields.Clear();
        _fields.AddRange(replacement);
        FieldMode = IdeaTypeFieldMode.Curated;
        MarkUpdated(nowUtc, actorUserId);
    }

    /// <summary>Empties the field selection and returns the type to <see cref="IdeaTypeFieldMode.AllActiveFields"/>.</summary>
    public void ClearFieldSelection(DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted Idea Type cannot be updated.");
        }

        _fields.Clear();
        FieldMode = IdeaTypeFieldMode.AllActiveFields;
        MarkUpdated(nowUtc, actorUserId);
    }

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColorRegex();
}
