/**
 * Ideas, the comments on them, and what the idea form chooses from.
 *
 * A board's ideas and the organization's ideas are separate readers rather than one list the caller
 * filters, because they are separate requests: the API scopes by board server-side, and pulling
 * every idea to drop most of them is the shape that quietly stops scaling.
 *
 * **Every reader in this module is real**, and both lists filter, sort and page in the API (the list
 * pattern in `SPEC/30-Contracts.md`). Filtering one page in the client would report "3 results" from
 * the ten rows that happened to arrive.
 */

import { toBoardTask, toIdea, toIdeaDetail, toIdeaFormField, toMemberOption } from '../api/adapt'
import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type {
  WireBoardTask,
  WireBusinessImpact,
  WireIdeaDetail,
  WireIdeaListItem,
  WireIdeaType,
  WireMember,
  WirePage,
} from '../api/wire'
import { API_MAX_PAGE_SIZE } from '../limits'
import type {
  BoardTask,
  Idea,
  IdeaDetail,
  IdeaFormOptions,
  IdeaListQuery,
  IdeaPage,
} from '../types'
import { getBoard, getReferenceContext } from './boards'
import { failIfRequested } from './latency'
import { organizationScope } from './scope'
import { getTagRefs } from './tags'

export type {
  Comment,
  Idea,
  IdeaDetail,
  IdeaFormField,
  IdeaFormOptions,
  IdeaListQuery,
  IdeaPage,
  Priority,
} from '../types'

function listParams(query: IdeaListQuery): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  })
  if (query.search.trim()) params.set('search', query.search.trim())
  for (const id of query.boardIds) params.append('boardId', id)
  for (const id of query.statusIds) params.append('statusId', id)
  for (const priority of query.priorities) params.append('priority', priority)
  for (const tag of query.tags) params.append('tag', tag)
  if (query.scope) params.set('scope', query.scope)
  if (query.phase) params.set('phase', query.phase)
  if (query.sprintId) params.set('sprintId', query.sprintId)
  if (query.hideFinal) params.set('hideFinal', 'true')
  if (query.sortBy) {
    params.set('sortBy', query.sortBy)
    params.set('sortDirection', query.sortDirection)
  }
  return params
}

function toPage(result: WirePage<WireIdeaListItem>): IdeaPage {
  return {
    ideas: result.items.map(toIdea),
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
  }
}

/**
 * One page of every idea in the organization, across every board, archived ones included.
 *
 * **Newest first when unsorted**, where the API's default is oldest first: an idea raised a minute
 * ago is the first row rather than the last row of the last page, which is exactly what someone
 * checks after creating one.
 */
export async function getIdeaList(query: IdeaListQuery): Promise<IdeaPage> {
  failIfRequested('getIdeaList')

  const scope = organizationScope()
  if (scope === null) return { ideas: [], page: 1, pageSize: query.pageSize, totalCount: 0 }

  const params = listParams(query)
  if (!query.sortBy) {
    params.set('sortBy', 'createdAt')
    params.set('sortDirection', 'desc')
  }

  return toPage(
    await apiGet<WirePage<WireIdeaListItem>>(
      'getIdeaList',
      withQuery(apiPath`/organizations/${scope}/ideas`, params),
    ),
  )
}

/**
 * One page of one board's ideas. The lanes view asks for a single page of 100 — the API's maximum —
 * and says so when a board holds more; paging lanes is a design question, not a query string.
 * `boardIds` is ignored: every item is on this board.
 */
export async function getBoardIdeaList(boardId: string, query: IdeaListQuery): Promise<IdeaPage> {
  failIfRequested('getBoardIdeaList')

  return toPage(
    await apiGet<WirePage<WireIdeaListItem>>(
      'getBoardIdeaList',
      withQuery(
        apiPath`/boards/${boardId}/ideas`,
        listParams({ ...query, boardIds: [], scope: undefined, phase: undefined }),
      ),
    ),
  )
}

/**
 * A work board's Backlog: its live tasks and standalone cards in no sprint, finished work left out
 * (`SPEC/20-feature-task-backlog-and-sprint-planning.md` TB-1). Both filters are the API's. Newest
 * first, at the API's page maximum; `pageSize: 1` is the cheap way to ask only for the count.
 */
export function getBacklog(
  boardId: string,
  pageSize: number = API_MAX_PAGE_SIZE,
): Promise<IdeaPage> {
  return getBoardIdeaList(boardId, {
    search: '',
    boardIds: [],
    statusIds: [],
    priorities: [],
    tags: [],
    sortBy: 'createdAt',
    sortDirection: 'desc',
    page: 1,
    pageSize,
    sprintId: 'none',
    hideFinal: true,
  })
}

/** A work board's cards in one sprint (`sprintId`), at the API's page maximum, oldest first. */
export function getSprintTasks(boardId: string, sprintId: string): Promise<IdeaPage> {
  return getBoardIdeaList(boardId, {
    search: '',
    boardIds: [],
    statusIds: [],
    priorities: [],
    tags: [],
    sortBy: 'createdAt',
    sortDirection: 'asc',
    page: 1,
    pageSize: API_MAX_PAGE_SIZE,
    sprintId,
  })
}

/** An idea a new task can hang under: it sits in a lane that references the work board. */
export type TaskParentChoice = { id: string; itemKey: string | null; title: string }

