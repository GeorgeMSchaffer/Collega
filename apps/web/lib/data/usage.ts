import { apiGet, apiPath, withQuery } from '../api/client'
import type { WirePage } from '../api/wire'
import { failIfRequested } from './latency'

/**
 * The Site Admin's usage reads (`SPEC/contracts/usage.md`; slice 367). The wire shapes are the
 * contract's, unchanged: the screen formats them, and names nothing the API does not return.
 */

export type UsageRole = 'OrgAdmin' | 'User' | 'ReadOnly'

/** `from` inclusive, `to` exclusive, both `YYYY-MM-DD` (UTC). */
export type UsagePeriodQuery = {
  from: string
  to: string
  role: UsageRole | null
}

export type UsageMilestoneKey =
  | 'organizationCreated'
  | 'firstBoardByPerson'
  | 'firstIdea'
  | 'firstComment'
  | 'thirdActiveMember'
  | 'firstIdeaInFinalLane'

export type UsageOverview = {
  totals: {
    activeMembers: number
    members: number
    views: number
    changes: number
    visitsPerActiveMemberPerWeek: number
  }
  milestones: {
    key: UsageMilestoneKey
    reachedAtUtc: string | null
    daysSinceCreated: number | null
  }[]
  weeklyActive: { week: string; activeMembers: number }[]
  featureUse: {
    event: string
    kind: 'view' | 'change'
    count: number
    people: number | null
    byRole: Record<UsageRole, number> | null
  }[]
  dailyOnly: boolean
}

export type UsagePaths = {
  total: number
  items: { next: string; count: number; share: number; medianSecondsToNext: number | null }[]
}

export type UsageTrailItem = {
  occurredAtUtc: string
  kind: 'view' | 'change' | 'viewAs'
  event: string
  entityType: string | null
  entityId: string | null
  onBehalfOfUserId: string | null
  actorUserId: string
  metadata: unknown
}

export type UsageTrail = WirePage<UsageTrailItem> & { optedOut: boolean }

function periodParams(period: UsagePeriodQuery): URLSearchParams {
  const params = new URLSearchParams({ from: period.from, to: period.to })
  if (period.role) params.set('role', period.role)
  return params
}

export async function getUsageOverview(
  organizationId: string,
  period: UsagePeriodQuery,
): Promise<UsageOverview> {
  failIfRequested('getUsageOverview')
  return apiGet<UsageOverview>(
    'getUsageOverview',
    withQuery(apiPath`/usage/organizations/${organizationId}/overview`, periodParams(period)),
  )
}

export async function getUsagePaths(
  organizationId: string,
  period: UsagePeriodQuery,
  after: string,
): Promise<UsagePaths> {
  failIfRequested('getUsagePaths')
  const params = periodParams(period)
  params.set('after', after)
  return apiGet<UsagePaths>(
    'getUsagePaths',
    withQuery(apiPath`/usage/organizations/${organizationId}/paths`, params),
  )
}

export async function getUsageTrail(
  userId: string,
  period: Pick<UsagePeriodQuery, 'from' | 'to'>,
  page: number,
  pageSize: number,
): Promise<UsageTrail> {
  failIfRequested('getUsageTrail')
  const params = new URLSearchParams({
    from: period.from,
    to: period.to,
    page: String(page),
    pageSize: String(pageSize),
  })
  return apiGet<UsageTrail>(
    'getUsageTrail',
    withQuery(apiPath`/usage/users/${userId}/trail`, params),
  )
}
