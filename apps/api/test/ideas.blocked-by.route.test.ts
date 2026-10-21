// `PUT /ideas/{ideaId}/blocked-by` at the HTTP boundary (SPEC/contracts/idea-dependencies.md). The
// controller is driven directly with a stand-in IdeaService; failures are rendered through
// ProblemDetailsFilter so the status and rule code are what a client sees. The rules themselves
// are the service's, pinned in idea-service-dependencies-qa.test.ts.

import { ForbiddenError, NotFoundError, UnprocessableError } from '@collega/application/common'
import type { IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const IDEA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const BLOCKER_1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1'
const BLOCKER_2 = 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'
const URL = `/api/v1/ideas/${IDEA}/blocked-by`

type Seen = { ideaId: string; ideaIds: readonly string[] }

function controllerOver(outcome: 'accept' | Error): { controller: IdeasController; seen: Seen[] } {
  const seen: Seen[] = []
  const ideas = {
    setBlockedBy: async (ideaId: string, ideaIds: readonly string[]) => {
      seen.push({ ideaId, ideaIds })
      if (outcome instanceof Error) throw outcome
      return {
        ideaId,
        blockedBy: ideaIds.map((id) => ({ ideaId: id, itemKey: null, isFinal: false })),
      }
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

describe('PUT /ideas/:ideaId/blocked-by routing', () => {
  const handler = IdeasController.prototype.setBlockedBy

  it('is a PUT at the contract path answering 200', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/blocked-by')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.PUT)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200)
  })

  it('validates the idea id as a UUID path parameter', () => {
    const params = Reflect.getMetadata(
      '__routeArguments__',
      IdeasController,
      'setBlockedBy',
    ) as Record<string, { data?: string; pipes?: unknown[] }>
    const ideaParam = Object.values(params).find((p) => p.data === 'ideaId')
    expect(ideaParam?.pipes).toContain(UuidParamPipe)
  })
})

describe('PUT /ideas/:ideaId/blocked-by body', () => {
  it('hands the idea and the complete set to the service and returns its answer', async () => {
    const { controller, seen } = controllerOver('accept')

    const result = await controller.setBlockedBy(IDEA, { ideaIds: [BLOCKER_1, BLOCKER_2] })

    expect(seen).toEqual([{ ideaId: IDEA, ideaIds: [BLOCKER_1, BLOCKER_2] }])
    expect(result).toMatchObject({ ideaId: IDEA })
  })

  it('passes [] through as a clear, not as a missing body', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.setBlockedBy(IDEA, { ideaIds: [] })

    expect(seen).toEqual([{ ideaId: IDEA, ideaIds: [] }])
  })

  it.each([
    ['omitted', {}],
    ['null', { ideaIds: null }],
    ['a string', { ideaIds: BLOCKER_1 }],
    ['an object', { ideaIds: { 0: BLOCKER_1 } }],
    ['a number', { ideaIds: 1 }],
  ])(
    'answers 400 keyed ideaIds when ideaIds is %s, before the service is reached',
    async (_label, body) => {
      const { controller, seen } = controllerOver('accept')

      const rendered = renderProblem(await thrownBy(controller.setBlockedBy(IDEA, body)), URL)

      expect(rendered.status).toBe(400)
      expect(Object.keys(rendered.body.errors as object)).toEqual(['ideaIds'])
      expect(seen).toHaveLength(0)
    },
  )
})

describe('PUT /ideas/:ideaId/blocked-by refusals', () => {
  it.each([
    [
      'Read Only or a direct Site Admin',
      new ForbiddenError('You are not allowed to edit ideas.'),
      403,
    ],
    ['a missing or out-of-scope item or blocker', new NotFoundError('Idea not found.'), 404],
  ])('renders %s with that status', async (_label, refusal, status) => {
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(
      await thrownBy(controller.setBlockedBy(IDEA, { ideaIds: [BLOCKER_1] })),
      URL,
    )

    expect(rendered.status).toBe(status)
  })

  it.each(['blockerIsSelf', 'blockerOnOtherBoard', 'dependencyCycle'])(
    'renders %s as 422 with the code as the detail',
    async (code) => {
      const { controller } = controllerOver(new UnprocessableError(code, 'refused'))

      const rendered = renderProblem(
        await thrownBy(controller.setBlockedBy(IDEA, { ideaIds: [BLOCKER_1] })),
        URL,
      )

      expect(rendered.status).toBe(422)
      expect(rendered.body.detail).toBe(code)
    },
  )
})
