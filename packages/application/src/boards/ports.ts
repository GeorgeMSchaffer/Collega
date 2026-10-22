// Persistence and infrastructure ports for board configuration. Wave C implements these against
// Prisma; this feature only depends on the shapes below, never on Prisma or Nest directly.

import type { Board } from '@collega/domain/boards'
import type { EffortLevel, IdeaPhase } from '@collega/domain/enums'
import type { AutoCreateTaskParent } from '../ideas/models.js'
import type { PullCandidatePage } from './models.js'

export interface BoardRepository {
  /** Stages the new board with its lanes and its allowed idea types. */
  add(board: Board): Promise<void>

  /**
   * Persists a mutation made through `updateBoard` or `reorderBoardSwimlanes`. Leaves the allowed
   * idea types alone, so a board save from a copy read before they changed cannot undo them.
   */
  save(board: Board): Promise<void>

  /** Stages replacing the board's allowed idea types with `board.allowedIdeaTypeIds`. */
  replaceAllowedIdeaTypes(board: Board): Promise<void>

  /**
   * Every idea type of the organization, archived ones included, in idea type sort order (sort
   * order, then name). Here rather than on an idea types port for the reason `countIdeasByBoard`
   * gives.
   */
  listIdeaTypes(organizationId: string): Promise<readonly BoardIdeaType[]>

  getById(boardId: string): Promise<Board | null>

  /** Callers are responsible for ordering the result - this port makes no ordering guarantee. */
  listByOrganization(organizationId: string): Promise<readonly Board[]>

  /**
   * True when the status is used as a swimlane on any board. Status deletion is rejected while a
   * reference exists (SPEC/20-feature-boards-and-statuses.md "Status Rules" #6).
   */
  isStatusReferenced(statusId: string): Promise<boolean>

  /**
   * Live ideas per board, keyed by board id, for the whole list in one query. Soft-deleted and
   * Delivery-phase ideas are excluded, matching what the board's own idea list shows.
   *
   * On this port rather than a narrow lookup of its own (the `OrganizationExistenceLookup`
   * pattern) because it needs no wiring: the same adapter already serves `BoardRepository`, and a
   * second port would buy a DI token, a provider and a constructor argument for one method.
   * Boards with no ideas may be absent from the map rather than present at zero - a caller
   * defaulting to 0 covers both, and forcing the adapter to pad the result would mean a second
   * pass over ids it was handed.
   */
  countIdeasByBoard(boardIds: readonly string[]): Promise<ReadonlyMap<string, number>>

  /**
   * The same population as `countIdeasByBoard`, grouped by board and status, for the whole list in
   * one query. Pairs with no ideas are absent; the caller pads each board's swimlanes with zero.
   */
  countIdeasByBoardAndStatus(boardIds: readonly string[]): Promise<readonly BoardStatusIdeaCount[]>

  /**
   * The same population as `countIdeasByBoard`, grouped by board and tag, for the whole list in
   * one query. One row per tag used on at least one of the board's ideas.
   */
  countIdeasByBoardAndTag(boardIds: readonly string[]): Promise<readonly BoardTagIdeaCount[]>

  /**
   * First and last names for the given user ids, keyed by id; ids that resolve to no user are
   * absent. Here rather than on a users port for the reason `countIdeasByBoard` gives.
   */
  getUserNames(userIds: readonly string[]): Promise<ReadonlyMap<string, UserName>>

  /**
   * The board's ideas in the given lanes: the same population as `countIdeasByBoard` (live and in
   * Discovery), so the ideas a lane removal moves are exactly the ones its lane count showed.
   */
  listLaneIdeas(boardId: string, statusIds: readonly string[]): Promise<readonly LaneIdea[]>

