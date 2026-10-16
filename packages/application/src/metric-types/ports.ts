import type { Idea } from '@collega/domain/ideas'
import type { MetricType } from '@collega/domain/metric-types'
import type { IdeaMetric } from './models.js'

export interface MetricTypeRepository {
  getById(metricTypeId: string): Promise<MetricType | null>

  /** In the types' order: `createdAt`, then `metricTypeId`. */
  listByOrganization(
    organizationId: string,
    includeArchived: boolean,
  ): Promise<readonly MetricType[]>

  add(metricType: MetricType): Promise<void>

  save(metricType: MetricType): Promise<void>
}

export type IdeaMetricWrite = {
  readonly metricTypeId: string
  readonly projected: number | null
  readonly realized: number | null
}

export interface IdeaMetricValuesPort {
  /** Every stored value, archived types included, in the types' order. */
  listByIdea(ideaId: string): Promise<readonly IdeaMetric[]>

  /** Sets the given values and clears the given types' rows, in the caller's unit of work. */
  apply(
    ideaId: string,
    upserts: readonly IdeaMetricWrite[],
    clearedTypeIds: readonly string[],
  ): Promise<void>
}

/** The slice of the idea repository the value routes need. */
export interface MetricIdeasPort {
  getById(ideaId: string): Promise<Idea | null>
}
