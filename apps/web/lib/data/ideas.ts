/**
 * Ideas, the comments on them, and the board lanes they sit in.
 *
 * `getIdeasForBoard` is a reader rather than a filter the caller applies to `getIdeas`, because it
 * is a different request — the API scopes by board server-side, and pulling every idea to drop most
 * of them is the shape that quietly stops scaling. That reasoning was written against the fixture
 * and is now simply true.
 *
 * **Only the board-scoped reader is real.** `getIdeas`, `getIdea` and `getCommentsForIdea` still
 * answer from the fixture, and deliberately so: `GET /ideas/{id}` carries no author and no created
 * date, so the inspector's byline has no source on the wire. That is a contract gap, not something
 * to paper over with a blank line on the screen — see the slice report.
 */

import { toIdea } from '../api/adapt'
import { apiGet } from '../api/client'
import type { WireIdeaListItem, WirePage } from '../api/wire'
import * as fixture from '../mock'
import type { Idea, IdeaDetail } from '../types'
import { failIfRequested, resolve } from './latency'

export type { Comment, Idea, IdeaDetail, Priority } from '../types'

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
