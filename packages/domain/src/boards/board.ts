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

export const KEY_PREFIX_MIN_LENGTH = 2
export const KEY_PREFIX_MAX_LENGTH = 10
const KEY_PREFIX_PATTERN = /^[A-Z0-9]+$/

/** A requested lane: the status, whether it is a final lane, the board it hands work to, and
 * whether entering it creates a task there. */
export type SwimlaneLane = {
  readonly statusId: string
  readonly isFinal: boolean
  readonly referencesBoardId: string | null
  /** Absent is `false`; a stored lane always carries it. */
  readonly autoCreateTask?: boolean | undefined
}

export type BoardSwimlane = SwimlaneLane & {
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
  /** 2 to 10 `A-Z0-9`, upper-cased; `null` when the board issues no item keys. */
  readonly keyPrefix: string | null
  readonly sprintsEnabled: boolean
  readonly ideaFeaturesEnabled: boolean
  /** The number the next item on this board takes. Never written back from a stale copy. */
  readonly nextItemNumber: number
  /** The idea types the board takes; empty takes every active type (rule 15). */
  readonly allowedIdeaTypeIds: readonly string[]
}

/**
 * Whether the board takes ideas of `ideaTypeId` (SPEC/20-feature-boards-and-statuses.md rule 15).
 * The list applies only while Idea features are on, and an empty list takes every type.
 */
