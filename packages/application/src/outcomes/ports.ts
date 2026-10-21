import type { UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import type { Outcome } from '@collega/domain/outcomes'
import type { OutcomeIdea, OutcomeRollup } from './models.js'

export interface OutcomeRepository {
  /** Soft-deleted Outcomes come back too; the service decides what a deleted one means. */
  getById(outcomeId: string): Promise<Outcome | null>

  /** Non-deleted Outcomes of the organization in `sortOrder`. */
  listByOrganization(organizationId: string): Promise<readonly Outcome[]>

  add(outcome: Outcome): Promise<void>

  save(outcome: Outcome): Promise<void>

  /** Sets `outcome_id` to null on every item grouped under the Outcome; no item is deleted. */
  ungroupIdeas(outcomeId: string): Promise<void>
}

/** The derived reads: every count and span is computed per read, never stored. */
export interface OutcomeReadsPort {
  rollupsByOutcomeIds(outcomeIds: readonly string[]): Promise<ReadonlyMap<string, OutcomeRollup>>

  /** The top-level items grouped under each Outcome. */
  ideasByOutcomeIds(
    outcomeIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly OutcomeIdea[]>>

  /** Top-level items under no Outcome; cards with a parent are excluded. */
  listUngroupedIdeas(organizationId: string): Promise<readonly OutcomeIdea[]>
}

/** The slice of the idea repository grouping needs. */
export interface OutcomeIdeasPort {
  getById(ideaId: string): Promise<Idea | null>

  update(idea: Idea): Promise<void>
}

export type OutcomeUserSummary = {
  readonly id: string
  readonly status: UserStatus
  readonly organizationId: string | null
}

export interface OutcomeUsersPort {
  listByIds(userIds: readonly string[]): Promise<readonly OutcomeUserSummary[]>
}
