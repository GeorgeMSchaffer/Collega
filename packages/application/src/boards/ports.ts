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
