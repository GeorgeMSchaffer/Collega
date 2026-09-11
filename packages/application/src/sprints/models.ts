import type { SprintState } from '@collega/domain/enums'

// Commands ---------------------------------------------------------------------------------

export type CreateSprintCommand = {
  readonly name: string
  readonly goal: string | null
  /** `YYYY-MM-DD`. The window invariant (`endDate >= startDate`) is the domain's. */
  readonly startDate: string
  readonly endDate: string
  readonly ownerUserId: string | null
}

export type UpdateSprintCommand = CreateSprintCommand

// Results ----------------------------------------------------------------------------------

/**
 * One sprint, with the two counts the sprint list and sprint header render.
 *
 * `issueCount`/`doneCount` are derived per read and never stored, for the same reason the
 * roadmap's rollups are in Slice 2: a stored counter is a second source of truth that drifts the
 * first time an Issue moves without going through the sprint.
 *
 * The sprint's Issues themselves are NOT embedded. The sprint board reads them from the delivery
 * query (`IdeaService.listDelivery({ sprintId })`), which is the one projection that knows how to
 * build a delivery card; answering the same cards from two services would be two places to keep
 * that shape right.
 */
export type SprintItem = {
  readonly sprintId: string
  readonly organizationId: string
  readonly name: string
  readonly goal: string | null
  readonly startDate: string
  readonly endDate: string
  readonly ownerUserId: string | null
  readonly ownerDisplayName: string | null
  readonly state: SprintState
  readonly issueCount: number
  readonly doneCount: number
}
