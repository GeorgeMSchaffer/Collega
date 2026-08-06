namespace Collega.Domain.Common;

public abstract class AuditableEntityBase : EntityBase
{
    public DateTime CreatedAtUtc { get; protected set; }
    public DateTime UpdatedAtUtc { get; protected set; }
    public Guid? CreatedByUserId { get; protected set; }
    public Guid? UpdatedByUserId { get; protected set; }

    protected void MarkCreated(DateTime nowUtc, Guid? actorUserId)
    {
        CreatedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        CreatedByUserId = actorUserId;
        UpdatedByUserId = actorUserId;
    }

    protected void MarkUpdated(DateTime nowUtc, Guid? actorUserId)
    {
        UpdatedAtUtc = nowUtc;
        UpdatedByUserId = actorUserId;
    }
}
