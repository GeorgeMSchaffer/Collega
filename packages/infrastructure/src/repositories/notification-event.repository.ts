// Satisfies `NotificationEventRepository` and `NotificationInboxRepository`
// (notifications/ports.ts). Pure persistence - the business logic (self-notification suppression,
// id generation, recipient resolution, the inbox window) lives in Application, not here.
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
//
// The inbox's two writes commit immediately too: each is one statement, and `markRead` must
// report whether the row was the caller's, which a staged write cannot.

import type { Page, PageRequest } from '@collega/application/common'
import type {
  InboxRow,
  NotificationEventRepository,
  NotificationInboxRepository,
} from '@collega/application/notifications'
import type { NotificationEventType, UserStatus } from '@collega/domain/enums'
import type { NotificationEvent } from '@collega/domain/notifications'
import { Prisma } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'

type InboxSqlRow = {
  id: string
  event_type: string
  idea_id: string
  idea_title: string
  link: string
  status_name: string | null
  board_name: string | null
  occurred_at_utc: Date
  read_at_utc: Date | null
  actor_id: string | null
  actor_first_name: string | null
  actor_last_name: string | null
  actor_status: string | null
}

/** The recipient's rows inside the window, leaving out a soft-deleted idea's (feature rule 27).
 * `notification_events.idea_id` has no foreign key, so a row whose idea is gone is left out too. */
function inboxWhere(recipientUserId: string, sinceUtc: Date): Prisma.Sql {
  return Prisma.sql`
    notification.recipient_user_id = ${recipientUserId}::uuid
    AND notification.occurred_at_utc >= ${sinceUtc}
    AND EXISTS (
      SELECT 1 FROM ideas AS idea WHERE idea.id = notification.idea_id AND idea.is_deleted = FALSE
    )`
}

export class PrismaNotificationEventRepository
  implements NotificationEventRepository, NotificationInboxRepository
{
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
        status_name: event.statusName,
        occurred_at_utc: event.occurredAtUtc,
      },
    })
  }

  async listForRecipient(query: {
    readonly recipientUserId: string
    readonly sinceUtc: Date
    readonly page: PageRequest
  }): Promise<Page<InboxRow>> {
    const where = inboxWhere(query.recipientUserId, query.sinceUtc)
    const { page, pageSize } = query.page

    const rows = await this.prisma.$queryRaw<InboxSqlRow[]>(Prisma.sql`
      SELECT
        notification.id,
        notification.event_type::text AS event_type,
        notification.idea_id,
        notification.idea_title,
        notification.link,
        notification.status_name,
        board.name AS board_name,
        notification.occurred_at_utc,
        notification.read_at_utc,
        actor.id AS actor_id,
        actor.first_name AS actor_first_name,
        actor.last_name AS actor_last_name,
        actor.status::text AS actor_status
      FROM notification_events AS notification
      LEFT JOIN users AS actor ON actor.id = notification.actor_user_id
      LEFT JOIN ideas AS idea ON idea.id = notification.idea_id
      LEFT JOIN boards AS board ON board.id = idea.board_id
      WHERE ${where}
      ORDER BY notification.occurred_at_utc DESC, notification.id DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `)
    const [total] = await this.prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM notification_events AS notification
      WHERE ${where}
    `)

    return {
      items: rows.map(toInboxRow),
      page,
      pageSize,
      totalCount: total?.total ?? 0,
    }
  }

  async countUnread(recipientUserId: string, sinceUtc: Date): Promise<number> {
    const [unread] = await this.prisma.$queryRaw<{ unread: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS unread
      FROM notification_events AS notification
      WHERE ${inboxWhere(recipientUserId, sinceUtc)}
        AND notification.read_at_utc IS NULL
    `)
    return unread?.unread ?? 0
  }

  async markRead(
    notificationId: string,
    recipientUserId: string,
    readAtUtc: Date,
  ): Promise<boolean> {
    // Keeps the first `read_at_utc`: only an unread row is touched.
    await this.prisma.notification_events.updateMany({
      where: { id: notificationId, recipient_user_id: recipientUserId, read_at_utc: null },
      data: { read_at_utc: readAtUtc },
    })
    const owned = await this.prisma.notification_events.count({
      where: { id: notificationId, recipient_user_id: recipientUserId },
    })
    return owned > 0
  }

  async markAllRead(recipientUserId: string, readAtUtc: Date): Promise<void> {
    await this.prisma.notification_events.updateMany({
      where: { recipient_user_id: recipientUserId, read_at_utc: null },
      data: { read_at_utc: readAtUtc },
    })
  }
}

function toInboxRow(row: InboxSqlRow): InboxRow {
  return {
    id: row.id,
    eventType: row.event_type as NotificationEventType,
    ideaId: row.idea_id,
    ideaTitle: row.idea_title,
    link: row.link,
    actor:
      row.actor_id !== null
        ? {
            userId: row.actor_id,
            firstName: row.actor_first_name ?? '',
            lastName: row.actor_last_name ?? '',
            status: row.actor_status as UserStatus,
          }
        : null,
    statusName: row.status_name,
    boardName: row.board_name,
    occurredAtUtc: row.occurred_at_utc,
    readAtUtc: row.read_at_utc,
  }
}
