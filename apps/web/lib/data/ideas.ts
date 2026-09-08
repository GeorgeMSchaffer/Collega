/**
 * Ideas, the comments on them, and the board lanes they sit in.
 *
 * `getIdeasForBoard` is a reader rather than a filter the caller applies to `getIdeas`, because
 * after Wave D it is a different request — the API scopes by board server-side, and pulling every
 * idea to drop most of them is the shape that quietly stops scaling.
 */

import * as fixture from '../mock'
import { failIfRequested, resolve } from './latency'

export type { Comment, Idea, Priority } from '../mock'

export async function getIdeas(): Promise<fixture.Idea[]> {
  failIfRequested('getIdeas')
  return resolve(fixture.ideas)
}

export async function getIdeasForBoard(boardId: string): Promise<fixture.Idea[]> {
  failIfRequested('getIdeasForBoard')
  return resolve(fixture.ideasForBoard(boardId))
}

export async function getIdea(id: string): Promise<fixture.Idea | null> {
  failIfRequested('getIdea')
  return resolve(fixture.ideaById(id) ?? null)
}

export async function getCommentsForIdea(ideaId: string): Promise<fixture.Comment[]> {
  failIfRequested('getCommentsForIdea')
  return resolve(fixture.commentsForIdea(ideaId))
}
