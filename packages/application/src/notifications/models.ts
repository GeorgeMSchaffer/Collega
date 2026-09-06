import type { NotificationEventType } from '@collega/domain/enums'

export type NotificationInput = {
  readonly eventType: NotificationEventType
  readonly organizationId: string
  readonly boardId: string
  readonly ideaId: string
  readonly ideaTitle: string
  readonly actorUserId: string
  readonly recipientUserId: string
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
