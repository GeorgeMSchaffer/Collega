// Satisfies `NotificationEventRepository` (notifications/ports.ts). Pure persistence, one insert
// per call - the business logic (self-notification suppression, id generation, recipient
// resolution) lives in `NotificationService` (Application), not here.
//
// COMMITS IMMEDIATELY, like `audit-event.repository.ts` and `tag.repository.ts`'s `getOrCreate` -
// NOT through `PrismaUnitOfWork`. This mirrors the .NET `EfNotificationEventWriter.WriteAsync`,
// which calls `AddAsync` then its own `SaveChangesAsync` rather than relying on the caller's
// later commit. Staging into the buffer instead is what silently discarded every notification
// event: `PrismaUnitOfWork.saveChanges()` clears the buffer, and every calling service stages its
// notifications AFTER the `saveChanges()` that accompanies the mutation, so nothing ever flushed
// them (`grep -rn "saveChanges" apps/` finds no request-end flush either). Committing here makes
// the call order irrelevant, which is the same argument the audit writer's header makes - and it
// is what the original did. Do not "fix" this back into the unit of work.

import type { NotificationEventRepository } from '@collega/application/notifications'
import type { NotificationEvent } from '@collega/domain/notifications'
import type { PrismaClient } from '../persistence/prisma-client.js'

export class PrismaNotificationEventRepository implements NotificationEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(event: NotificationEvent): Promise<void> {
    await this.prisma.notification_events.create({
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
    })
  }
}
