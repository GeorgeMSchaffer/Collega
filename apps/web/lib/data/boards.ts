/**
 * Boards, their swimlanes, and the statuses those lanes draw from.
 *
 * The board readers now call the API. Every one still returns a promise and still resolves to
 * `null` for a missing record rather than throwing — `notFound()` is the caller's decision, and the
 * API answers 404 the same way — so the call sites did not change when the bodies did. That was the
 * point of writing them against a promise from the start.
 *
 * The status readers are still fixture-backed, because the screens that use them
 * (`settings/statuses`, `settings/boards/*`) are still fixture-backed and a half-real screen is
 * worse than an honest fixture: real statuses carry UUIDs, and a fixture idea's `statusId` would
 * match none of them. `/ideas` is off that list now, and not by converting them — a real idea
 * arrives carrying its own status name, so the list has nothing left to look up.
 */

import { swimlaneToStatus } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type { WireBoardDetail, WireBoardListItem, WireIdeaListItem, WirePage } from '../api/wire'
import * as fixture from '../mock'
import type { Board, BoardWithLanes } from '../types'
import { failIfRequested, resolve } from './latency'
import { organizationScope } from './scope'

export type { BoardAdmin } from '../mock'
export { SWIMLANE_FLOOR } from '../mock'
export type { Board, BoardWithLanes, Status } from '../types'

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
 * The boards the still-fixture screens see.
 *
 * The idea inspector and `settings/boards` both join a board id against a fixture — a fixture
 * idea's `boardId`, a `BoardAdmin` row — so handing them real boards would join UUIDs
 * against `'ideas'` and render a row with no board name. Named for what it is, so it is obvious
 * which screens are still waiting and so that converting one of them deletes a call site rather
 * than changing a meaning.
 */
export async function getFixtureBoards(): Promise<Board[]> {
  failIfRequested('getFixtureBoards')
  return resolve(fixture.boards)
}

export async function getFixtureBoard(id: string): Promise<Board | null> {
  return resolve(fixture.boardById(id) ?? null)
}

export async function getStatuses(): Promise<fixture.Status[]> {
  failIfRequested('getStatuses')
  return resolve(fixture.statuses)
}

export async function getStatusesForOrganization(
  organizationId: string,
): Promise<fixture.Status[]> {
  failIfRequested('getStatusesForOrganization')
  return resolve(fixture.statusesByOrganization[organizationId] ?? [])
}

/** Every organization's statuses, for the cross-organization list a Site Admin reads. */
export async function getStatusesByOrganization(): Promise<Record<string, fixture.Status[]>> {
  failIfRequested('getStatusesByOrganization')
  return resolve(fixture.statusesByOrganization)
}

export async function getBoardAdmin(): Promise<fixture.BoardAdmin[]> {
  failIfRequested('getBoardAdmin')
  return resolve(fixture.boardAdmin)
}

export async function getBoardAdminEntry(id: string): Promise<fixture.BoardAdmin | null> {
  return resolve(fixture.boardAdminById(id) ?? null)
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
