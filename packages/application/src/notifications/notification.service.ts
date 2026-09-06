// Notification use cases (SPEC/20-feature-notifications.md). Notifications is a write-only,
// side-effect feature invoked from other services' mutations (Comments here; Ideas keeps its own
// local port, per the cross-partition convention) - it has no controller-facing surface of its
// own, matching .NET's `INotificationEventWriter` having no companion "service".

import { randomUUID } from 'node:crypto'
import { createNotificationEvent } from '@collega/domain/notifications'
import type { Clock } from '../common/index.js'
import type { NotificationInput, NotificationWriter } from './models.js'
import type { NotificationEventRepository } from './ports.js'

/**
 * `NotificationWriter` backed by `NotificationEventRepository`. Self-notification suppression and
 * the domain factory call live here (Application), not in the persistence port - .NET's
 * `EfNotificationEventWriter` did both in Infrastructure, but this conversion keeps business
 * rules out of that layer (SPEC/50-typescript-migration.md section 3).
 */
export class NotificationService implements NotificationWriter {
  constructor(
    private readonly notifications: NotificationEventRepository,
    private readonly clock: Clock,
  ) {}

  async notify(input: NotificationInput): Promise<void> {
    if (input.recipientUserId.length === 0 || input.recipientUserId === input.actorUserId) {
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
      occurredAtUtc: this.clock.now(),
    })

    await this.notifications.add(event)
  }
}
