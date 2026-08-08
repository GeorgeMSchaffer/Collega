using Collega.Domain.Notifications;

namespace Collega.Application.Abstractions;

/// <summary>
/// Persists notification events for collaboration triggers (SPEC/20-feature-notifications.md).
/// Parallel to <see cref="IAuditEventWriter"/>: events are recorded only — no email, queue, or
/// outbound HTTP delivery exists in MVP (T039).
/// </summary>
public interface INotificationEventWriter
{
    /// <summary>
    /// Writes one notification event for a single recipient. Self-notifications are suppressed:
    /// nothing is written when <paramref name="recipientUserId"/> equals
    /// <paramref name="actorUserId"/> or is empty. The canonical <c>/ideas/{ideaId}/edit</c> link is
    /// persisted on the row (T038).
    /// </summary>
    Task WriteAsync(
        NotificationEventType eventType,
        Guid organizationId,
        Guid boardId,
        Guid ideaId,
        string ideaTitle,
        Guid actorUserId,
        Guid recipientUserId,
        CancellationToken cancellationToken = default);
}
