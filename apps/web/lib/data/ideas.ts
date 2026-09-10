/**
 * Ideas, the comments on them, and the board lanes they sit in.
 *
 * `getIdeasForBoard` is a reader rather than a filter the caller applies to `getIdeas`, because it
 * is a different request — the API scopes by board server-side, and pulling every idea to drop most
 * of them is the shape that quietly stops scaling. That reasoning was written against the fixture
 * and is now simply true.
 *
 * **The list readers are real** — the lane cards, the organization-wide table, and the catalogs the
 * create form picks from. `getIdea` and `getCommentsForIdea` still answer from the fixture, and
 * deliberately so: `GET /ideas/{id}` carries no author and no created date, so the inspector's
 * byline has no source on the wire. That is a contract gap, not something to paper over with a
 * blank line on the screen — see the slice report. `getIdeas` stays with them, because the table
 * `/ideas/[ideaId]` renders beside the inspector has to select a fixture row.
 */

import { toIdea } from '../api/adapt'
import { apiGet, apiPath } from '../api/client'
import type { WireBusinessImpact, WireIdeaListItem, WireIdeaType, WirePage } from '../api/wire'
import * as fixture from '../mock'
import type { Idea, IdeaDetail, IdeaOptions, IdeaPage } from '../types'
import { failIfRequested, resolve } from './latency'
import { organizationScope } from './scope'

export type { Comment, Idea, IdeaDetail, IdeaOptions, IdeaPage, Priority } from '../types'

/** Rows per page of the organization-wide list. See `getOrganizationIdeas` for why it is paged. */
const PAGE_SIZE = 20

/**
 * Every idea on one board, in the order the API returns them.
 *
 * `pageSize=100` is the API's own maximum and one request covers any board a person can read
 * through at a glance. Paging the board is a real feature, not something to fake by silently
 * truncating: when a board outgrows one page it needs lane-level paging, which is a design
 * question, not a query-string change.
 */
export async function getIdeasForBoard(boardId: string): Promise<Idea[]> {
  failIfRequested('getIdeasForBoard')

  const page = await apiGet<WirePage<WireIdeaListItem>>(
    'getIdeasForBoard',
    apiPath`/boards/${boardId}/ideas?pageSize=100`,
  )
  return page.items.map(toIdea)
}

/**
 * What the create form offers for Idea Type and Business Impact.
 *
 * Both are required on `POST /boards/{id}/ideas` and both are per-organization catalogs, so the
 * form cannot invent them and the ids have to come from the same organization the board is in —
 * which is the acting user's, since that is the only one they can open a board in.
 *
 * Two requests in parallel rather than one reader each, for the reason `getNavCounts` gives: the
 * form needs both together, and a caller awaiting them separately pays two round trips in series.
 */
export async function getIdeaOptions(): Promise<IdeaOptions> {
  failIfRequested('getIdeaOptions')

  const scope = organizationScope()
  if (scope === null) return { ideaTypes: [], businessImpacts: [] }

  const [ideaTypes, businessImpacts] = await Promise.all([
    apiGet<readonly WireIdeaType[]>('getIdeaOptions', apiPath`/organizations/${scope}/idea-types`),
    apiGet<readonly WireBusinessImpact[]>(
      'getIdeaOptions',
      apiPath`/organizations/${scope}/business-impacts`,
    ),
  ])

  return {
    ideaTypes: ideaTypes.map((type) => ({ id: type.ideaTypeId, name: type.name })),
    businessImpacts: businessImpacts.map((impact) => ({
      id: impact.businessImpactId,
      name: impact.name,
    })),
  }
}

/**
 * One page of every idea in the organization, newest first.
 *
 * **Paged, not bounded.** `getIdeasForBoard` can ask for one page of 100 and be right, because a
 * board is a bounded thing a person reads at a glance. This list is every board at once and has no
 * such ceiling, so a single large page would be a silent truncation the day an organization
 * outgrows it — the screen would look complete and be wrong. `PAGE_SIZE` is the API's own default
 * (`packages/application` `DEFAULT_PAGE_SIZE`), which keeps the second page reachable in the demo
 * data rather than theoretical.
 *
 * **Newest first**, where the API's default is oldest first. That is the order the screen is opened
 * to answer: an idea raised a minute ago is the first row rather than the last row of the last
 * page, which is exactly what someone checks after creating one.
 *
 * No search, no filter and no sort control — the screen has none to offer. When it grows them they
 * belong in this query string, not in a `.filter()` over the rows below: filtering one page in the
 * client would report "3 results" from the twenty rows that happened to arrive.
 */
export async function getOrganizationIdeas(page: number): Promise<IdeaPage> {
  failIfRequested('getOrganizationIdeas')

  const scope = organizationScope()
  if (scope === null) return { ideas: [], page: 1, pageSize: PAGE_SIZE, totalCount: 0 }

  const result = await apiGet<WirePage<WireIdeaListItem>>(
    'getOrganizationIdeas',
    apiPath`/organizations/${scope}/ideas?page=${String(page)}&pageSize=${String(PAGE_SIZE)}&sortBy=createdAt&sortDirection=desc`,
  )

  return {
    ideas: result.items.map(toIdea),
    page: result.page,
    pageSize: result.pageSize,
    totalCount: result.totalCount,
  }
}

/** The rows behind the ideas table on `/ideas/[ideaId]`, which is still a fixture screen. */
export async function getIdeas(): Promise<IdeaDetail[]> {
  failIfRequested('getIdeas')
  return resolve(fixture.ideas)
}

export async function getIdea(id: string): Promise<IdeaDetail | null> {
  failIfRequested('getIdea')
  return resolve(fixture.ideaById(id) ?? null)
}

export async function getCommentsForIdea(ideaId: string): Promise<fixture.Comment[]> {
  failIfRequested('getCommentsForIdea')
  return resolve(fixture.commentsForIdea(ideaId))
}
