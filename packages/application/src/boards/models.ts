// Command and result shapes for board configuration (SPEC/30-Contracts.md "Board Contracts").

import type { IdeaPhase, Priority } from '@collega/domain/enums'

/** A requested swimlane: which status, and its position. Order is normalized densely 0..n-1. */
export type SwimlaneInput = {
  readonly statusId: string
  readonly order: number
  /** Absent is `false`. A board may have several final lanes. */
  readonly isFinal?: boolean | undefined
  /** The board whose tasks this lane hands work to; absent or `null` is none. */
  readonly referencesBoardId?: string | null | undefined
}

export type CreateBoardCommand = {
  readonly name: string
  /** `null`, blank or absent: no description. */
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInput[]
  /** Absent or blank: no key prefix. */
  readonly keyPrefix?: string | null | undefined
  readonly sprintsEnabled?: boolean | undefined
  readonly ideaFeaturesEnabled?: boolean | undefined
  /** Ideas and backlog Issues to pull onto the new board (SPEC/20-feature-board-pull-in.md). At
   * most 100; absent or empty pulls nothing. */
  readonly pullItemIds?: readonly string[] | undefined
}

export type UpdateBoardCommand = {
  readonly name: string
  /** Absent (`undefined`) leaves the stored description unchanged; `null` or blank clears it. */
  readonly description?: string | null | undefined
  readonly allowUserStatusUpdate: boolean
  readonly swimlanes: readonly SwimlaneInput[]
  /** Absent leaves the stored value unchanged; `null` or blank clears the prefix. */
  readonly keyPrefix?: string | null | undefined
  readonly sprintsEnabled?: boolean | undefined
  readonly ideaFeaturesEnabled?: boolean | undefined
  /** Where the ideas in each removed lane go. Absent is none; required per removed lane that
   * still holds live ideas (SPEC/contracts/boards.md `PUT /boards/{boardId}`). */
  readonly ideaMoves?: readonly IdeaMoveInput[] | undefined
  /** As on create; applied after `ideaMoves`, against the lanes the save leaves. */
  readonly pullItemIds?: readonly string[] | undefined
}

/** One removed lane's ideas, and the lane that stays on the board they move to. */
export type IdeaMoveInput = {
  readonly fromStatusId: string
  readonly toStatusId: string
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
  readonly keyPrefix: string | null
  readonly sprintsEnabled: boolean
  readonly ideaFeaturesEnabled: boolean
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
  readonly isFinal: boolean
  readonly referencesBoardId: string | null
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
  readonly keyPrefix: string | null
  readonly sprintsEnabled: boolean
  readonly ideaFeaturesEnabled: boolean
}

/** A `PUT /boards/{boardId}` result: the detail, plus what was pulled when the save pulled. */
export type UpdateBoardResult = BoardDetail & {
  readonly pulledItems?: readonly PulledItem[]
}

/** Where a pulled item came from and the status it now has. */
export type PulledItem = {
  readonly ideaId: string
  readonly fromBoardId: string | null
  readonly statusId: string
}

/** Shape matches the `POST /organizations/{id}/boards` create response. */
export type CreateBoardResult = {
  readonly boardId: string
  readonly name: string
  readonly swimlanes: readonly SwimlaneDetail[]
  /** Present only when the request pulled items. */
  readonly pulledItems?: readonly PulledItem[]
}

/** Which population `GET /organizations/{id}/boards/pull-candidates` lists. */
export type PullCandidateSource = 'unassigned' | 'boards' | 'backlog'

export type PullCandidatesQuery = {
  readonly source: string | null
  /** The board being created or edited, whose own ideas are never offered. */
  readonly excludeBoardId: string | null
  readonly search: string | null
  readonly tags: readonly string[]
  readonly authorUserId: string | null
  readonly page: number | null
  readonly pageSize: number | null
}

/** One card in the pull picker. */
export type PullCandidate = {
  readonly ideaId: string
  readonly title: string
  readonly authorUserId: string
  readonly authorName: string
  readonly boardId: string | null
  readonly boardName: string | null
  readonly statusId: string
  readonly statusName: string
  readonly phase: IdeaPhase
  readonly tags: readonly string[]
  readonly priority: Priority | null
  readonly upvoteCount: number
  readonly isMine: boolean
}
