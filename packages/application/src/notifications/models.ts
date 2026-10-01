import type { NotificationEventType } from '@collega/domain/enums'
import type { Page } from '../common/index.js'

export type NotificationInput = {
  readonly eventType: NotificationEventType
  readonly organizationId: string
  readonly boardId: string
  readonly ideaId: string
  readonly ideaTitle: string
  readonly actorUserId: string
  readonly recipientUserId: string
  /** The new status's name, for `IdeaStatusChanged` and `IssueDeliveryStatusChanged` only. */
  readonly statusName?: string | null
}

/**
 * Persists notification events for collaboration triggers (SPEC/20-feature-notifications.md).
 * Parallel to the kernel's `AuditEventWriter`: events are recorded only - no email, queue, or
 * outbound HTTP delivery exists in MVP.
 *
 * Consumers (Comments, and Ideas' own local `NotificationsPort`) depend on this shape rather than
 * on `NotificationEventRepository` directly, so the self-notification-suppression rule below
 * cannot be bypassed by a caller that only has persistence in mind.
 */
export interface NotificationWriter {
  /**
   * Writes one notification event for a single recipient. Self-notifications are suppressed:
   * nothing is written when `recipientUserId` equals `actorUserId` or is empty. The canonical
   * idea link is persisted on the row.
   */
  notify(input: NotificationInput): Promise<void>
}

// Inbox (SPEC/20-feature-idea-following.md rules 20-32, SPEC/contracts/notifications.md) ---------

/** The board-list assignee item shape, which the inbox contract names for `actor`. */
export type NotificationActorDto = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly displayName: string
  readonly isActive: boolean
}

export type InboxItem = {
  readonly notificationId: string
  readonly eventType: NotificationEventType
  readonly ideaId: string
  readonly ideaTitle: string
  readonly link: string
  readonly actor: NotificationActorDto | null
  readonly statusName: string | null
  readonly occurredAtUtc: Date
  readonly readAtUtc: Date | null
}

export type InboxQuery = {
  readonly page: number | null
  readonly pageSize: number | null
}

export type InboxPage = Page<InboxItem> & {
  readonly sortBy: 'occurredAt'
  readonly sortDirection: 'desc'
}

export type UnreadCountResult = {
  readonly unreadCount: number
}
