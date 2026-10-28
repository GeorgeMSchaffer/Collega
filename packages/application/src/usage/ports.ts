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

// The Site Admin reads (`SPEC/contracts/usage.md` overview, paths, trail). Every statistic
// excludes Site Admins, View As events and opted-out members' views; the trail does not.

export type UsageRole = 'OrgAdmin' | 'User' | 'ReadOnly'

/** A period: `fromUtc` inclusive, `toUtc` exclusive, both midnight UTC. */
export type UsagePeriod = {
  readonly organizationId: string
  readonly fromUtc: Date
  readonly toUtc: Date
  readonly role: UsageRole | null
}

export type UsageMilestoneKey =
  | 'organizationCreated'
  | 'firstBoardByPerson'
  | 'firstIdea'
  | 'firstComment'
  | 'thirdActiveMember'
  | 'firstIdeaInFinalLane'

export type UsageOverview = {
  readonly totals: {
    readonly activeMembers: number
    readonly members: number
    readonly views: number
    readonly changes: number
    readonly visitsPerActiveMemberPerWeek: number
  }
  readonly milestones: readonly {
    readonly key: UsageMilestoneKey
    readonly reachedAtUtc: Date | null
    readonly daysSinceCreated: number | null
  }[]
  readonly weeklyActive: readonly { readonly week: string; readonly activeMembers: number }[]
  readonly featureUse: readonly {
    readonly event: string
    readonly kind: 'view' | 'change'
    readonly count: number
    readonly people: number | null
    readonly byRole: Readonly<Record<UsageRole, number>> | null
  }[]
  readonly dailyOnly: boolean
}

export type UsagePaths = {
  readonly total: number
  readonly items: readonly {
    readonly next: string
    readonly count: number
    readonly share: number
    readonly medianSecondsToNext: number | null
  }[]
}

export type UsageTrailItem = {
  readonly occurredAtUtc: Date
  readonly kind: 'view' | 'change' | 'viewAs'
  readonly event: string
  readonly entityType: string | null
  readonly entityId: string | null
  readonly onBehalfOfUserId: string | null
  readonly actorUserId: string
  readonly metadata: unknown
}

export interface UsageReports {
  organizationExists(organizationId: string): Promise<boolean>
  /** `null` when there is no such user; otherwise whether they opted out. */
  userOptedOut(userId: string): Promise<boolean | null>
  /** `dailyOnly`: views of days already rolled up come from `usage_daily`, with no people. */
  overview(period: UsagePeriod, dailyOnly: boolean): Promise<UsageOverview>
  paths(period: UsagePeriod, after: string): Promise<UsagePaths>
  trail(query: {
    readonly userId: string
    readonly fromUtc: Date
    readonly toUtc: Date
    readonly includeViews: boolean
    readonly offset: number
    readonly limit: number
  }): Promise<{ readonly items: readonly UsageTrailItem[]; readonly totalCount: number }>
}
