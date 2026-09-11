/**
 * Ideas, the comments on them, and the board lanes they sit in.
 *
 * A board's ideas and the organization's ideas are separate readers rather than one list the caller
 * filters, because they are separate requests: the API scopes by board server-side, and pulling
 * every idea to drop most of them is the shape that quietly stops scaling.
 *
 * **Every reader in this module is real.** The lane cards, the organization-wide table, the
 * catalogs the create form picks from, and now the idea detail behind the inspector. `GET
 * /ideas/{id}` gained an `author` and a `createdAtUtc`, plus an `author` on each embedded comment,
 * which were the fields the byline and the thread had no source for and the reason this one stayed
 * on the fixture as long as it did.
 */

import { toIdea, toIdeaDetail } from '../api/adapt'
import { apiGet, apiPath, isApiStatus } from '../api/client'
import type {
  WireBusinessImpact,
  WireIdeaDetail,
  WireIdeaListItem,
  WireIdeaType,
  WirePage,
} from '../api/wire'
import type { Idea, IdeaDetail, IdeaOptions, IdeaPage } from '../types'
import { failIfRequested } from './latency'
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

/**
 * One idea, with its prose, its provenance and its whole comment thread.
 *
 * **The thread comes from here, not from `GET /ideas/{id}/comments`.** Both are real and both now
 * carry author names, so the choice is about which one tells the truth about *this* screen. The
 * detail embeds every comment, chronologically and unpaged (`CommentsPort.listByIdea`), while the
 * comments endpoint is paged and would show the first twenty of a longer thread under a heading
 * counting all of them. Reading the embedded copy is also one round trip rather than two, and its
 * `commentCount` is computed in the same request as the comments themselves — so the count beside
 * "Discussion" cannot disagree with the number of comments under it, which two requests racing each
 * other could arrange.
 *
 * `null` for a missing idea rather than a throw, and that covers the cross-organization case too:
 * `IdeaService.getById` answers 404 for an idea in another organization rather than 403, declining
 * to confirm it exists, and so does this — the caller reaches `notFound()` either way.
 */
export async function getIdea(id: string): Promise<IdeaDetail | null> {
  failIfRequested('getIdea')

  try {
    return toIdeaDetail(await apiGet<WireIdeaDetail>('getIdea', apiPath`/ideas/${id}`))
  } catch (error) {
    if (isApiStatus(error, 404)) return null
    throw error
  }
}