/**
 * The parent choices for "+ New task" on `boardId` (TB-2): ideas sitting in a lane, on any board,
 * that references this one. The server refuses any other parent with `parentNotInReferenceLane`,
 * so this list only keeps the form from offering one it would refuse.
 */
export async function getTaskParentChoices(boardId: string): Promise<TaskParentChoice[]> {
  failIfRequested('getTaskParentChoices')

  const { referencedBy } = await getReferenceContext(boardId)
  const sources = await Promise.all(referencedBy.map((source) => getBoard(source.id)))
  const pages = await Promise.all(
    sources.flatMap((source) => {
      const laneIds = (source?.lanes ?? [])
        .filter((lane) => lane.referencesBoardId === boardId)
        .map((lane) => lane.id)
      return source && laneIds.length > 0
        ? [
            getBoardIdeaList(source.id, {
              search: '',
              boardIds: [],
              statusIds: laneIds,
              priorities: [],
              tags: [],
              sortBy: 'title',
              sortDirection: 'asc',
              page: 1,
              pageSize: API_MAX_PAGE_SIZE,
            }),
          ]
        : []
    }),
  )
  return pages.flatMap((page) =>
    page.ideas.map((idea) => ({ id: idea.id, itemKey: idea.itemKey, title: idea.title })),
  )
}

/**
 * What the idea form offers: Business Impact, Idea Type, and each type's custom fields as the API
 * resolves them (`effectiveFields`), in form order with that type's required flags.
 */
export async function getIdeaFormOptions(): Promise<IdeaFormOptions> {
  failIfRequested('getIdeaFormOptions')

  const scope = organizationScope()
  if (scope === null) return { ideaTypes: [], businessImpacts: [], members: [], tags: [] }

  const [ideaTypes, businessImpacts, members, tags] = await Promise.all([
    apiGet<readonly WireIdeaType[]>(
      'getIdeaFormOptions',
      apiPath`/organizations/${scope}/idea-types`,
    ),
    apiGet<readonly WireBusinessImpact[]>(
      'getIdeaFormOptions',
      apiPath`/organizations/${scope}/business-impacts`,
    ),
    apiGet<readonly WireMember[]>('getIdeaFormOptions', apiPath`/organizations/${scope}/members`),
    getTagRefs(),
  ])

  return {
    ideaTypes: ideaTypes.map((type) => ({
      id: type.ideaTypeId,
      name: type.name,
      fields: type.effectiveFields.map(toIdeaFormField),
    })),
    businessImpacts: businessImpacts.map((impact) => ({
      id: impact.businessImpactId,
      name: impact.name,
    })),
    members: members.map(toMemberOption).sort((a, b) => a.name.localeCompare(b.name)),
    tags,
  }
}

/**
 * One idea, with its structured fields, its custom field values and its whole comment thread.
 *
 * **The thread comes from here, not from `GET /ideas/{id}/comments`**, which is paged and would show
 * the first twenty of a longer thread under a heading counting all of them. The detail embeds every
 * comment, and its `commentCount` is computed in the same request, so the two cannot disagree.
 *
 * `null` for a missing idea rather than a throw, and that covers the cross-organization case too:
 * the API answers 404 for an idea in another organization rather than 403. A 400 is an id that is
 * not a UUID at all — a hand-edited `?idea=` — and is not found either.
 */
export async function getIdea(id: string): Promise<IdeaDetail | null> {
  failIfRequested('getIdea')

  try {
    return toIdeaDetail(await apiGet<WireIdeaDetail>('getIdea', apiPath`/ideas/${id}`))
  } catch (error) {
    if (isApiStatus(error, 404) || isApiStatus(error, 400)) return null
    throw error
  }
}

/**
 * A parent's tasks in creation order, which is the order the drawer lists them in. The API does not
 * say which board a task is on: the lane that references it does.
 */
export async function getBoardTasks(ideaId: string): Promise<BoardTask[]> {
  failIfRequested('getBoardTasks')

  const tasks = await apiGet<readonly WireBoardTask[]>(
    'getBoardTasks',
    apiPath`/ideas/${ideaId}/board-tasks`,
  )
  return tasks.map(toBoardTask)
}

/**
 * Starts the lookup of which Issues match a list's filters, to run beside the list itself. The
 * organization list carries no phase on its items, and Remove from board needs to know (an Issue
 * returns to Discovery first), so this asks the same question again for the Issues alone. `null`
 * when the filters already settle it. More than one page of Issues under the same filters would
 * miss some; the API refuses that detach with its own message.
 */
export function startIssueLookup(query: IdeaListQuery): Promise<ReadonlySet<string>> | null {
  if (query.phase === 'Ideas' || query.phase === 'Issues') return null
  return getIdeaList({
    ...query,
    phase: 'Issues',
    page: 1,
    pageSize: API_MAX_PAGE_SIZE,
    sortBy: null,
  }).then((issues) => new Set(issues.ideas.map((issue) => issue.id)))
}

/** Which of a page's rows are Issues, from the filters or the started lookup. */
export function issueIdsAmong(
  query: IdeaListQuery,
  rows: readonly Idea[],
  lookup: ReadonlySet<string> | null,
): string[] {
  if (query.phase === 'Issues') return rows.map((row) => row.id)
  if (lookup === null) return []
  return rows.filter((row) => lookup.has(row.id)).map((row) => row.id)
}
