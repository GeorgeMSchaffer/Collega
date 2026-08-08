using Collega.Domain.Common;

namespace Collega.Domain.Notifications;

/// <summary>
/// A persisted notification event (SPEC/20-feature-notifications.md). One row is written per
/// recipient per trigger. Outbound email delivery is explicitly deferred outside MVP — these rows
/// are recorded for later processing and are never delivered here (T039).
/// </summary>
/// <remarks>
/// The canonical idea link is persisted on every row as <c>/ideas/{ideaId}/edit</c> (T038), the
/// single-idea edit route used by the Ideas page. This supersedes the earlier
/// <c>/org/{organizationId}/boards/{boardId}/ideas/{ideaId}</c> pattern.
/// </remarks>
public sealed class NotificationEvent : EntityBase
{
    public NotificationEventType EventType { get; private set; }
    public Guid OrganizationId { get; private set; }
    public Guid BoardId { get; private set; }
    public Guid IdeaId { get; private set; }
    public string IdeaTitle { get; private set; } = string.Empty;
    public Guid ActorUserId { get; private set; }
    public Guid RecipientUserId { get; private set; }
    public string Link { get; private set; } = string.Empty;
    public DateTime OccurredAtUtc { get; private set; }

    private NotificationEvent()
    {
    }

    /// <summary>The canonical idea link persisted on every notification event (T038).</summary>
    public static string BuildIdeaLink(Guid ideaId) => $"/ideas/{ideaId}/edit";

    public static NotificationEvent Create(
        NotificationEventType eventType,
        Guid organizationId,
        Guid boardId,
        Guid ideaId,
        string ideaTitle,
        Guid actorUserId,
        Guid recipientUserId,
        DateTime occurredAtUtc)
    {
        if (organizationId == Guid.Empty)
        {
            throw new ArgumentException("Organization id is required.", nameof(organizationId));
        }

        if (ideaId == Guid.Empty)
        {
            throw new ArgumentException("Idea id is required.", nameof(ideaId));
        }

        if (recipientUserId == Guid.Empty)
        {
            throw new ArgumentException("Recipient id is required.", nameof(recipientUserId));
        }

        return new NotificationEvent
        {
            EventType = eventType,
            OrganizationId = organizationId,
            BoardId = boardId,
            IdeaId = ideaId,
            IdeaTitle = ideaTitle ?? string.Empty,
            ActorUserId = actorUserId,
            RecipientUserId = recipientUserId,
            Link = BuildIdeaLink(ideaId),
            OccurredAtUtc = occurredAtUtc
        };
    }
}
