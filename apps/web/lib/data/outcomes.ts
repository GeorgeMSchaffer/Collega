/**
 * Outcomes and the roadmap, from the API's routes (`SPEC/contracts/outcomes.md`).
 *
 * Named apart from `getOutcomes` and `getOutcome` in `./delivery.ts`, which still answer empty for
 * the Roadmap screen until a later slice decides to switch it over. These readers return the API's
 * real shapes, rollups included, and nothing calls them yet.
 */

import { toOutcomePage, toOutcomeRoadmap, toOutcomeWithIdeas } from '../api/adapt'
import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type { WireOutcomeDetail, WireOutcomePage, WireRoadmap } from '../api/wire'
import type { OutcomeRoadmap, OutcomeSummaryPage, OutcomeWithIdeas } from '../types'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'

export type {
  OutcomeIdea,
  OutcomeRoadmap,
  OutcomeSummary,
  OutcomeSummaryPage,
  OutcomeWithIdeas,
} from '../types'

/** One page of the organization's Outcomes in roadmap order, each with its rollup. */
export async function getOutcomeList(
  options: { page?: number; pageSize?: number } = {},
): Promise<OutcomeSummaryPage> {
  failIfRequested('getOutcomeList')

  const scope = organizationScope()
  if (scope === null) {
    return { outcomes: [], page: 1, pageSize: options.pageSize ?? 0, totalCount: 0 }
  }

  const params = new URLSearchParams()
  if (options.page !== undefined) params.set('page', String(options.page))
  if (options.pageSize !== undefined) params.set('pageSize', String(options.pageSize))
  return toOutcomePage(
    await apiGet<WireOutcomePage>(
      'getOutcomeList',
      withQuery(apiPath`/organizations/${scope}/outcomes`, params),
    ),
  )
}

/** Every Outcome with the items grouped under it, and the items grouped under none. */
export async function getOutcomeRoadmap(): Promise<OutcomeRoadmap> {
  failIfRequested('getOutcomeRoadmap')

  const scope = organizationScope()
  if (scope === null) return { outcomes: [], ungrouped: [] }

  return toOutcomeRoadmap(
    await apiGet<WireRoadmap>('getOutcomeRoadmap', apiPath`/organizations/${scope}/roadmap`),
  )
}

/** One Outcome with its items; `null` for a missing or cross-organization id. */
export async function getOutcomeDetail(outcomeId: string): Promise<OutcomeWithIdeas | null> {
  failIfRequested('getOutcomeDetail')

  const scope = organizationScope()
  if (scope === null) return null

  try {
    return toOutcomeWithIdeas(
      await apiGet<WireOutcomeDetail>(
        'getOutcomeDetail',
        apiPath`/organizations/${scope}/outcomes/${outcomeId}`,
      ),
    )
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return null
    throw error
  }
}
