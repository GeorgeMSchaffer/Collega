// A collection of ideas organized by status swimlanes (SPEC/20-feature-boards-and-statuses.md
// "Board Rules"). Enforces the minimum-two-swimlanes invariant (#3).
//
// Modelled as plain immutable data plus functions - see packages/domain/src/statuses/status.ts
// for why. A swimlane is just (statusId, displayOrder); it does not carry its own persistence
// id, because `board_swimlanes` is keyed uniquely by (board_id, status_id)
// (`ux_board_swimlanes_board_id_status_id` in the frozen schema) - Infrastructure can diff and
// upsert against that composite key without this layer tracking row identity across a reorder.

import { type Auditable, markCreated, markUpdated } from '@collega/domain/common'

export const BOARD_NAME_MAX_LENGTH = 150
export const MIN_SWIMLANES = 2

/** Raised when a caller asks this module to put a Board into an invalid state. */
export class BoardInvariantError extends Error {}

export type BoardSwimlane = {
  readonly statusId: string
  readonly displayOrder: number
}

export type Board = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  /** Controls whether the User role can move ideas on this board. */
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly BoardSwimlane[]
}

function requireName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    throw new BoardInvariantError('Name is required.')
  }
  return trimmed
}

/** Turns a caller-ordered list of status ids into dense, validated swimlanes. */
function toSwimlanes(orderedStatusIds: readonly string[]): readonly BoardSwimlane[] {
  if (orderedStatusIds.length < MIN_SWIMLANES) {
    throw new BoardInvariantError(`A board must have at least ${MIN_SWIMLANES} swimlanes.`)
  }
  if (new Set(orderedStatusIds).size !== orderedStatusIds.length) {
    throw new BoardInvariantError('A board cannot list the same status twice.')
  }
  return orderedStatusIds.map((statusId, displayOrder) => ({ statusId, displayOrder }))
}

/**
 * Creates a board with its swimlanes. `orderedStatusIds` must contain at least `MIN_SWIMLANES`
 * distinct status ids; display order follows the given sequence.
 */
export function createBoard(params: {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly allowUserStatusUpdate: boolean
  readonly orderedStatusIds: readonly string[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): Board {
  if (params.organizationId.trim().length === 0) {
    throw new BoardInvariantError('Organization id is required.')
  }
  const name = requireName(params.name)
  const swimlanes = toSwimlanes(params.orderedStatusIds)

  return {
    id: params.id,
    organizationId: params.organizationId,
    name,
    allowUserStatusUpdate: params.allowUserStatusUpdate,
    swimlanes,
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

/**
 * Updates the board name, the User-role move permission, and the set/order of swimlanes
 * (SPEC/30-Contracts.md `PUT /boards/{id}`). `orderedStatusIds` may add or remove statuses
 * relative to the current swimlanes but must keep at least `MIN_SWIMLANES` distinct statuses
 * (rule #3) and may only draw from the organization's statuses (subset support, validated by the
 * Application layer).
 */
export function updateBoard(
  board: Board,
  params: {
    readonly name: string
    readonly allowUserStatusUpdate: boolean
    readonly orderedStatusIds: readonly string[]
  },
  nowUtc: Date,
  actorUserId: string | null,
): Board {
  const name = requireName(params.name)
  const swimlanes = toSwimlanes(params.orderedStatusIds)

  return markUpdated(
    { ...board, name, allowUserStatusUpdate: params.allowUserStatusUpdate, swimlanes },
    nowUtc,
    actorUserId,
  )
}

/**
 * Reorders the board's existing swimlanes in place (rule #6 - persisted immediately after
 * drag-and-drop). Unlike `updateBoard` this never adds or removes a swimlane: `orderedStatusIds`
 * must be exactly the board's current swimlane statuses.
 */
export function reorderBoardSwimlanes(
  board: Board,
  orderedStatusIds: readonly string[],
  nowUtc: Date,
  actorUserId: string | null,
): Board {
  const swimlanes = toSwimlanes(orderedStatusIds)

  const current = new Set(board.swimlanes.map((swimlane) => swimlane.statusId))
  const requested = new Set(orderedStatusIds)
  const sameSet =
    current.size === requested.size && [...current].every((statusId) => requested.has(statusId))
  if (!sameSet) {
    throw new BoardInvariantError(
      "A reorder must list exactly the board's current swimlane statuses.",
    )
  }

  return markUpdated({ ...board, swimlanes }, nowUtc, actorUserId)
}
