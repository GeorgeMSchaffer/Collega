// Satisfies the kernel's `AuditEventWriter` (@collega/application/common). Missing from the first
// pass of this slice - every service in packages/application calls it, but it belongs to no single
// Wave B partition's `ports.ts`, so it was overlooked when this slice was scoped port-file by
// port-file. Found during the C1 review's cross-service audit (idea-assist.service.ts's `audit()`
// call has nothing else backing it).
//
// COMMITS IMMEDIATELY, like `tag.repository.ts`'s `getOrCreate` - NOT through `PrismaUnitOfWork`.
// This mirrors the .NET `EfAuditEventWriter.WriteAsync`, which calls `AddAsync` then its own
// `SaveChangesAsync` rather than relying on the caller's later commit. That is also why services
// disagree on whether they call `auditEvents.write` before or after `unitOfWork.saveChanges()`
// (idea.service.ts and comment.service.ts call it after; ai-prompt.service.ts and idea-assist.
// service.ts's `setScopeStatement` call it before) - neither order is a bug, because an audit
// write was never staged into the same transaction as the entity mutation on either side of the
// port. Keeping that behavior here (rather than "fixing" it into the buffer) is what makes both
// call orders keep working. A consequence worth naming: unlike the ideas/comments/etc. mutation
// this accompanies, an audit event can persist even when the surrounding request later fails
// before its own `saveChanges()` - matching the .NET, which had the same property.

import { randomUUID } from 'node:crypto'
import type { AuditEventInput, AuditEventWriter } from '@collega/application/common'
import type { PrismaClient } from '../persistence/prisma-client.js'

export class PrismaAuditEventWriter implements AuditEventWriter {
  constructor(private readonly prisma: PrismaClient) {}

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
