import type { SprintState, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import type { Sprint } from '@collega/domain/sprints'

export interface SprintRepository {
  /** Soft-deleted sprints come back too; the service treats one as gone, as `StatusService` does. */
  getById(sprintId: string): Promise<Sprint | null>

  /** Active sprints for an organization, optionally narrowed to one state. */
  listByOrganization(organizationId: string, state: SprintState | null): Promise<readonly Sprint[]>

  add(sprint: Sprint): Promise<void>

  save(sprint: Sprint): Promise<void>
}

/**
 * The Issues assigned to a sprint, and the writes that take them out of it again.
 *
 * Sprint completion and deletion both have to move Issues back to the backlog, which is a
 * cross-aggregate step the `Sprint` entity cannot take on its own (see `completeSprint`'s comment).
 * This is the narrow slice of Ideas' own `IdeaRepository` that makes it possible - the same
 * concrete adapter satisfies both, exactly as `UpvoteCountsPort` is a read-only slice of the
 * upvote repository.
 */
export interface SprintIssuesPort {
  listBySprint(sprintId: string): Promise<readonly Idea[]>

  /** `issueCount`/`doneCount` per sprint, in one query - the sprint list renders both for every
   * row, and a per-row count would be the N+1 the delivery reads were written to avoid. */
  countsBySprintIds(sprintIds: readonly string[]): Promise<ReadonlyMap<string, SprintIssueCounts>>

  update(idea: Idea): Promise<void>
}

export type SprintIssueCounts = {
  readonly issueCount: number
  readonly doneCount: number
}

/** Just enough of a user to validate a sprint owner: same organization, and active. */
export type SprintUserSummary = {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly status: UserStatus
  readonly organizationId: string | null
}

export interface SprintUsersPort {
  listByIds(userIds: readonly string[]): Promise<readonly SprintUserSummary[]>
}
