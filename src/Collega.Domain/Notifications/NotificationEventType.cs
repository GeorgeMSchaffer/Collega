namespace Collega.Domain.Notifications;

/// <summary>
/// The collaboration events that produce a persisted <see cref="NotificationEvent"/>
/// (SPEC/20-feature-notifications.md "Notification Triggers"). Email delivery is deferred; these
/// events are recorded only.
/// </summary>
/// <remarks>
/// These names follow <c>SPEC/20-feature-notifications.md</c> (the primary spec for this slice),
/// which defines the enum as <c>IdeaMention, CommentMention, CommentAdded, IdeaStatusChanged</c>.
/// <c>SPEC/30-Contracts.md</c> lists slightly different labels
/// (<c>IdeaMentioned, CommentMentioned, IdeaCommented, IdeaStatusChanged</c>) for the same concepts;
/// the discrepancy is flagged for reconciliation. Because MVP does not expose a read/query endpoint
/// for these events, the serialized string is internal only and affects no contract test.
/// </remarks>
public enum NotificationEventType
{
    /// <summary>A user was @mentioned in an idea body.</summary>
    IdeaMention = 0,

    /// <summary>A user was @mentioned in a comment.</summary>
    CommentMention = 1,

    /// <summary>A comment was added to an idea (notifies the idea author and assignees).</summary>
    CommentAdded = 2,

    /// <summary>An idea's status changed (notifies the idea author and assignees).</summary>
    IdeaStatusChanged = 3
}
