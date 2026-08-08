using Collega.Domain.Common;

namespace Collega.Domain.Statuses;

/// <summary>
/// Organization-scoped workflow status (SPEC/20-feature-boards-and-statuses.md "Status Rules").
/// Provisioned as the canonical default set when an organization is created; full status management
/// (rename, recolor, reorder, soft-delete with the 2-active-status floor) is the Workflow
/// Configuration slice's responsibility and is only partially modelled here.
/// </summary>
public sealed class Status : AuditableEntityBase
{
    public const int NameMaxLength = 100;
    public const int ColorMaxLength = 20;

    /// <summary>
    /// An organization must retain at least this many active statuses at all times
    /// (SPEC/20-feature-boards-and-statuses.md "Status Rules" #7) so a board's own 2-swimlane
    /// minimum can always be satisfied.
    /// </summary>
    public const int MinimumActiveStatusesPerOrganization = 2;

    public Guid OrganizationId { get; private set; }
    public string Name { get; private set; } = string.Empty;

    /// <summary>Hex/CSS color for the swimlane dot and idea-card status chip (rule #9).</summary>
    public string Color { get; private set; } = string.Empty;

    /// <summary>Organization-level catalog order, distinct from a board's swimlane order (rule #10).</summary>
    public int SortOrder { get; private set; }

    public bool IsDeleted { get; private set; }

    private Status()
    {
    }

    public static Status Create(
        Guid organizationId,
        string name,
        string color,
        int sortOrder,
        DateTime nowUtc,
        Guid? actorUserId = null)
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

        var status = new Status
        {
            OrganizationId = organizationId,
            Name = name.Trim(),
            Color = color.Trim(),
            SortOrder = sortOrder
        };
        status.MarkCreated(nowUtc, actorUserId);
        return status;
    }

    /// <summary>Renames, recolors, and reorders an active status (rules #9-10).</summary>
    public void Update(string name, string color, int sortOrder, DateTime nowUtc, Guid? actorUserId = null)
    {
        if (IsDeleted)
        {
            throw new InvalidOperationException("A deleted status cannot be updated.");
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

    /// <summary>
    /// Soft-deletes the status so existing board and idea references stay valid (rule #5). Idempotent.
    /// The org-wide 2-active-status floor (#7) and the no-active-board-reference guard (#6) are
    /// enforced by the Application layer before this is called.
    /// </summary>
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