  /**
   * Stages moving the given ideas of the board from `fromStatusId` to `toStatusId`, in the same
   * unit of work as the board's own save, so the lane change and the move commit or fail together.
   * An idea no longer in `fromStatusId` when the batch commits is left where it is.
   */
  moveIdeas(
    boardId: string,
    ideaIds: readonly string[],
    fromStatusId: string,
    toStatusId: string,
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<void>

  /**
   * Stages a check, after `moveIdeas`, that every given idea landed in `toStatusId` in this save.
   * A miss fails the whole save with a `400` keyed `ideaMoves` naming the idea. Used only where a
   * move auto-creates a task, which must not be committed for an idea that never entered the lane.
   */
  verifyIdeasMoved(
    boardId: string,
    ideas: readonly { readonly ideaId: string; readonly title: string }[],
    toStatusId: string,
    nowUtc: Date,
  ): Promise<void>

  /**
   * Stages filing the given items onto `boardId`, in the same unit of work as the board's own add
   * or save (SPEC/20-feature-board-pull-in.md rules 13 to 16). Each item is written only if it is
   * still as `from` describes it; one that is not - moved, deleted or promoted since it was read -
   * fails the whole commit with a `ValidationError` keyed `pullItemIds` that names it, so nothing
   * is saved. The target board must already be staged ahead of this call when it is new.
   */
  reassignIdeas(
    boardId: string,
    items: readonly IdeaReassignment[],
    nowUtc: Date,
    actorUserId: string | null,
  ): Promise<void>

  /**
   * One page of the items the pull picker offers, oldest first and tie-broken on title then id so
   * paging is stable. The caller has already decided what the user may see and passes it in.
   */
  listPullCandidates(filter: PullCandidateFilter): Promise<PullCandidatePage>
}

export type IdeaReassignment = {
  readonly ideaId: string
  /** For the "no longer available" message. */
  readonly title: string
  readonly from: {
    readonly boardId: string | null
    readonly statusId: string
    readonly phase: IdeaPhase
    readonly sprintId: string | null
  }
  readonly toStatusId: string
  /** True for a backlog Issue: its phase becomes Discovery and its delivery status and sprint clear. */
  readonly returnsToDiscovery: boolean
}

export type PullCandidateFilter = {
  readonly organizationId: string
  readonly source: 'unassigned' | 'boards' | 'backlog'
  readonly excludeBoardId: string | null
  readonly search: string | null
  /** Normalized tag names, any-of. */
  readonly tags: readonly string[]
  readonly authorUserId: string | null
  /** The caller, for `isMine`. */
  readonly currentUserId: string
  readonly page: { readonly page: number; readonly pageSize: number }
}

export type LaneIdea = {
  readonly ideaId: string
  readonly title: string
  readonly statusId: string
  /** For the Effort entry rule when a move lands in a lane that references a board. */
  readonly effort: EffortLevel | null
}

export type BoardStatusIdeaCount = {
  readonly boardId: string
  readonly statusId: string
  readonly ideaCount: number
}

export type BoardTagIdeaCount = {
  readonly boardId: string
  readonly tagName: string
  readonly tagColor: string
  readonly ideaCount: number
}

export type BoardIdeaType = {
  readonly id: string
  readonly name: string
  readonly isDeleted: boolean
}

export type UserName = {
  readonly firstName: string
  readonly lastName: string
}

/**
 * Narrow existence check so this feature does not need to depend on the Organizations
 * partition's full repository port just to answer "does this organization id exist".
 *
 * `Clock` and `AuditEventWriter` used to live here too; both moved to
 * `@collega/application/common` once every Wave B partition turned out to need them.
 */
export interface OrganizationExistenceLookup {
  existsById(organizationId: string): Promise<boolean>
}

/**
 * The auto-create on entering an `autoCreateTask` lane by a pull or an `ideaMoves` entry. Satisfied
 * by `IdeaService`, which owns the one task-creation path: it stages the task in this save's unit
 * of work and hands back what to run once the save has committed (its audit entries).
 */
export interface AutoCreateTaskPort {
  stageAutoCreatedTask(
    parent: AutoCreateTaskParent,
    referencedBoardId: string,
  ): Promise<() => Promise<void>>
}
