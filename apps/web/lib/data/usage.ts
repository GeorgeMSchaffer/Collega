import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type { WireBoardListItem, WirePage, WireStatus } from '../api/wire'
import { trailIdeaId } from '../usage-report'
import { getMemberDetail } from './admin'
import { getIdea } from './ideas'
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

/** What a trail page's ids name: boards, ideas (key and title), statuses and people. */
export type UsageTrailNames = {
  boards: Record<string, string>
  ideas: Record<string, { itemKey: string | null; title: string }>
  statuses: Record<string, string>
  users: Record<string, string>
}

/**
 * Resolves the names one trail page shows, as the contract leaves to the client's own reads: the
 * organization's boards and statuses in one request each, each idea on the page by id, and anyone
 * not in `known` (a Site Admin acting through View As) by id. A name that cannot be read (deleted,
 * not found) is left out, and the row falls back to saying what kind of thing it was.
 */
export async function getUsageTrailNames(
  organizationId: string,
  items: readonly UsageTrailItem[],
  known: Readonly<Record<string, string>>,
): Promise<UsageTrailNames> {
  failIfRequested('getUsageTrailNames')
  const ideaIds = [...new Set(items.map(trailIdeaId).filter((id): id is string => id !== null))]
  const userIds = [
    ...new Set(items.flatMap((item) => [item.actorUserId, item.onBehalfOfUserId])),
  ].filter((id): id is string => id !== null && !(id in known))

  const [boards, statuses, ideas, users] = await Promise.all([
    apiGet<readonly WireBoardListItem[]>(
      'getUsageTrailNames',
      apiPath`/organizations/${organizationId}/boards?includeArchived=true`,
    ),
    apiGet<readonly WireStatus[]>(
      'getUsageTrailNames',
      apiPath`/organizations/${organizationId}/statuses`,
    ),
    Promise.all(ideaIds.map((id) => getIdea(id))),
    Promise.all(
      userIds.map((id) =>
        getMemberDetail(id).catch((error: unknown) => {
          if (isApiStatus(error, 404)) return null
          throw error
        }),
      ),
    ),
  ])

  return {
    boards: Object.fromEntries(boards.map((board) => [board.boardId, board.name])),
    statuses: Object.fromEntries(statuses.map((status) => [status.statusId, status.name])),
    ideas: Object.fromEntries(
      ideas.flatMap((idea) =>
        idea ? [[idea.id, { itemKey: idea.itemKey, title: idea.title }]] : [],
      ),
    ),
    users: {
      ...known,
      ...Object.fromEntries(
        users.flatMap((user) => (user ? [[user.id, `${user.firstName} ${user.lastName}`]] : [])),
      ),
    },
  }
}
