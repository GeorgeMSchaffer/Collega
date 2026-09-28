// Command and result shapes for board configuration (SPEC/30-Contracts.md "Board Contracts").

/** A requested swimlane: which status, and its position. Order is normalized densely 0..n-1. */
export type SwimlaneInput = {
  readonly statusId: string
  readonly order: number
}

export type CreateBoardCommand = {
  readonly name: string
  /** `null`, blank or absent: no description. */
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInput[]
}

export type UpdateBoardCommand = {
  readonly name: string
  /** Absent (`undefined`) leaves the stored description unchanged; `null` or blank clears it. */
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInput[]
}

export type ReorderSwimlanesCommand = {
  readonly swimlanes: readonly SwimlaneInput[]
}

/** Shape matches a `GET /organizations/{id}/boards` list item. */
export type BoardListItem = {
  readonly boardId: string
  readonly organizationId: string
  readonly name: string
  readonly allowUserStatusUpdate: boolean
  readonly swimlaneCount: number
  /** Live, Discovery-phase ideas on the board - the same population the board's own idea list
   * counts, so a card reading "11 ideas" opens onto eleven. */
  readonly ideaCount: number
  readonly description: string | null
  readonly createdAtUtc: Date
  /** `null` when the board records no creator, or the creator no longer resolves to a user. */
  readonly createdBy: BoardCreator | null
  /** Every swimlane in order, zero-count lanes included, over the same ideas as `ideaCount`. */
  readonly laneCounts: readonly BoardLaneCount[]
  /** At most three, by idea count descending then name ascending. */
  readonly topTags: readonly BoardTagCount[]
  /** Distinct tags across the same ideas as `ideaCount`. */
  readonly tagCount: number
  /** Archived in place of deletion (2026-09-27); listed only with `includeArchived`. */
  readonly isArchived: boolean
  readonly archivedAtUtc: Date | null
}

export type BoardListQuery = {
  /** Default `false`: archived boards leave the default list and every board picker. */
  readonly includeArchived: boolean
}

export type BoardCreator = {
  readonly userId: string
  readonly displayName: string
}

export type BoardLaneCount = {
  readonly statusId: string
  readonly statusName: string
  readonly statusColor: string
  readonly order: number
  readonly ideaCount: number
}

export type BoardTagCount = {
  readonly name: string
  readonly ideaCount: number
  /** The tag's `#RRGGBB` colour (added 2026-09-28). */
  readonly color: string
}

/** A resolved swimlane on a board detail, carrying the referenced status's display fields. */
export type SwimlaneDetail = {
  readonly statusId: string
  readonly statusName: string
  readonly statusColor: string
  readonly order: number
  readonly statusIsDeleted: boolean
}

/** Shape matches `GET /boards/{id}` detail. */
export type BoardDetail = {
  readonly boardId: string
  readonly organizationId: string
  readonly name: string
  readonly description: string | null
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneDetail[]
  /** The same two fields the list item carries, so a board's own page can open read-only. */
  readonly isArchived: boolean
  readonly archivedAtUtc: Date | null
}

/** Shape matches the `POST /organizations/{id}/boards` create response. */
export type CreateBoardResult = {
  readonly boardId: string
  readonly name: string
  readonly swimlanes: readonly SwimlaneDetail[]
}
