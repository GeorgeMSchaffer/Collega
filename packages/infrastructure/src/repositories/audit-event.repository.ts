// Satisfies the kernel's `AuditEventWriter` (@collega/application/common). Missing from the first
// pass of this slice - every service in packages/application calls it, but it belongs to no single
// Wave B partition's `ports.ts`, so it was overlooked when this slice was scoped port-file by
// port-file. Found during the C1 review's cross-service audit (idea-assist.service.ts's `audit()`
// call has nothing else backing it).
//
// COMMITS IMMEDIATELY, like `tag.repository.ts`'s `getOrCreate` - NOT through `PrismaUnitOfWork`.
// This mirrors the original `EfAuditEventWriter.WriteAsync`, which calls `AddAsync` then its own
// `SaveChangesAsync` rather than relying on the caller's later commit. That is also why services
// disagree on whether they call `auditEvents.write` before or after `unitOfWork.saveChanges()`
// (idea.service.ts and comment.service.ts call it after; ai-prompt.service.ts and idea-assist.
// service.ts's `setScopeStatement` call it before) - neither order is a bug, because an audit
// write was never staged into the same transaction as the entity mutation on either side of the
// port. Keeping that behavior here (rather than "fixing" it into the buffer) is what makes both
// call orders keep working. A consequence worth naming: unlike the ideas/comments/etc. mutation
// this accompanies, an audit event can persist even when the surrounding request later fails
// before its own `saveChanges()` - matching the original, which had the same property.

import { randomUUID } from 'node:crypto'
import type {
  AuditEventInput,
  AuditEventWriter,
  Page,
  PageRequest,
} from '@collega/application/common'
import type { IdeaActivityEntry, IdeaActivityPort } from '@collega/application/ideas'
import type { PrismaClient } from '../persistence/prisma-client.js'

function parseMetadata(json: string | null): Record<string, unknown> | null {
  if (json === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(json)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export class PrismaAuditEventWriter implements AuditEventWriter, IdeaActivityPort {
  constructor(private readonly prisma: PrismaClient) {}

  /** `ideas.IdeaActivityPort`: the events whose entity is the idea, newest first. */
  async listForIdea(ideaId: string, request: PageRequest): Promise<Page<IdeaActivityEntry>> {
    const where = { entity_type: 'Idea', entity_id: ideaId }
    const [rows, totalCount] = await Promise.all([
      this.prisma.audit_events.findMany({
        where,
        orderBy: [{ occurred_at_utc: 'desc' }, { id: 'desc' }],
        skip: (request.page - 1) * request.pageSize,
        take: request.pageSize,
      }),
      this.prisma.audit_events.count({ where }),
    ])
    return {
      items: rows.map((row) => ({
        eventType: row.event_type,
        message: row.message,
        occurredAtUtc: row.occurred_at_utc,
        actorUserId: row.actor_user_id,
        onBehalfOfUserId: row.on_behalf_of_user_id,
        metadata: parseMetadata(row.metadata_json),
      })),
      page: request.page,
      pageSize: request.pageSize,
      totalCount,
    }
  }

  async write(event: AuditEventInput): Promise<void> {
    await this.prisma.audit_events.create({
      data: {
        id: randomUUID(),
        organization_id: event.organizationId,
        actor_user_id: event.attribution.actorUserId,
        on_behalf_of_user_id: event.attribution.onBehalfOfUserId,
        event_type: event.eventType,
        entity_type: event.entityType,
        entity_id: event.entityId,
        message: event.message,
        metadata_json: event.metadataJson ?? null,
        occurred_at_utc: event.occurredAtUtc,
      },
    })
  }
}
