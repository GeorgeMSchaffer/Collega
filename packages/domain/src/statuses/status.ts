// Organization-scoped workflow status (SPEC/20-feature-boards-and-statuses.md "Status Rules").
// Provisioned as the canonical default set when an organization is created; full status
// management (rename, recolor, reorder, soft-delete with the 2-active-status floor) is the
// Application layer's responsibility and is only partially modelled here.
//
// Modelled as plain immutable data plus functions rather than a class: every mutation here
// already takes an explicit `nowUtc` and `actorUserId` from the caller (no ambient time, no
// ambient identity), so a class wrapping that state buys nothing a return value doesn't.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'

export const STATUS_NAME_MAX_LENGTH = 100
export const STATUS_COLOR_MAX_LENGTH = 20

/**
 * An organization must retain at least this many active statuses at all times
 * (SPEC/20-feature-boards-and-statuses.md "Status Rules" #7) so a board's own 2-swimlane
 * minimum can always be satisfied.
 */
export const MIN_ACTIVE_STATUSES_PER_ORGANIZATION = 2

/**
 * Raised when a caller asks this module to put a Status into an invalid state. Carries the
 * field the violation belongs to, mirroring `IdeaDomainError`, so the Application layer can
 * translate it into a field-keyed `ValidationError` instead of letting a bare `Error` become a
 * 500 (SPEC/decisions.md 2026-09-06 "Wave B conventions").
 */
export class StatusInvariantError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'StatusInvariantError'
    this.field = field
  }
}

export type Status = Auditable & {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  /** Hex/CSS color for the swimlane dot and idea-card status chip (rule #9). */
  readonly color: string
  /** Organization-level catalog order, distinct from a board's swimlane order (rule #10). */
  readonly sortOrder: number
  readonly isDeleted: boolean
}

/** `label` is both the field key (lowercased) and the message's spaced display name. */
function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new StatusInvariantError(label.toLowerCase(), `${label} is required.`)
  }
  return trimmed
}

export function createStatus(params: {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly color: string
  readonly sortOrder: number
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): Status {
  if (params.organizationId.trim().length === 0) {
    throw new StatusInvariantError('organizationId', 'Organization id is required.')
  }
  const name = requireNonBlank(params.name, 'Name')
  const color = requireNonBlank(params.color, 'Color')

  return {
    id: params.id,
    organizationId: params.organizationId,
    name,
    color,
    sortOrder: params.sortOrder,
    isDeleted: false,
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

/** Renames, recolors, and reorders an active status (rules #9-10). */
export function updateStatus(
  status: Status,
  params: { readonly name: string; readonly color: string; readonly sortOrder: number },
  nowUtc: Date,
  actorUserId: string | null,
): Status {
  if (status.isDeleted) {
    throw new StatusInvariantError('status', 'A deleted status cannot be updated.')
  }
  const name = requireNonBlank(params.name, 'Name')
  const color = requireNonBlank(params.color, 'Color')

  return markUpdated({ ...status, name, color, sortOrder: params.sortOrder }, nowUtc, actorUserId)
}

/**
 * Sets only the catalog sort order, leaving name and color untouched. Used by the atomic bulk
 * reorder so a drag-reorder does not re-validate unrelated fields.
 */
export function setStatusSortOrder(
  status: Status,
  sortOrder: number,
  nowUtc: Date,
  actorUserId: string | null,
): Status {
  return markUpdated({ ...status, sortOrder }, nowUtc, actorUserId)
}

/**
 * Soft-deletes the status so existing board and idea references stay valid (rule #5). Idempotent.
 * The org-wide 2-active-status floor (#7) and the no-active-board-reference guard (#6) are
 * enforced by the Application layer before this is called.
 */
export function softDeleteStatus(status: Status, nowUtc: Date, actorUserId: string | null): Status {
  if (status.isDeleted) {
    return status
  }
  return markUpdated({ ...status, isDeleted: true }, nowUtc, actorUserId)
}
