// `GET/POST /boards/{boardId}/sprints` at the HTTP boundary (SPEC/contracts/sprints.md "Sprints per
// board"). The controller is driven directly with a stand-in SprintService; refusals are rendered
// through ProblemDetailsFilter so the status a client sees is asserted, and the route wiring comes
// from Nest's decorator metadata. The rules themselves are the application suite's.

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '@collega/application/common'
import type { IdeaService } from '@collega/application/ideas'
import type { SprintItem, SprintService } from '@collega/application/sprints'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { AuthGuard } from '../src/auth/auth.guard.js'
import { RequestValidationError } from '../src/common/errors/request-validation.error.js'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { SprintsController } from '../src/sprints/sprints.controller.js'
import { renderProblem } from './problem-render.js'
import {
  GUARDS_METADATA,
  HTTP_CODE_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from './route-metadata.js'

const BOARD = '22222222-2222-4222-8222-222222222222'
const OWNER = '33333333-3333-4333-8333-333333333333'
const URL = `/api/v1/boards/${BOARD}/sprints`

const BODY = {
  name: 'Sprint 7',
  goal: 'Ship it',
  startDate: '2026-10-19',
  endDate: '2026-11-01',
  ownerUserId: OWNER,
}

type Call = { method: 'list' | 'create'; args: unknown[] }

function controllerOver(outcome: 'accept' | Error = 'accept'): {
  controller: SprintsController
  calls: Call[]
} {
  const calls: Call[] = []
  const answer = { sprintId: 's-1', boardId: BOARD } as unknown as SprintItem
  const sprints = {
    listForBoard: async (...args: unknown[]) => {
      calls.push({ method: 'list', args })
      if (outcome instanceof Error) throw outcome
      return [answer]
    },
    createForBoard: async (...args: unknown[]) => {
      calls.push({ method: 'create', args })
      if (outcome instanceof Error) throw outcome
      return answer
    },
  } as unknown as SprintService
  return { controller: new SprintsController(sprints, {} as IdeaService), calls }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

function pipesOf(handler: string, name: string): unknown[] | undefined {
  const params = Reflect.getMetadata('__routeArguments__', SprintsController, handler) as Record<
    string,
    { data?: string; pipes?: unknown[] }
  >
  return Object.values(params).find((p) => p.data === name)?.pipes
}

describe('boards/:boardId/sprints routing', () => {
  it('lists with GET at the contract path', () => {
    const handler = SprintsController.prototype.listForBoard
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('boards/:boardId/sprints')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET)
  })

  it('creates with POST at the contract path answering 201', () => {
    const handler = SprintsController.prototype.createForBoard
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('boards/:boardId/sprints')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(201)
  })

  it('validates boardId as a UUID on both routes and sits behind the auth guard', () => {
    expect(pipesOf('listForBoard', 'boardId')).toContain(UuidParamPipe)
    expect(pipesOf('createForBoard', 'boardId')).toContain(UuidParamPipe)
    expect(Reflect.getMetadata(GUARDS_METADATA, SprintsController)).toContain(AuthGuard)
  })

  it('leaves the organization-scoped sprint routes in place', () => {
    const paths = Object.getOwnPropertyNames(SprintsController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => Reflect.getMetadata(PATH_METADATA, SprintsController.prototype[name as never]))
    expect(paths).toEqual(
      expect.arrayContaining([
        'organizations/:organizationId/sprints',
        'organizations/:organizationId/sprints/:sprintId',
        'organizations/:organizationId/sprints/:sprintId/start',
        'organizations/:organizationId/sprints/:sprintId/complete',
      ]),
    )
  })
})

describe('GET boards/:boardId/sprints', () => {
  it('returns the service list for the board with no state filter', async () => {
    const { controller, calls } = controllerOver()

    const result = await controller.listForBoard(BOARD, {})

    expect(result).toHaveLength(1)
    expect(calls[0]).toEqual({ method: 'list', args: [BOARD, null] })
  })

  it.each([
    ['active', 'Active'],
    ['PLANNED', 'Planned'],
    [' Completed ', 'Completed'],
  ])('parses ?state=%s case-insensitively', async (raw, state) => {
    const { controller, calls } = controllerOver()

    await controller.listForBoard(BOARD, { state: raw })

    expect(calls[0]?.args).toEqual([BOARD, state])
  })

  it('treats a blank ?state as every state', async () => {
    const { controller, calls } = controllerOver()

    await controller.listForBoard(BOARD, { state: '  ' })

    expect(calls[0]?.args).toEqual([BOARD, null])
  })

  it('refuses an unknown ?state with 400 keyed state, without calling the service', async () => {
    const { controller, calls } = controllerOver()

    const error = await thrownBy(controller.listForBoard(BOARD, { state: 'bogus' }))

    expect(error).toBeInstanceOf(RequestValidationError)
    const rendered = renderProblem(error, URL)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['state'])
    expect(calls).toHaveLength(0)
  })

  it('renders a service 404 as 404', async () => {
    const { controller } = controllerOver(new NotFoundError('Board not found.'))

    expect(renderProblem(await thrownBy(controller.listForBoard(BOARD, {})), URL).status).toBe(404)
  })
})

describe('POST boards/:boardId/sprints', () => {
  it('hands the board and the parsed body to the service and returns its sprint', async () => {
    const { controller, calls } = controllerOver()

    const result = await controller.createForBoard(BOARD, BODY)

    expect(result).toMatchObject({ sprintId: 's-1', boardId: BOARD })
    expect(calls[0]).toEqual({
      method: 'create',
      args: [
        BOARD,
        {
          name: 'Sprint 7',
          goal: 'Ship it',
          startDate: '2026-10-19',
          endDate: '2026-11-01',
          ownerUserId: OWNER,
        },
      ],
    })
  })

  it('reads blank optional fields as null and a missing name as empty (the domain refuses it)', async () => {
    const { controller, calls } = controllerOver()

    await controller.createForBoard(BOARD, { goal: ' ', ownerUserId: '' })

    expect(calls[0]?.args[1]).toEqual({
      name: '',
      goal: null,
      startDate: '',
      endDate: '',
      ownerUserId: null,
    })
  })

  it.each([
    ['sprintsNotEnabled as 422', new UnprocessableError('sprintsNotEnabled', 'Off.'), 422],
    ['an archived board as 409', new ConflictError('This board is archived.'), 409],
    ['a non-admin as 403', new ForbiddenError('Not allowed.'), 403],
    ['an unknown board or other organization as 404', new NotFoundError('Board not found.'), 404],
  ])('renders %s', async (_label, refusal, status) => {
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(await thrownBy(controller.createForBoard(BOARD, BODY)), URL)

    expect(rendered.status).toBe(status)
  })

  it('carries the sprintsNotEnabled code in the 422 body', async () => {
    const { controller } = controllerOver(new UnprocessableError('sprintsNotEnabled', 'Off.'))

    const rendered = renderProblem(await thrownBy(controller.createForBoard(BOARD, BODY)), URL)

    expect(rendered.body.detail).toBe('sprintsNotEnabled')
  })
})
