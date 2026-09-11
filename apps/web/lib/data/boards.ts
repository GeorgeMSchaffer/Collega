/**
 * Boards, their swimlanes, and the statuses those lanes draw from.
 *
 * The board readers now call the API. Every one still returns a promise and still resolves to
 * `null` for a missing record rather than throwing — `notFound()` is the caller's decision, and the
 * API answers 404 the same way — so the call sites did not change when the bodies did. That was the
 * point of writing them against a promise from the start.
 *
 * The status readers are real too, as of the slice that converted `settings/statuses` and
 * `settings/boards/*`. They were held back while those screens were fixture-backed — a real status
 * carries a UUID a fixture board's `statusId` matches nowhere — and that reason expired with the
 * last fixture screen that could have joined the two.
 */

import { swimlaneToStatus, toStatus } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type {
  WireBoardDetail,
  WireBoardListItem,
  WireIdeaListItem,
  WirePage,
  WireStatus,
} from '../api/wire'
import * as fixture from '../mock'
import type { Board, BoardAdmin, BoardWithLanes, Status } from '../types'
import { failIfRequested, resolve } from './latency'
import { everyOrganization, organizationScope } from './scope'

export { SWIMLANE_FLOOR } from '../mock'
export type { Board, BoardAdmin, BoardWithLanes, Status } from '../types'

/**
 * The organization's boards, each with the number of ideas on it.
 *
 * One request, whatever the organization holds. The count arrives on the list item beside
 * `swimlaneCount`, where the API produces both from rows it is already reading. Asking each
 * board's own idea endpoint for its `totalCount` would also avoid transferring rows, but it costs
 * a round trip per board from a single render, and `/organizations/{id}/boards` does not page.
 */
export async function getBoards(): Promise<Board[]> {
  failIfRequested('getBoards')

  const scope = organizationScope()
  if (scope === null) return []

  const boards = await apiGet<readonly WireBoardListItem[]>(
    'getBoards',
    apiPath`/organizations/${scope}/boards`,
  )

  return boards.map((board) => ({
    id: board.boardId,
    name: board.name,
    laneCount: board.swimlaneCount,
    ideaCount: board.ideaCount,
  }))
}

/**
 * One board and the lanes it actually defines.
 *
 * The lanes come from the board, not from the organization's status catalog. Those are different
 * questions and the fixture conflated them: a board picks a subset of the statuses in its own
 * order, so rendering the catalog would show a lane the board does not have — which is exactly what
 * `settings/boards/[boardId]`'s swimlane picker exists to configure.
 */
export async function getBoard(id: string): Promise<BoardWithLanes | null> {
  failIfRequested('getBoard')

  try {
    const board = await apiGet<WireBoardDetail>('getBoard', apiPath`/boards/${id}`)
    return {
      id: board.boardId,
      name: board.name,
      allowUserStatusUpdate: board.allowUserStatusUpdate,
      // Deleted statuses still hold ideas that have to go somewhere, so their lane stays on the
      // board — hiding it would silently drop cards off a screen that claims to show all of them.
      lanes: [...board.swimlanes].sort((a, b) => a.order - b.order).map(swimlaneToStatus),
    }
  } catch (error) {
    // A board in another organization answers 404, not 403 — the API declines to confirm it exists,
    // and so does this. `null` rather than a throw, so the caller reaches `notFound()`.
    if (isApiStatus(error, 404)) return null
    throw error
  }
}

/**
 * The same boards again, as `/settings/boards` administers them.
 *
 * A second projection of `GET /organizations/{id}/boards` rather than a second request shape: that
 * response carries the lane count and the user-moves flag beside the idea count, so the two screens
 * ask the same endpoint different questions. Splitting them is what keeps `Board` — the type the
 * workspace list and the ideas table render — from growing a field only the settings table reads.
 */
export async function getBoardAdmin(): Promise<BoardAdmin[]> {
  failIfRequested('getBoardAdmin')

  const scope = organizationScope()
  if (scope === null) return []

  const boards = await apiGet<readonly WireBoardListItem[]>(
    'getBoardAdmin',
    apiPath`/organizations/${scope}/boards`,
  )

  return boards.map((board) => ({
    id: board.boardId,
    name: board.name,
    laneCount: board.swimlaneCount,
    userStatusMoves: board.allowUserStatusUpdate,
  }))
}

/**
 * The organization's status catalog, in the order it defines.
 *
 * The API sorts by `sortOrder` then name (`StatusService.list`), and that order is the setting —
 * comp P's lead says so: "Order here is the order on every board." So nothing is re-sorted here.
 *
 * Soft-deleted statuses are excluded, because `includeDeleted` is absent: an archived status is not
 * part of the catalog an administrator is configuring, and a board that still has one as a lane
 * gets it from its own swimlanes rather than from here.
 */
export async function getStatuses(): Promise<Status[]> {
  failIfRequested('getStatuses')

  const scope = organizationScope()
  if (scope === null) return []

  return (
    await apiGet<readonly WireStatus[]>('getStatuses', apiPath`/organizations/${scope}/statuses`)
  ).map(toStatus)
}

/**
 * Every organization's statuses, for the cross-organization list a Site Admin reads.
 *
 * One request per organization plus one for the list of them — see `everyOrganization` for why
 * that fan-out is the shape of the data rather than a missing endpoint. A Site Admin may read any
 * organization's catalog (`StatusService.ensureReadScope`) and may change none of it, which is
 * exactly the screen comp P draws for that role.
 */
export async function getStatusesByOrganization(): Promise<
  { organization: string; statuses: Status[] }[]
> {
  failIfRequested('getStatusesByOrganization')

  const organizations = await everyOrganization('getStatusesByOrganization')

  return Promise.all(
    organizations.map(async (organization) => ({
      organization: organization.name,
      statuses: (
        await apiGet<readonly WireStatus[]>(
          'getStatusesByOrganization',
          apiPath`/organizations/${organization.id}/statuses`,
        )
      ).map(toStatus),
    })),
  )
}

/**
 * The sidebar's counts.
 *
 * A single reader rather than one per figure: the sidebar renders them together, and three
 * separate awaits would be three round trips once this is a real API.
 *
 * Boards and ideas are real; `backlog` counts the delivery fixture, which has no endpoint behind it
 * yet. A count that is a fixture sitting beside two that are not is the honest state of a partly
 * converted app, and the alternative — leaving all three on the fixture — would have the sidebar
 * disagree with the boards page it links to.
 */
export async function getNavCounts(): Promise<{ boards: number; ideas: number; backlog: number }> {
  const scope = organizationScope()
  if (scope === null) {
    return resolve({ boards: 0, ideas: 0, backlog: fixture.navCounts.backlog })
  }

  const [boards, ideas] = await Promise.all([
    apiGet<readonly WireBoardListItem[]>('getNavCounts', apiPath`/organizations/${scope}/boards`),
    apiGet<WirePage<WireIdeaListItem>>(
      'getNavCounts',
      apiPath`/organizations/${scope}/ideas?pageSize=1`,
    ),
  ])

  return { boards: boards.length, ideas: ideas.totalCount, backlog: fixture.navCounts.backlog }
}
