/**
 * Metric types and the values an item holds for them (`SPEC/contracts/metric-types.md`).
 *
 * Reads only; the writes arrive with the screens that make them. A Site Admin has no organization to
 * scope to, so the organization-level reader answers empty for that role like its siblings.
 */

import { toIdeaMetric, toMetricType } from '../api/adapt'
import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type { WireIdeaMetric, WireMetricType } from '../api/wire'
import type { IdeaMetric, MetricType } from '../types'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'

export type { IdeaMetric, MetricTotal, MetricType } from '../types'

/** The organization's metric types. Archived ones are left out unless asked for. */
export async function getMetricTypes(
  options: { includeArchived?: boolean } = {},
): Promise<MetricType[]> {
  failIfRequested('getMetricTypes')

  const scope = organizationScope()
  if (scope === null) return []

  const params = new URLSearchParams()
  if (options.includeArchived) params.set('includeArchived', 'true')
  const types = await apiGet<readonly WireMetricType[]>(
    'getMetricTypes',
    withQuery(apiPath`/organizations/${scope}/metric-types`, params),
  )
  return types.map(toMetricType)
}

/**
 * One item's metric values. Empty for an id the reader cannot see, and for a card with a parent,
 * which carries none.
 */
export async function getIdeaMetrics(ideaId: string): Promise<IdeaMetric[]> {
  failIfRequested('getIdeaMetrics')

  try {
    const metrics = await apiGet<readonly WireIdeaMetric[]>(
      'getIdeaMetrics',
      apiPath`/ideas/${ideaId}/metrics`,
    )
    return metrics.map(toIdeaMetric)
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return []
    throw error
  }
}
