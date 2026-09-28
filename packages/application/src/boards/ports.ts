// Persistence and infrastructure ports for board configuration. Wave C implements these against
// Prisma; this feature only depends on the shapes below, never on Prisma or Nest directly.

import type { Board } from '@collega/domain/boards'

export interface BoardRepository {
  add(board: Board): Promise<void>

  /** Persists a mutation made through `updateBoard` or `reorderBoardSwimlanes`. */
  save(board: Board): Promise<void>

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
