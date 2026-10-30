// Usage analytics intake, the user's own switch, and the nightly rollup
// (SPEC/20-feature-analytics.md Part 3, SPEC/contracts/usage.md). Recording fails open: nothing
// here may turn a usage problem into an error the user sees (rule 14). Audit writes stay strict.

import { Role } from '@collega/domain/enums'
import { parseUsageBatch } from '@collega/domain/usage'
import {
  type AuditEventWriter,
  attributeAudit,
  type Clock,
  type CurrentUserContext,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../common/index.js'
import type {
  UsageEventStore,
  UsageFailureLog,
  UsageSettings,
  UsageTrackingPreferences,
} from './ports.js'

/** Contract: at most 60 batches a minute per user; more are dropped. */
const BATCHES_PER_MINUTE = 60
const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60 * 1000

export class UsageService {
  /**
   * Per-instance and best effort, like the throttler's in-memory storage: it only stops one runaway
   * tab, which is all the limit is for. Entries older than a minute are pruned on each check.
   */
  private readonly batchesByUser = new Map<string, { windowStart: number; count: number }>()

  constructor(
    private readonly store: UsageEventStore,
    private readonly preferences: UsageTrackingPreferences,
    private readonly auditEvents: AuditEventWriter,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
    private readonly failures: UsageFailureLog,
    private readonly settings: UsageSettings,
  ) {}

  /** `POST /usage/events`. Never throws: the answer is always `202` with what was stored. */
  async record(body: unknown): Promise<{ accepted: number }> {
    const user = this.currentUser
    if (!this.settings.enabled || user.userId === null || user.realUserId === null) {
      return { accepted: 0 }
    }
    // A Site Admin acting directly is on platform screens, not using an organization (rule 10).
    if (user.role === Role.SiteAdmin && !user.isImpersonating) {
      return { accepted: 0 }
    }
    const now = this.clock.now()
    const events = parseUsageBatch(body, now)
    if (events.length === 0 || this.overLimit(user.realUserId, now.getTime())) {
      return { accepted: 0 }
    }
    const attribution = attributeAudit(user, user.userId)
    const userId = attribution.actorUserId ?? user.realUserId
    try {
      const accepted = await this.store.insertBatch({
        organizationId: user.organizationId,
        userId,
        onBehalfOfUserId: attribution.onBehalfOfUserId,
        optOutUserId: user.userId,
        receivedAtUtc: now,
        events,
      })
      return { accepted }
    } catch (error) {
      this.failures.writeFailed({
        userId,
        organizationId: user.organizationId,
        events,
        error: error instanceof Error ? error.message : String(error),
      })
      return { accepted: 0 }
    }
  }

  /** `GET /usage/tracking`. */
  async getTracking(): Promise<{ enabled: boolean }> {
    const userId = this.ownUserId()
    return { enabled: !(await this.preferences.isOptedOut(userId)) }
  }

  /** `PUT /usage/tracking`. */
  async setTracking(body: unknown): Promise<{ enabled: boolean }> {
    const userId = this.ownUserId()
    const enabled = (body as { enabled?: unknown } | null)?.enabled
    if (typeof enabled !== 'boolean') {
      throw new ValidationError('One or more fields are invalid.', {
        enabled: ['Enabled must be true or false.'],
      })
    }
    await this.preferences.setOptedOut(userId, !enabled)
    await this.auditEvents.write({
      eventType: 'UsageTrackingChanged',
      entityType: 'User',
      entityId: userId,
      message: enabled ? 'Turned on usage recording.' : 'Turned off usage recording.',
      metadataJson: JSON.stringify({ enabled }),
      organizationId: this.currentUser.organizationId,
      attribution: attributeAudit(this.currentUser, userId),
      occurredAtUtc: this.clock.now(),
    })
    return { enabled }
  }

  /** The nightly job: every day older than the retention window becomes daily counts. */
  async rollUp(): Promise<{ daysRolledUp: number; rowsDeleted: number }> {
    const now = this.clock.now()
    const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return this.store.rollUpBefore(new Date(startOfToday - this.settings.retentionDays * DAY_MS))
  }

  /** The switch belongs to the user: not through View As. */
  private ownUserId(): string {
    if (this.currentUser.userId === null) {
      throw new UnauthorizedError('Sign in to change this setting.')
    }
    if (this.currentUser.isImpersonating) {
      throw new ForbiddenError('Usage recording can only be changed by the user themselves.')
    }
    return this.currentUser.userId
  }

  private overLimit(userId: string, nowMs: number): boolean {
    for (const [key, entry] of this.batchesByUser) {
      if (nowMs - entry.windowStart >= MINUTE_MS) {
        this.batchesByUser.delete(key)
      }
    }
    const entry = this.batchesByUser.get(userId) ?? { windowStart: nowMs, count: 0 }
    entry.count += 1
    this.batchesByUser.set(userId, entry)
    return entry.count > BATCHES_PER_MINUTE
  }
}
