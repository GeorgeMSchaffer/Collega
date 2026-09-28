// A collection of ideas organized by status swimlanes (SPEC/20-feature-boards-and-statuses.md
// "Board Rules"). Enforces the minimum-two-swimlanes invariant (#3).
//
// Modelled as plain immutable data plus functions - see packages/domain/src/statuses/status.ts
// for why. A swimlane is just (statusId, displayOrder); it does not carry its own persistence
// id, because `board_swimlanes` is keyed uniquely by (board_id, status_id)
// (`ux_board_swimlanes_board_id_status_id` in the frozen schema) - Infrastructure can diff and
// upsert against that composite key without this layer tracking row identity across a reorder.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'

export const BOARD_NAME_MAX_LENGTH = 150
export const BOARD_DESCRIPTION_MAX_LENGTH = 500
export const MIN_SWIMLANES = 2

/**
 * Raised when a caller asks this module to put a Board into an invalid state. Carries the
 * field the violation belongs to, mirroring `IdeaDomainError`, so the Application layer can
 * translate it into a field-keyed `ValidationError` instead of letting a bare `Error` become a
 * 500 (SPEC/decisions.md 2026-09-06 "Wave B conventions").
 */
export class BoardInvariantError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'BoardInvariantError'
    this.field = field
  }
}

/**
 * An archived board refuses edits to its own settings - name, description, lanes and their order -
 * until it is unarchived (SPEC/20-feature-boards-and-statuses.md rule 13). The contract answers
 * `409`, so this is a sibling of `BoardInvariantError` rather than a subclass: every catch site of
 * that one answers a field-keyed `400`.
 */
export class BoardArchivedError extends Error {
  constructor() {
    super('This board is archived. Unarchive it first.')
    this.name = 'BoardArchivedError'
  }
}

export type BoardSwimlane = {
  readonly statusId: string
  readonly displayOrder: number
}

export type Board = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  /** Trimmed; `null` when the board has none - a blank description is stored as none. */
  readonly description: string | null
  /** Controls whether the User role can move ideas on this board. */
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly BoardSwimlane[]
  /** Archived in place of deletion (rule 13): kept with its lanes and ideas, but read-only. */
  readonly isArchived: boolean
  readonly archivedAtUtc: Date | null
}

/**
 * The max-length half restores the `[MaxLengthField]` request attribute the .NET contracts
 * carried (`CreateBoardRequest` / `UpdateBoardRequest`) - `BOARD_NAME_MAX_LENGTH` was ported but
 * the check was not, so an over-long name reached a `VarChar(150)` column and Postgres's `22001`
 * surfaced as a 500 instead of the field-keyed 400 the contract requires. Same shape as
 * `packages/domain/src/comments/comment.ts`.
 */
function requireName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    throw new BoardInvariantError('name', 'Name is required.')
  }
  if (trimmed.length > BOARD_NAME_MAX_LENGTH) {
    throw new BoardInvariantError(
      'name',
      `Name must be ${BOARD_NAME_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

function normalizeDescription(description: string | null): string | null {
  const trimmed = description?.trim() ?? ''
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > BOARD_DESCRIPTION_MAX_LENGTH) {
    throw new BoardInvariantError(
      'description',
      `Description must be ${BOARD_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

/** Turns a caller-ordered list of status ids into dense, validated swimlanes. */
function toSwimlanes(orderedStatusIds: readonly string[]): readonly BoardSwimlane[] {
  if (orderedStatusIds.length < MIN_SWIMLANES) {
    throw new BoardInvariantError(
      'swimlanes',
      `A board must have at least ${MIN_SWIMLANES} swimlanes.`,
    )
  }
  if (new Set(orderedStatusIds).size !== orderedStatusIds.length) {
    throw new BoardInvariantError('swimlanes', 'A board cannot list the same status twice.')
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
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly orderedStatusIds: readonly string[]
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): Board {
  if (params.organizationId.trim().length === 0) {
    throw new BoardInvariantError('organizationId', 'Organization id is required.')
  }
  const name = requireName(params.name)
  const description = normalizeDescription(params.description ?? null)
  const swimlanes = toSwimlanes(params.orderedStatusIds)

  return {
    id: params.id,
    organizationId: params.organizationId,
    name,
    description,
    allowUserStatusUpdate: params.allowUserStatusUpdate,
    swimlanes,
    isArchived: false,
    archivedAtUtc: null,
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

/**
 * Updates the board name, the User-role move permission, and the set/order of swimlanes
 * (SPEC/30-Contracts.md `PUT /boards/{id}`). `orderedStatusIds` may add or remove statuses
 * relative to the current swimlanes but must keep at least `MIN_SWIMLANES` distinct statuses
 * (rule #3) and may only draw from the organization's statuses (subset support, validated by the
 * Application layer). An `undefined` description leaves the current one in place; `null` or blank
 * clears it.
 */
export function updateBoard(
  board: Board,
  params: {
    readonly name: string
    readonly description?: string | null | undefined
    readonly allowUserStatusUpdate: boolean
    readonly orderedStatusIds: readonly string[]
  },
  nowUtc: Date,
  actorUserId: string | null,
): Board {
  requireNotArchived(board)
  const name = requireName(params.name)
  const description =
    params.description === undefined ? board.description : normalizeDescription(params.description)
  const swimlanes = toSwimlanes(params.orderedStatusIds)

  return markUpdated(
    { ...board, name, description, allowUserStatusUpdate: params.allowUserStatusUpdate, swimlanes },
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
  requireNotArchived(board)
  const swimlanes = toSwimlanes(orderedStatusIds)

  const current = new Set(board.swimlanes.map((swimlane) => swimlane.statusId))
  const requested = new Set(orderedStatusIds)
  const sameSet =
    current.size === requested.size && [...current].every((statusId) => requested.has(statusId))
  if (!sameSet) {
    throw new BoardInvariantError(
      'swimlanes',
      "A reorder must list exactly the board's current swimlane statuses.",
    )
  }

  return markUpdated({ ...board, swimlanes }, nowUtc, actorUserId)
}

function requireNotArchived(board: Board): void {
  if (board.isArchived) {
    throw new BoardArchivedError()
  }
}

/**
 * Archives the board (rule 13). Idempotent: an archived board comes back unchanged, keeping the
 * time it was first archived, so the caller can tell nothing happened.
 */
export function archiveBoard(board: Board, nowUtc: Date, actorUserId: string | null): Board {
  if (board.isArchived) {
    return board
  }
  return markUpdated({ ...board, isArchived: true, archivedAtUtc: nowUtc }, nowUtc, actorUserId)
}

/** Brings an archived board back unchanged apart from the flag. Idempotent, like `archiveBoard`. */
export function unarchiveBoard(board: Board, nowUtc: Date, actorUserId: string | null): Board {
  if (!board.isArchived) {
    return board
  }
  return markUpdated({ ...board, isArchived: false, archivedAtUtc: null }, nowUtc, actorUserId)
}
