// Commands and results for metric types and item values (SPEC/contracts/metric-types.md).

export type MetricTypeInput = {
  readonly name: string
  /** A blank unit is stored `null`. */
  readonly unit: string | null
}

export type UpdateMetricTypeCommand = MetricTypeInput & { readonly isArchived: boolean }

export type MetricTypeItem = {
  readonly metricTypeId: string
  readonly organizationId: string
  readonly name: string
  readonly unit: string | null
  readonly isArchived: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
}

/** One stored value, with the type it belongs to. Numbers are JSON numbers on the wire. */
export type IdeaMetric = {
  readonly metricTypeId: string
  readonly name: string
  readonly unit: string | null
  readonly isArchived: boolean
  readonly projected: number | null
  readonly realized: number | null
}

export type IdeaMetricInput = {
  readonly metricTypeId: string
  readonly projected: number | null
  readonly realized: number | null
}

/** One Outcome's sum for an active type. A sum with no non-null number is `null`. */
export type MetricTotal = {
  readonly metricTypeId: string
  readonly name: string
  readonly unit: string | null
  readonly projected: number | null
  readonly realized: number | null
}
