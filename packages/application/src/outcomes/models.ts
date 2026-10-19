// Commands and results for Outcomes (SPEC/contracts/outcomes.md).

import type { MetricTotal } from '../metric-types/models.js'

export type CreateOutcomeCommand = {
  readonly name: string
  readonly description: string | null
  /** `YYYY-MM-DD`. The window invariant is the domain's. */
  readonly targetStartDate: string
  readonly targetEndDate: string
  readonly ownerUserId: string | null
  /** `null` or absent: a random palette colour. */
  readonly color: string | null
}

/** A full replacement; `color` `undefined` (absent) keeps the stored colour, `null` is a 400. */
export type UpdateOutcomeCommand = Omit<CreateOutcomeCommand, 'color'> & {
  readonly color: string | null | undefined
}

export type OutcomeRollup = {
  readonly ideaCount: number
  readonly doneIdeaCount: number
  readonly taskCount: number
  readonly doneTaskCount: number
  /** Earliest sprint start and latest sprint end among the grouped items' tasks; both `null` if none. */
  readonly sprintStart: string | null
  readonly sprintEnd: string | null
  /** Per active metric type with a value on a grouped top-level item (`contracts/metric-types.md`). */
  readonly metricTotals: readonly MetricTotal[]
}

/** One grouped top-level item, as the Outcome detail and the roadmap draw it. */
export type OutcomeIdea = {
  readonly ideaId: string
  /** `<board keyPrefix>-<itemNumber>`; `null` without a prefix or number (as on the ideas reads). */
  readonly itemKey: string | null
  readonly title: string
  readonly statusId: string
  readonly effort: string | null
  readonly assigneeUserIds: readonly string[]
  readonly sprintId: string | null
  readonly sprintStart: string | null
  readonly sprintEnd: string | null
  /** The item's stored values over active metric types, in the types' order. */
  readonly metrics: readonly OutcomeIdeaMetric[]
}

export type OutcomeIdeaMetric = {
  readonly metricTypeId: string
  readonly projected: number | null
  readonly realized: number | null
}

export type OutcomeItem = OutcomeRollup & {
  readonly outcomeId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly targetStartDate: string
  readonly targetEndDate: string
  readonly ownerUserId: string | null
  readonly sortOrder: number
  readonly color: string
}

export type OutcomeDetail = OutcomeItem & { readonly ideas: readonly OutcomeIdea[] }

export type OutcomePage = {
  readonly items: readonly OutcomeItem[]
  readonly page: number
  readonly pageSize: number
  readonly totalCount: number
  readonly sortBy: 'sortOrder'
  readonly sortDirection: 'asc'
}

export type Roadmap = {
  readonly outcomes: readonly (OutcomeItem & { readonly ideas: readonly OutcomeIdea[] })[]
  readonly ungrouped: readonly OutcomeIdea[]
}

export type IdeaOutcomeResult = {
  readonly ideaId: string
  readonly outcomeId: string | null
}
