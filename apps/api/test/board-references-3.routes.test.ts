// The 2026-10-19 Board References additions at the HTTP boundary (SPEC/contracts/ideas.md
// `GET /ideas/{ideaId}/activity`, contracts/boards.md pull-candidates `hiddenTaskCount`, and the two
// new 422 codes). The controllers are driven directly with stand-in services; failures are rendered
// through ProblemDetailsFilter so the status and rule code are what a client sees. The rules
// themselves are the services', pinned in packages/application/test.

import type { BoardService, PullCandidatePage } from '@collega/application/boards'
import { NotFoundError, UnprocessableError } from '@collega/application/common'
import type { IdeaActivityEntry, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { BoardsController } from '../src/boards/boards.controller.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const IDEA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const ORG = '11111111-1111-4111-8111-111111111111'
const URL = `/api/v1/ideas/${IDEA}/activity`

const ENTRY: IdeaActivityEntry = {
  eventType: 'IdeaMovedPastOpenTasks',
  message: "Idea 'X' moved past 3 open tasks.",
  occurredAtUtc: new Date('2026-10-19T12:00:00.000Z'),
  actorUserId: 'a',
  onBehalfOfUserId: null,
  metadata: { reason: 'Escalation', openTaskCount: 3 },
}

type Seen = { ideaId: string; query: { page: number | null; pageSize: number | null } }

function ideasOver(outcome: 'accept' | Error) {
  const seen: Seen[] = []
  const ideas = {
    listActivity: async (ideaId: string, query: Seen['query']) => {
      seen.push({ ideaId, query })
      if (outcome instanceof Error) throw outcome
      return { items: [ENTRY], page: 1, pageSize: 20, totalCount: 1 }
    },
  } as unknown as IdeaService
  return { controller: new IdeasController(ideas, {} as UpvoteService), seen }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('GET /ideas/:ideaId/activity', () => {
  const handler = IdeasController.prototype.activity

  it('is a GET at the contract path', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/activity')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET)
  })

  it('validates the idea id as a UUID path parameter', () => {
    const params = Reflect.getMetadata('__routeArguments__', IdeasController, 'activity') as Record<
      string,
      { data?: string; pipes?: unknown[] }
    >
    expect(Object.values(params).find((p) => p.data === 'ideaId')?.pipes).toContain(UuidParamPipe)
  })

  it('returns the service page as it is, metadata included', async () => {
    const { controller } = ideasOver('accept')

    const result = await controller.activity(IDEA, {})

    expect(result).toEqual({ items: [ENTRY], page: 1, pageSize: 20, totalCount: 1 })
  })

  it('reads page and pageSize from the query as numbers, and absent as null', async () => {
    const { controller, seen } = ideasOver('accept')

    await controller.activity(IDEA, { page: '2', pageSize: '5' })
    await controller.activity(IDEA, {})

    expect(seen.map((s) => s.query)).toEqual([
      { page: 2, pageSize: 5 },
      { page: null, pageSize: null },
    ])
    expect(seen[0]?.ideaId).toBe(IDEA)
  })

  it('reads a non-numeric page or pageSize as absent rather than failing', async () => {
    const { controller, seen } = ideasOver('accept')

    await controller.activity(IDEA, { page: 'abc', pageSize: '' })

    expect(seen[0]?.query).toEqual({ page: null, pageSize: null })
  })

  it('renders a missing or out-of-scope idea as 404', async () => {
    const { controller } = ideasOver(new NotFoundError('Idea not found.'))

    const rendered = renderProblem(await thrownBy(controller.activity(IDEA, {})), URL)

    expect(rendered.status).toBe(404)
  })
})

describe('GET pull-candidates: hiddenTaskCount', () => {
  const page: PullCandidatePage = {
    items: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
    hiddenTaskCount: 4,
  }

  it('answers the service page with hiddenTaskCount beside the paging fields', async () => {
    const seen: unknown[] = []
    const boards = {
      listPullCandidates: async (organizationId: string, query: unknown) => {
        seen.push({ organizationId, query })
        return page
      },
    } as unknown as BoardService

    const result = await new BoardsController(boards).pullCandidates(ORG, {
      source: 'unassigned',
      search: ' onboarding ',
      tag: ['red', 'blue'],
      page: '2',
    })

    expect(result).toEqual(page)
    expect(seen[0]).toMatchObject({
      organizationId: ORG,
      query: { source: 'unassigned', search: 'onboarding', tags: ['red', 'blue'], page: 2 },
    })
  })
})

describe('the new 422 codes render as problems', () => {
  it.each(['finalLaneCannotReference', 'effortRequiredInReferenceLane'])(
    'renders %s as 422 with the code as the detail',
    (code) => {
      const rendered = renderProblem(new UnprocessableError(code, 'refused'), URL)

      expect(rendered.status).toBe(422)
      expect(rendered.body.detail).toBe(code)
    },
  )
})
