using Collega.Domain.Common;

namespace Collega.Domain.Auditing;

public sealed class AuditEvent : EntityBase
{
    public Guid? OrganizationId { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public Guid? EntityId { get; private set; }
    public string Message { get; private set; } = string.Empty;
    public string? MetadataJson { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }

    private AuditEvent()
    {
    }

    public static AuditEvent Create(
        string eventType,
        string entityType,
        string message,
        DateTime occurredAtUtc,
        Guid? organizationId = null,
        Guid? actorUserId = null,
        Guid? entityId = null,
        string? metadataJson = null)
    {
        if (string.IsNullOrWhiteSpace(eventType))
        {
            throw new ArgumentException("Event type is required.", nameof(eventType));
        }

        if (string.IsNullOrWhiteSpace(entityType))
        {
            throw new ArgumentException("Entity type is required.", nameof(entityType));
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException("Message is required.", nameof(message));
        }

        return new AuditEvent
        {
            EventType = eventType,
            EntityType = entityType,
            Message = message,
            OccurredAtUtc = occurredAtUtc,
            OrganizationId = organizationId,
            ActorUserId = actorUserId,
            EntityId = entityId,
            MetadataJson = metadataJson
        };
    }
}
