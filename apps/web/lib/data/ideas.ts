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

import { toIdea, toIdeaDetail, toIdeaFormField, toMemberOption } from '../api/adapt'
import { apiGet, apiPath, isApiStatus, withQuery } from '../api/client'
import type {
  WireBusinessImpact,
  WireIdeaDetail,
  WireIdeaListItem,
  WireIdeaType,
  WireMember,
  WirePage,
} from '../api/wire'
import type { IdeaDetail, IdeaFormOptions, IdeaListQuery, IdeaPage } from '../types'
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
      withQuery(apiPath`/boards/${boardId}/ideas`, listParams({ ...query, boardIds: [] })),
    ),
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
