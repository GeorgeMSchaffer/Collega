// Satisfies `NotificationEventRepository` (notifications/ports.ts). Pure persistence, one insert
// per call - the business logic (self-notification suppression, id generation, recipient
// resolution) lives in `NotificationService` (Application), not here.

import type { NotificationEventRepository } from '@collega/application/notifications'
import type { NotificationEvent } from '@collega/domain/notifications'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

export class PrismaNotificationEventRepository implements NotificationEventRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  async add(event: NotificationEvent): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.notification_events.create({
        data: {
          id: event.id,
          event_type: event.eventType,
          organization_id: event.organizationId,
          board_id: event.boardId,
          idea_id: event.ideaId,
          idea_title: event.ideaTitle,
          actor_user_id: event.actorUserId,
          recipient_user_id: event.recipientUserId,
          link: event.link,
          occurred_at_utc: event.occurredAtUtc,
        },
      }),
    )
  }
}
