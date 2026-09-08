/**
 * Boards, their swimlanes, and the statuses those lanes draw from.
 *
 * Every reader returns a promise even where the fixture behind it is a constant, because the shape
 * is the contract: after Wave D these are `fetch` calls and the call sites must already be written
 * for one. A reader that returns a single record resolves to `null` when it is missing rather than
 * throwing — `notFound()` is the caller's decision, and the API answers 404 the same way.
 */

import * as fixture from '../mock.js'
import { failIfRequested, resolve } from './latency.js'

export type { Board, BoardAdmin, Status } from '../mock.js'
export { SWIMLANE_FLOOR } from '../mock.js'

export async function getBoards(): Promise<fixture.Board[]> {
  failIfRequested('getBoards')
  return resolve(fixture.boards)
}

export async function getBoard(id: string): Promise<fixture.Board | null> {
  failIfRequested('getBoard')
  return resolve(fixture.boardById(id) ?? null)
}

export async function getStatuses(): Promise<fixture.Status[]> {
  failIfRequested('getStatuses')
  return resolve(fixture.statuses)
}

export async function getStatus(id: string): Promise<fixture.Status | null> {
  return resolve(fixture.statusById(id) ?? null)
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
 */
export async function getNavCounts(): Promise<{ boards: number; ideas: number; backlog: number }> {
  return resolve({
    boards: fixture.navCounts.boards,
    ideas: fixture.navCounts.ideas,
    backlog: fixture.navCounts.backlog,
  })
}
