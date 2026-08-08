using Collega.Domain.Common;

namespace Collega.Domain.IdeaFields;

/// <summary>
/// Organization-scoped Idea Type option (SPEC/30-Contracts.md "Idea Field Option Contracts",
/// SPEC/20-feature-boards-and-statuses.md). Options are ordered by <see cref="SortOrder"/>; the
/// first active option is the default for new ideas. Soft-deletion preserves existing idea
/// references (their prior label stays readable with an archived indicator). Every organization must
/// retain at least one active Idea Type.
/// </summary>
public sealed class IdeaType : AuditableEntityBase
{
    public const int NameMaxLength = 100;

    /// <summary>Every organization must keep at least this many active options.</summary>
    public const int MinimumActivePerOrganization = 1;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public int SortOrder { get; private set; }
    public bool IsDeleted { get; private set; }

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
}
