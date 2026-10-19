// `GET /boards/{boardId}/ideas?sprintId=` and `PUT /ideas/{ideaId}/sprint` at the HTTP boundary
// (SPEC/contracts/ideas.md "sprintId", SPEC/contracts/delivery.md). The controller is driven
// directly with a stand-in IdeaService; failures are rendered through ProblemDetailsFilter so the
// status and rule code are what a client sees. Whether the filter selects the right rows is pinned
// against a live database in the infrastructure suite.

import { ForbiddenError, NotFoundError, UnprocessableError } from '@collega/application/common'
import type { IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { DeliveryController } from '../src/ideas/delivery.controller.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const BOARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SPRINT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IDEA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'

function listController(): { run: (query: Record<string, unknown>) => Promise<unknown> } {
  const seen: unknown[] = []
  const ideas = {
    listByBoard: async (_boardId: string, query: unknown) => {
      seen.push(query)
      return { items: [] }
    },
  } as unknown as IdeaService
  const controller = new IdeasController(ideas, {} as UpvoteService)
  return {
    run: async (query) => {
      await controller.listByBoard(BOARD, query)
      return seen[seen.length - 1]
    },
  }
}

describe('GET /boards/:boardId/ideas sprintId', () => {
  it('applies no sprint filter when the parameter is absent or blank', async () => {
    const { run } = listController()

    expect(await run({})).toMatchObject({ sprintId: null, noSprint: false })
    expect(await run({ sprintId: '' })).toMatchObject({ sprintId: null, noSprint: false })
    expect(await run({ sprintId: '   ' })).toMatchObject({ sprintId: null, noSprint: false })
  })

  it('passes a GUID through as the sprint filter', async () => {
    const { run } = listController()

    expect(await run({ sprintId: SPRINT })).toMatchObject({ sprintId: SPRINT, noSprint: false })
  })

  it.each(['none', 'NONE', 'None'])('reads %j as the backlog filter', async (value) => {
    const { run } = listController()

    expect(await run({ sprintId: value })).toMatchObject({ sprintId: null, noSprint: true })
  })

  it.each(['nonexistent', 'nope', "x' OR 1=1 --", '12345'])(
    'turns %j into the empty GUID so it matches nothing, never the raw text',
    async (value) => {
      const { run } = listController()

      expect(await run({ sprintId: value })).toMatchObject({
        sprintId: EMPTY_GUID,
        noSprint: false,
      })
    },
  )

  it('leaves the other list filters as they were beside a sprint filter', async () => {
    const { run } = listController()

    expect(await run({ sprintId: SPRINT, priority: 'High', statusId: [] })).toMatchObject({
      sprintId: SPRINT,
      priorities: ['High'],
      statusIds: [],
    })
  })
})

describe('PUT /ideas/:ideaId/sprint', () => {
  const handler = DeliveryController.prototype.assignToSprint

  function controllerOver(outcome: 'accept' | Error) {
    const seen: { ideaId: string; command: unknown }[] = []
    const ideas = {
      assignToSprint: async (ideaId: string, command: unknown) => {
        seen.push({ ideaId, command })
        if (outcome instanceof Error) throw outcome
      },
    } as unknown as IdeaService
    return { controller: new DeliveryController(ideas), seen }
  }

  it('is a PUT at the contract path answering 204', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/sprint')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.PUT)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204)
  })

  it('hands the sprint GUID to the service, and null to take the item out of its sprint', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.assignToSprint(IDEA, { sprintId: SPRINT })
    await controller.assignToSprint(IDEA, { sprintId: null })

    expect(seen.map((s) => s.command)).toEqual([{ sprintId: SPRINT }, { sprintId: null }])
    expect(seen[0]?.ideaId).toBe(IDEA)
  })

  it('turns a sprintId that is not a GUID into the empty GUID rather than a 500', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.assignToSprint(IDEA, { sprintId: 'not-a-guid' })

    expect(seen[0]?.command).toEqual({ sprintId: EMPTY_GUID })
  })

  it.each([
    ['a task of another board', new UnprocessableError('sprintItemOnOtherBoard', 'x'), 422],
    ['a non-admin or a direct Site Admin', new ForbiddenError('no'), 403],
    ['an unknown idea or sprint', new NotFoundError('gone'), 404],
  ])('renders %s with the contract status', async (_label, refusal, status) => {
    const { controller } = controllerOver(refusal)

    const error = await controller.assignToSprint(IDEA, { sprintId: SPRINT }).then(
      () => null,
      (thrown: unknown) => thrown,
    )
    const rendered = renderProblem(error, `/api/v1/ideas/${IDEA}/sprint`)

    expect(rendered.status).toBe(status)
    if (refusal instanceof UnprocessableError) {
      expect(rendered.body.detail).toBe('sprintItemOnOtherBoard')
    }
  })
})
