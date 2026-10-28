import type { UsageEvent } from '@collega/domain/usage'

/** One batch to store, already stamped with who sent it. */
export type UsageBatch = {
  readonly organizationId: string | null
  /** The real user; under View As, the administrator (`attributeAudit`'s actor). */
  readonly userId: string
  readonly onBehalfOfUserId: string | null
  /** Whose opt-out decides whether the batch is kept: the acting user. */
  readonly optOutUserId: string
  readonly receivedAtUtc: Date
  readonly events: readonly UsageEvent[]
}

export interface UsageEventStore {
  /**
   * One insert for the whole batch, bounded by a short statement timeout, storing nothing when
   * `optOutUserId` has opted out. Returns how many events were stored.
   */
  insertBatch(batch: UsageBatch): Promise<number>

  /**
   * Rolls every day before `cutoffUtc` up into `usage_daily` and deletes its raw rows, one day per
   * transaction, so a day is always either raw or rolled up. Re-running a day replaces it.
   */
  rollUpBefore(cutoffUtc: Date): Promise<{ daysRolledUp: number; rowsDeleted: number }>
}

export interface UsageTrackingPreferences {
  isOptedOut(userId: string): Promise<boolean>
  setOptedOut(userId: string, optedOut: boolean): Promise<void>
}

/** Where a batch that could not be stored is reported, so it is not lost (rule 14). */
export interface UsageFailureLog {
  writeFailed(entry: {
    readonly userId: string
    readonly organizationId: string | null
    readonly events: readonly UsageEvent[]
    readonly error: string
  }): void
}

export type UsageSettings = {
  /** `COLLEGA_USAGE_TRACKING` (rule 12). */
  readonly enabled: boolean
  /** `COLLEGA_USAGE_RETENTION_DAYS` (rule 16). */
  readonly retentionDays: number
}
