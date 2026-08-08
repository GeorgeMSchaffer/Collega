using Collega.Application.Abstractions;
using Collega.Domain.Notifications;
using Collega.Infrastructure.Persistence;

namespace Collega.Infrastructure.Notifications;

/// <summary>
/// EF-backed <see cref="INotificationEventWriter"/>. Inserts one <see cref="NotificationEvent"/> row
/// per recipient (no batching in MVP) and persists it immediately, mirroring
/// <see cref="EfAuditEventWriter"/>. Contains no SMTP, email client, queue, or outbound HTTP — the
/// notification path is purely a database write (SPEC/20-feature-notifications.md, T039).
/// </summary>
public sealed class EfNotificationEventWriter : INotificationEventWriter
{
    private readonly CollegaDbContext _dbContext;
    private readonly IClock _clock;

    public EfNotificationEventWriter(CollegaDbContext dbContext, IClock clock)
    {
        _dbContext = dbContext;
        _clock = clock;
    }

    public async Task WriteAsync(
        NotificationEventType eventType,
        Guid organizationId,
        Guid boardId,
        Guid ideaId,
        string ideaTitle,
        Guid actorUserId,
        Guid recipientUserId,
        CancellationToken cancellationToken = default)
    {
        // Self-notifications are suppressed (SPEC/20-feature-notifications.md "Recipients").
        if (recipientUserId == Guid.Empty || recipientUserId == actorUserId)
        {
            return;
        }

        var notificationEvent = NotificationEvent.Create(
            eventType,
            organizationId,
            boardId,
            ideaId,
            ideaTitle,
            actorUserId,
            recipientUserId,
            _clock.UtcNow);

        await _dbContext.NotificationEvents.AddAsync(notificationEvent, cancellationToken).ConfigureAwait(false);
        await _dbContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
