import { UserStatus } from '@collega/domain/enums'
import type { Clock, CurrentUserContext } from '../common/index.js'
import { NotFoundError, normalizePageRequest, UnauthorizedError } from '../common/index.js'
import type { InboxItem, InboxPage, InboxQuery, UnreadCountResult } from './models.js'
import type { InboxRow, NotificationInboxRepository } from './ports.js'

/** The inbox lists and counts the last 90 days; older rows are kept, not shown (feature rule 26). */
export const INBOX_WINDOW_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The caller's own notifications (SPEC/20-feature-idea-following.md rules 20-32,
 * SPEC/contracts/notifications.md). Every operation is keyed on `currentUser.userId`, which under
 * View As is the target - so acting as someone reads and marks their inbox with no special case
 * (rules 30-31). A Site Admin acting as themselves is never a recipient, so they get an empty page.
 *
 * Read state is not audited (rule 31, Q7), and marking read leaves the idea alone.
 */
export class NotificationInboxService {
  constructor(
    private readonly inbox: NotificationInboxRepository,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  async list(query: InboxQuery): Promise<InboxPage> {
    const recipientUserId = this.requireAuthenticatedUserId()
    const page = await this.inbox.listForRecipient({
      recipientUserId,
      sinceUtc: this.windowStart(),
      page: normalizePageRequest({
        ...(query.page !== null ? { page: query.page } : {}),
        ...(query.pageSize !== null ? { pageSize: query.pageSize } : {}),
      }),
    })
    return {
      items: page.items.map(toInboxItem),
      page: page.page,
      pageSize: page.pageSize,
      totalCount: page.totalCount,
      sortBy: 'occurredAt',
      sortDirection: 'desc',
    }
  }

  async unreadCount(): Promise<UnreadCountResult> {
    const recipientUserId = this.requireAuthenticatedUserId()
    return { unreadCount: await this.inbox.countUnread(recipientUserId, this.windowStart()) }
  }

  async markRead(notificationId: string): Promise<void> {
    const recipientUserId = this.requireAuthenticatedUserId()
    const found = await this.inbox.markRead(notificationId, recipientUserId, this.clock.now())
    if (!found) {
      throw new NotFoundError('Notification not found.')
    }
  }

  /** Inside or outside the window alike, every unread row gets the same instant. */
  async markAllRead(): Promise<void> {
    const recipientUserId = this.requireAuthenticatedUserId()
    await this.inbox.markAllRead(recipientUserId, this.clock.now())
  }

  private windowStart(): Date {
    return new Date(this.clock.now().getTime() - INBOX_WINDOW_DAYS * DAY_MS)
  }

  private requireAuthenticatedUserId(): string {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.userId
  }
}

function toInboxItem(row: InboxRow): InboxItem {
  return {
    notificationId: row.id,
    eventType: row.eventType,
    ideaId: row.ideaId,
    ideaTitle: row.ideaTitle,
    link: row.link,
    actor: row.actor
      ? {
          userId: row.actor.userId,
          firstName: row.actor.firstName,
          lastName: row.actor.lastName,
          displayName: `${row.actor.firstName} ${row.actor.lastName}`.trim(),
          isActive: row.actor.status === UserStatus.Active,
        }
      : null,
    statusName: row.statusName,
    occurredAtUtc: row.occurredAtUtc,
    readAtUtc: row.readAtUtc,
  }
}
