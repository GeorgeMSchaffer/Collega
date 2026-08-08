using Collega.Domain.Common;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// Organization-scoped Business Impact option (SPEC/30-Contracts.md "Idea Field Option Contracts").
/// Like <see cref="IdeaType"/> but carries an editable <c>#RRGGBB</c> <see cref="Color"/> used on the
/// idea card chip. Ordered by <see cref="SortOrder"/>; first active option is the default; every
/// organization must retain at least one active Business Impact.
/// </summary>
public sealed class BusinessImpact : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int ColorMaxLength = 20;
    public const int MinimumActivePerOrganization = 1;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Color { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; private set; }

    private BusinessImpact()
    {
    }

    public static BusinessImpact Create(Guid organizationId, string name, string color, int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(color))
        {
            throw new ArgumentException("Color is required.", nameof(color));
        }

        var option = new BusinessImpact
        {
            OrganizationId = organizationId,
            Name = name.Trim(),
            Color = color.Trim(),
            SortOrder = sortOrder
        };
        option.MarkCreated(nowUtc, actorUserId);
        return option;
    }

    public void Update(string name, string color, int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted Business Impact cannot be updated.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(color))
        {
            throw new ArgumentException("Color is required.", nameof(color));
        }

        Name = name.Trim();
        Color = color.Trim();
        SortOrder = sortOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    public void SetSortOrder(int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        SortOrder = sortOrder;
        MarkUpdated(nowUtc, actorUserId);
    }

    public void SoftDelete(DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            return;
        }

        IsDeleted = true;
        MarkUpdated(nowUtc, actorUserId);
    }
}
