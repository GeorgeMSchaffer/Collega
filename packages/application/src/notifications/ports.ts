import type { NotificationEventType, UserStatus } from '@collega/domain/enums'
import type { NotificationEvent } from '@collega/domain/notifications'
import type { Page, PageRequest } from '../common/index.js'

/** Pure persistence: one insert per call, no batching in MVP - mirrors .NET's
 * `EfNotificationEventWriter`, minus the business logic that lives in `NotificationService`
 * instead (SPEC/50-typescript-migration.md section 3: Infrastructure holds no business rules). */
export interface NotificationEventRepository {
  add(event: NotificationEvent): Promise<void>
}

/** The recipient's account status, read when an event is written. `null` when no user row exists. */
export interface NotificationRecipientsPort {
  getById(userId: string): Promise<{ readonly status: UserStatus } | null>
}

export type InboxActor = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly status: UserStatus
}

export type InboxRow = {
  readonly id: string
  readonly eventType: NotificationEventType
  readonly ideaId: string
  readonly ideaTitle: string
  readonly link: string
  /** `null` when no user row exists for `actor_user_id`, which has no foreign key. */
  readonly actor: InboxActor | null
  readonly statusName: string | null
  /** The idea's current board, read at query time; `null` when it cannot be resolved. */
  readonly boardName: string | null
  readonly occurredAtUtc: Date
  readonly readAtUtc: Date | null
}

/**
 * The reading side of `notification_events`, always for one recipient. `sinceUtc` is the start of
 * the window; every read also leaves out a soft-deleted idea's notifications (feature rule 27).
 * The window is the caller's to choose and the repository's to apply, so the list and the count
 * cannot disagree about which rows exist.
 */
export interface NotificationInboxRepository {
  /** Newest first by `occurred_at_utc`, then by id. */
  listForRecipient(query: {
    readonly recipientUserId: string
    readonly sinceUtc: Date
    readonly page: PageRequest
  }): Promise<Page<InboxRow>>

  countUnread(recipientUserId: string, sinceUtc: Date): Promise<number>

  /**
   * Sets `read_at_utc` on one of the recipient's notifications if it is unread. Returns false when
   * no notification with that id belongs to the recipient. Commits immediately.
   */
  markRead(notificationId: string, recipientUserId: string, readAtUtc: Date): Promise<boolean>

  /** Sets `read_at_utc` on every unread notification of the recipient's. Commits immediately. */
  markAllRead(recipientUserId: string, readAtUtc: Date): Promise<void>
}
