/**
 * The Tasks page's readers: the tasks on every work board of the organization, in one list
 * (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-8). No route of its own: a work board is
 * one some other board's lane references, so the page passes those boards' ids to the organization
 * idea list and lets the API filter, as the contract says.
 */

import { apiGet, apiPath } from '../api/client'
import type { WireBoardListItem } from '../api/wire'
import { API_MAX_PAGE_SIZE } from '../limits'
import type { Idea, IdeaListQuery, IdeaPage, SprintState } from '../types'
import { getBoardSprints } from './delivery'
import { getIdeaList } from './ideas'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'

export type TaskTab = 'backlog' | 'mine' | 'sprint' | 'all'

export type WorkBoard = { id: string; name: string; sprintsEnabled: boolean }

/** A sprint a task could be moved into: Planned or Active, never Completed. */
export type OpenSprint = { id: string; name: string; state: SprintState }

/** The organization's work boards: active boards that some other board's lane references. */
export async function getWorkBoards(): Promise<WorkBoard[]> {
  failIfRequested('getWorkBoards')

  const scope = organizationScope()
  if (scope === null) return []

  const boards = await apiGet<readonly WireBoardListItem[]>(
    'getWorkBoards',
    apiPath`/organizations/${scope}/boards`,
  )
  return boards
    .filter((board) => !board.isArchived && board.referencedByBoardIds.length > 0)
    .map((board) => ({
      id: board.boardId,
      name: board.name,
      sprintsEnabled: board.sprintsEnabled,
    }))
}

/** Each sprint-enabled work board's Planned and Active sprints, keyed by board id. */
export async function getOpenSprintsByBoard(
  boards: readonly WorkBoard[],
): Promise<Record<string, OpenSprint[]>> {
  const enabled = boards.filter((board) => board.sprintsEnabled)
  const lists = await Promise.all(enabled.map((board) => getBoardSprints(board.id)))
  return Object.fromEntries(
    enabled.map((board, index) => [
      board.id,
      (lists[index] ?? [])
        .filter((sprint) => sprint.state !== 'Completed')
        .map((sprint) => ({ id: sprint.id, name: sprint.name, state: sprint.state })),
    ]),
  )
}

const BASE: Omit<IdeaListQuery, 'boardIds' | 'pageSize'> = {
  search: '',
  statusIds: [],
  priorities: [],
  tags: [],
  sortBy: 'createdAt',
  sortDirection: 'desc',
  page: 1,
}

/**
 * One tab's tasks, newest first, at the API's page maximum (`pageSize: 1` asks for the count only).
 *
 * Backlog and My tasks leave finished work out; In sprint and All do not, since a finished task is
 * still part of its sprint's story. The API has no "in any sprint" filter, so In sprint asks once
 * per open sprint and merges, which is exact where filtering a page in the client would not be.
 */
export async function getTasks(
  tab: TaskTab,
  boards: readonly WorkBoard[],
  sprints: Record<string, OpenSprint[]>,
  pageSize: number = API_MAX_PAGE_SIZE,
): Promise<IdeaPage> {
  const empty: IdeaPage = { ideas: [], page: 1, pageSize, totalCount: 0 }
  if (boards.length === 0) return empty
  const boardIds = boards.map((board) => board.id)
  const base = { ...BASE, boardIds, pageSize }

  switch (tab) {
    case 'backlog':
      return getIdeaList({ ...base, sprintId: 'none', hideFinal: true })
    case 'mine':
      return getIdeaList({ ...base, scope: 'assigned', hideFinal: true })
    case 'all':
      return getIdeaList(base)
    case 'sprint': {
      const pages = await Promise.all(
        boards.flatMap((board) =>
          (sprints[board.id] ?? []).map((sprint) =>
            getIdeaList({ ...base, boardIds: [board.id], sprintId: sprint.id }),
          ),
        ),
      )
      const ideas: Idea[] = pages.flatMap((page) => page.ideas)
      return {
        ideas: ideas.slice(0, pageSize),
        page: 1,
        pageSize,
        totalCount: pages.reduce((sum, page) => sum + page.totalCount, 0),
      }
    }
  }
}
