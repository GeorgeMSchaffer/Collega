// Command and result shapes for board configuration (SPEC/30-Contracts.md "Board Contracts").

/** A requested swimlane: which status, and its position. Order is normalized densely 0..n-1. */
export type SwimlaneInput = {
  readonly statusId: string
  readonly order: number
}

export type CreateBoardCommand = {
  readonly name: string
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInput[]
}

export type UpdateBoardCommand = {
  readonly name: string
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
  /** Live ideas on the board, excluding soft-deleted ones - the same population the board's own
   * idea list counts, so a card reading "11 ideas" opens onto eleven. */
  readonly ideaCount: number
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
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneDetail[]
}

/** Shape matches the `POST /organizations/{id}/boards` create response. */
export type CreateBoardResult = {
  readonly boardId: string
  readonly name: string
  readonly swimlanes: readonly SwimlaneDetail[]
}
