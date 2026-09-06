import type { Attribution } from './audit-attribution.js'

/**
 * One row for `audit_events`, shaped to the frozen schema.
 *
 * `attribution` is the branded pair from `attributeAudit`, not two loose ids, so a caller
 * cannot supply an actor without having gone through the rule-14 rewrite. That rewrite is
 * what stops an action taken during View As being recorded as though the impersonated user
 * did it to themselves.
 */
export type AuditEventInput = {
  readonly organizationId: string | null
  readonly attribution: Attribution
  readonly eventType: string
  readonly entityType: string
  readonly entityId: string | null
  readonly message: string
  readonly metadataJson?: string | null
}

/**
 * Writes audit events. Implemented in Wave C against Prisma.
 *
 * A port rather than a repository per feature: every partition writes audit rows, and
 * without one shared shape each would define its own and they would drift - which is what
 * happened in the first Wave B round before this existed.
 */
export interface AuditEventWriter {
  write(event: AuditEventInput): Promise<void>
}
