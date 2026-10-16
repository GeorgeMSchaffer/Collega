// Commands and results for Outcomes (SPEC/contracts/outcomes.md).

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
}

/** One grouped top-level item, as the Outcome detail and the roadmap draw it. */
export type OutcomeIdea = {
  readonly ideaId: string
  readonly title: string
  readonly statusId: string
  readonly effort: string | null
  readonly assigneeUserIds: readonly string[]
  readonly sprintId: string | null
  readonly sprintStart: string | null
  readonly sprintEnd: string | null
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
