using Collega.Domain.Common;

namespace Collega.Domain.Auditing;

public sealed class AuditEvent : EntityBase
{
    public Guid? OrganizationId { get; private set; }
    /// <summary>
    /// Who really performed the action. While a View As session is active this stays the **real
    /// administrator**, never the user being acted as — so an audit row can never read as though the
    /// target did it themselves (SPEC/20-feature-view-as.md rule 14).
    /// </summary>
    public Guid? ActorUserId { get; private set; }

    /// <summary>
    /// The impersonated user, when the action was performed through View As; null otherwise. Kept as
    /// its own column rather than inside <see cref="MetadataJson"/> so "what was done on behalf of
    /// whom" stays queryable — this is an accountability record, not a debugging note.
    /// </summary>
    public Guid? OnBehalfOfUserId { get; private set; }
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
        string? metadataJson = null,
        Guid? onBehalfOfUserId = null)
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
            MetadataJson = metadataJson,
            OnBehalfOfUserId = onBehalfOfUserId
        };
    }
}
