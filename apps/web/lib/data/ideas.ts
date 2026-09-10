/**
 * Ideas, the comments on them, and the board lanes they sit in.
 *
 * `getIdeasForBoard` is a reader rather than a filter the caller applies to `getIdeas`, because it
 * is a different request — the API scopes by board server-side, and pulling every idea to drop most
 * of them is the shape that quietly stops scaling. That reasoning was written against the fixture
 * and is now simply true.
 *
 * **Only the board-scoped readers are real** — the lane cards, and the catalogs the create form
 * picks from. `getIdeas`, `getIdea` and `getCommentsForIdea` still
 * answer from the fixture, and deliberately so: `GET /ideas/{id}` carries no author and no created
 * date, so the inspector's byline has no source on the wire. That is a contract gap, not something
 * to paper over with a blank line on the screen — see the slice report.
 */

import { toIdea } from '../api/adapt'
import { apiGet } from '../api/client'
import type { WireBusinessImpact, WireIdeaListItem, WireIdeaType, WirePage } from '../api/wire'
import * as fixture from '../mock'
import type { Idea, IdeaDetail, IdeaOptions } from '../types'
import { failIfRequested, resolve } from './latency'
import { organizationScope } from './scope'

export type { Comment, Idea, IdeaDetail, IdeaOptions, Priority } from '../types'

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
    `/boards/${boardId}/ideas?pageSize=100`,
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
    apiGet<readonly WireIdeaType[]>('getIdeaOptions', `/organizations/${scope}/idea-types`),
    apiGet<readonly WireBusinessImpact[]>(
      'getIdeaOptions',
      `/organizations/${scope}/business-impacts`,
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
