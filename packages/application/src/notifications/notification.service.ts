// The notification writer (SPEC/20-feature-notifications.md): the side effect other services'
// mutations call - Comments, Ideas and Issue tasks, each through its own local port. Reading and
// marking notifications is the inbox's job, in `notification-inbox.service.ts`.

import { randomUUID } from 'node:crypto'
import { UserStatus } from '@collega/domain/enums'
import { createNotificationEvent } from '@collega/domain/notifications'
import type { Clock } from '../common/index.js'
import type { NotificationInput, NotificationWriter } from './models.js'
import type { NotificationEventRepository, NotificationRecipientsPort } from './ports.js'

/**
 * `NotificationWriter` backed by `NotificationEventRepository`. Self-notification suppression and
 * the domain factory call live here (Application), not in the persistence port - .NET's
 * `EfNotificationEventWriter` did both in Infrastructure, but this conversion keeps business
 * rules out of that layer (SPEC/50-typescript-migration.md section 3).
 */
export class NotificationService implements NotificationWriter {
  constructor(
    private readonly notifications: NotificationEventRepository,
    private readonly recipients: NotificationRecipientsPort,
    private readonly clock: Clock,
  ) {}

  async notify(input: NotificationInput): Promise<void> {
    if (input.recipientUserId.length === 0 || input.recipientUserId === input.actorUserId) {
      return
    }
    // A deactivated account is notified of nothing; its follow rows stay, so reactivating it
    // resumes notifications from then on (SPEC/20-feature-idea-following.md rule 19a).
    const recipient = await this.recipients.getById(input.recipientUserId)
    if (recipient?.status !== UserStatus.Active) {
      return
    }

    const event = createNotificationEvent({
      id: randomUUID(),
      eventType: input.eventType,
      organizationId: input.organizationId,
      boardId: input.boardId,
      ideaId: input.ideaId,
      ideaTitle: input.ideaTitle,
      actorUserId: input.actorUserId,
      recipientUserId: input.recipientUserId,
      statusName: input.statusName ?? null,
      occurredAtUtc: this.clock.now(),
    })

    await this.notifications.add(event)
  }
}