export function boardTakesIdeaType(
  board: {
    readonly ideaFeaturesEnabled: boolean
    readonly allowedIdeaTypeIds?: readonly string[] | undefined
  },
  ideaTypeId: string,
): boolean {
  const allowed = board.allowedIdeaTypeIds ?? []
  // Lowercased: a GUID from the request keeps the caller's case, and PostgreSQL matches either.
  const id = ideaTypeId.toLowerCase()
  return (
    !board.ideaFeaturesEnabled ||
    allowed.length === 0 ||
    allowed.some((allowedId) => allowedId.toLowerCase() === id)
  )
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

/** Upper-cases and validates a key prefix; blank or `null` is none. */
function normalizeKeyPrefix(keyPrefix: string | null): string | null {
  const trimmed = keyPrefix?.trim() ?? ''
  if (trimmed.length === 0) {
    return null
  }
  const upper = trimmed.toUpperCase()
  if (
    upper.length < KEY_PREFIX_MIN_LENGTH ||
    upper.length > KEY_PREFIX_MAX_LENGTH ||
    !KEY_PREFIX_PATTERN.test(upper)
  ) {
    throw new BoardInvariantError(
      'keyPrefix',
      `Key prefix must be ${KEY_PREFIX_MIN_LENGTH} to ${KEY_PREFIX_MAX_LENGTH} characters, A-Z and 0-9 only.`,
    )
  }
  return upper
}

/**
 * The prefix a new board gets when none is given: the initials of its name, or the first two
 * letters when the name has fewer than two words. A clash with a prefix already taken in the
 * organization gets a number appended (CI, CI2, CI3). Always 2 to 10 characters of A-Z and 0-9.
 */
export function deriveKeyPrefix(name: string, taken: readonly string[]): string {
  const words = name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((word) => word.length > 0)
  const letters = words.join('')
  const initials = words.map((word) => word.charAt(0)).join('')
  const base = (
    initials.length >= KEY_PREFIX_MIN_LENGTH ? initials : (letters + 'BD').slice(0, 2)
  ).slice(0, KEY_PREFIX_MAX_LENGTH)
  if (!taken.includes(base)) {
    return base
  }
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, KEY_PREFIX_MAX_LENGTH - String(n).length)}${n}`
    if (!taken.includes(candidate)) {
      return candidate
    }
  }
}

/** Turns caller-ordered lanes into dense, validated swimlanes. */
function toSwimlanes(orderedLanes: readonly SwimlaneLane[]): readonly BoardSwimlane[] {
  const orderedStatusIds = orderedLanes.map((lane) => lane.statusId)
  if (orderedStatusIds.length < MIN_SWIMLANES) {
    throw new BoardInvariantError(
      'swimlanes',
      `A board must have at least ${MIN_SWIMLANES} swimlanes.`,
    )
  }
  if (new Set(orderedStatusIds).size !== orderedStatusIds.length) {
    throw new BoardInvariantError('swimlanes', 'A board cannot list the same status twice.')
  }
  return orderedLanes.map((lane, displayOrder) => ({
    statusId: lane.statusId,
    isFinal: lane.isFinal,
    referencesBoardId: lane.referencesBoardId,
    autoCreateTask: lane.autoCreateTask === true,
    displayOrder,
  }))
}

/**
 * Creates a board with its swimlanes. `orderedLanes` must contain at least `MIN_SWIMLANES`
 * lanes on distinct statuses; display order follows the given sequence.
 */
export function createBoard(params: {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly orderedLanes: readonly SwimlaneLane[]
  readonly keyPrefix?: string | null | undefined
  readonly sprintsEnabled?: boolean | undefined
  readonly ideaFeaturesEnabled?: boolean | undefined
  /** Absent or empty: every type. The Application layer has already checked the ids. */
  readonly allowedIdeaTypeIds?: readonly string[] | undefined
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): Board {
  if (params.organizationId.trim().length === 0) {
    throw new BoardInvariantError('organizationId', 'Organization id is required.')
  }
  const name = requireName(params.name)
  const description = normalizeDescription(params.description ?? null)
  const swimlanes = toSwimlanes(params.orderedLanes)
  const keyPrefix = normalizeKeyPrefix(params.keyPrefix ?? null)

  return {
    id: params.id,
    organizationId: params.organizationId,
    name,
    description,
    allowUserStatusUpdate: params.allowUserStatusUpdate,
    swimlanes,
    isArchived: false,
    archivedAtUtc: null,
    keyPrefix,
    sprintsEnabled: params.sprintsEnabled ?? false,
    ideaFeaturesEnabled: params.ideaFeaturesEnabled ?? true,
    nextItemNumber: 1,
    allowedIdeaTypeIds: params.allowedIdeaTypeIds ?? [],
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

/**
 * Updates the board name, the User-role move permission, and the set/order of swimlanes
 * (SPEC/30-Contracts.md `PUT /boards/{id}`). `orderedStatusIds` may add or remove statuses
 * relative to the current swimlanes but must keep at least `MIN_SWIMLANES` distinct statuses
 * (rule #3) and may only draw from the organization's statuses (subset support, validated by the
 * Application layer). An `undefined` description, key prefix or flag leaves the current one in
 * place; a `null` or blank description or key prefix clears it.
 */
export function updateBoard(
  board: Board,
  params: {
    readonly name: string
    readonly description?: string | null | undefined
    readonly allowUserStatusUpdate: boolean
    readonly orderedLanes: readonly SwimlaneLane[]
    readonly keyPrefix?: string | null | undefined
    readonly sprintsEnabled?: boolean | undefined
    readonly ideaFeaturesEnabled?: boolean | undefined
  },
  nowUtc: Date,
  actorUserId: string | null,
): Board {
  requireNotArchived(board)
  const name = requireName(params.name)
  const description =
    params.description === undefined ? board.description : normalizeDescription(params.description)
  const swimlanes = toSwimlanes(params.orderedLanes)
  const keyPrefix =
    params.keyPrefix === undefined ? board.keyPrefix : normalizeKeyPrefix(params.keyPrefix)

  return markUpdated(
    {
      ...board,
      name,
      description,
      allowUserStatusUpdate: params.allowUserStatusUpdate,
      swimlanes,
      keyPrefix,
      sprintsEnabled: params.sprintsEnabled ?? board.sprintsEnabled,
      ideaFeaturesEnabled: params.ideaFeaturesEnabled ?? board.ideaFeaturesEnabled,
    },
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
  const byStatus = new Map(board.swimlanes.map((swimlane) => [swimlane.statusId, swimlane]))
  // An id the board does not have carries no flags; the same-set check below refuses it.
  const swimlanes = toSwimlanes(
    orderedStatusIds.map(
      (statusId) => byStatus.get(statusId) ?? { statusId, isFinal: false, referencesBoardId: null },
    ),
  )

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

/**
 * Replaces the idea types the board takes (rule 15). Refused on an archived board, like every
 * other setting. Ideas already on the board are not touched. The Application layer has already
 * checked the ids against the organization's idea types and put them in their sort order.
 */
export function setAllowedIdeaTypes(
  board: Board,
  ideaTypeIds: readonly string[],
  nowUtc: Date,
  actorUserId: string | null,
): Board {
  requireNotArchived(board)
  return markUpdated({ ...board, allowedIdeaTypeIds: [...ideaTypeIds] }, nowUtc, actorUserId)
}

function requireNotArchived(board: Board): void {
  if (board.isArchived) {
    throw new BoardArchivedError()
  }
}

/**
 * Turns the idea features off, as happens when a board is first named as a reference target
 * (SPEC/contracts/boards.md "Board References"). Idempotent.
 */
export function disableIdeaFeatures(board: Board, nowUtc: Date, actorUserId: string | null): Board {
  if (!board.ideaFeaturesEnabled) {
    return board
  }
  return markUpdated({ ...board, ideaFeaturesEnabled: false }, nowUtc, actorUserId)
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
