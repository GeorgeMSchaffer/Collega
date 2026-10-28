// Satisfies `usage.UsageEventStore` and `usage.UsageTrackingPreferences`
// (SPEC/20-feature-analytics.md Part 3). Writes commit immediately, outside `PrismaUnitOfWork`,
// like the audit writer: a batch belongs to no other change.

import { randomUUID } from 'node:crypto'
import type {
  UsageBatch,
  UsageEventStore,
  UsageTrackingPreferences,
} from '@collega/application/usage'
import { Prisma, type PrismaClient } from '../persistence/prisma-client.js'

/** Rule 14: a slow insert gives up rather than holding the function's one connection. */
const INSERT_TIMEOUT_MS = 2000
const DAY_MS = 24 * 60 * 60 * 1000

export class PrismaUsageRepository implements UsageEventStore, UsageTrackingPreferences {
  constructor(private readonly prisma: PrismaClient) {}

  async insertBatch(batch: UsageBatch): Promise<number> {
    const values = Prisma.join(
      batch.events.map(
        (event) => Prisma.sql`(
          ${randomUUID()}::uuid, ${event.type}, ${event.route}, ${event.entityId}::uuid,
          ${event.props === null ? null : JSON.stringify(event.props)}, ${event.occurredAtUtc}::timestamptz
        )`,
      ),
    )
    // One statement: the opt-out check and the insert cannot disagree.
    const [, inserted] = await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`SET LOCAL statement_timeout = ${INSERT_TIMEOUT_MS}`),
      this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO usage_events (
          id, organization_id, user_id, on_behalf_of_user_id, event_type, route, entity_id,
          props_json, occurred_at_utc, received_at_utc
        )
        SELECT
          batch.id, ${batch.organizationId}::uuid, ${batch.userId}::uuid,
          ${batch.onBehalfOfUserId}::uuid, batch.event_type, batch.route, batch.entity_id,
          batch.props_json, batch.occurred_at_utc, ${batch.receivedAtUtc}::timestamptz
        FROM (VALUES ${values}) AS batch (id, event_type, route, entity_id, props_json, occurred_at_utc)
        WHERE NOT EXISTS (
          SELECT 1 FROM users AS opted_out
          WHERE opted_out.id = ${batch.optOutUserId}::uuid AND opted_out.usage_tracking_opt_out
        )
      `),
    ])
    return inserted
  }

  async rollUpBefore(cutoffUtc: Date): Promise<{ daysRolledUp: number; rowsDeleted: number }> {
    const days = await this.prisma.$queryRaw<{ day: Date }[]>(Prisma.sql`
      SELECT DISTINCT date_trunc('day', ue.occurred_at_utc AT TIME ZONE 'UTC') AS day
      FROM usage_events AS ue
      WHERE ue.occurred_at_utc < ${cutoffUtc}::timestamptz
      ORDER BY day
    `)
    let rowsDeleted = 0
    for (const { day } of days) {
      const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()))
      const end = new Date(start.getTime() + DAY_MS)
      // One day per transaction: it is either still raw or fully rolled up, never half of each.
      const [, , deleted] = await this.prisma.$transaction([
        this.prisma.$executeRaw(Prisma.sql`
          DELETE FROM usage_daily AS ud WHERE ud.day = ${start}::date
        `),
        // Statistics exclude View As events and the views of members who opted out (contract).
        this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO usage_daily (day, organization_id, event_type, event_count, user_count)
          SELECT ${start}::date, ue.organization_id, ue.event_type, COUNT(*), COUNT(DISTINCT ue.user_id)
          FROM usage_events AS ue
          LEFT JOIN users AS member ON member.id = ue.user_id
          WHERE ue.occurred_at_utc >= ${start}::timestamptz
            AND ue.occurred_at_utc < ${end}::timestamptz
            AND ue.organization_id IS NOT NULL
            AND ue.on_behalf_of_user_id IS NULL
            AND NOT COALESCE(member.usage_tracking_opt_out, false)
          GROUP BY ue.organization_id, ue.event_type
        `),
        this.prisma.$executeRaw(Prisma.sql`
          DELETE FROM usage_events AS ue
          WHERE ue.occurred_at_utc >= ${start}::timestamptz AND ue.occurred_at_utc < ${end}::timestamptz
        `),
      ])
      rowsDeleted += deleted
    }
    return { daysRolledUp: days.length, rowsDeleted }
  }

  async isOptedOut(userId: string): Promise<boolean> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { usage_tracking_opt_out: true },
    })
    return user?.usage_tracking_opt_out ?? false
  }

  async setOptedOut(userId: string, optedOut: boolean): Promise<void> {
    await this.prisma.users.update({
      where: { id: userId },
      data: { usage_tracking_opt_out: optedOut },
    })
  }
}
