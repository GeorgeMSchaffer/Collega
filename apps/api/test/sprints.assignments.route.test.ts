// `PUT /boards/{boardId}/sprint-assignments` and `ideaIds` on `POST /boards/{boardId}/sprints` at
// the HTTP boundary (SPEC/contracts/sprints.md "Backlog and sprint planning"). The controller is
// driven with stand-in services; refusals are rendered through ProblemDetailsFilter so the status,
// rule code and field key are what a client sees. The rules are the application suites'.

import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '@collega/application/common'
import type { AssignBoardSprintCommand, IdeaService } from '@collega/application/ideas'
import type { SprintService } from '@collega/application/sprints'
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
const SPRINT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STATUS = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const URL = `/api/v1/boards/${BOARD}/sprint-assignments`

function controllerOver(outcome: 'accept' | Error = 'accept') {
  const assigned: { boardId: string; command: AssignBoardSprintCommand }[] = []
  const created: unknown[][] = []
  const ideas = {
    assignBoardSprints: async (boardId: string, command: AssignBoardSprintCommand) => {
      assigned.push({ boardId, command })
      if (outcome instanceof Error) throw outcome
    },
  } as unknown as IdeaService
  const sprints = {
    createForBoard: async (...args: unknown[]) => {
      created.push(args)
      if (outcome instanceof Error) throw outcome
      return { sprintId: 's-1' }
    },
  } as unknown as SprintService
  return { controller: new SprintsController(sprints, ideas), assigned, created }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('PUT boards/:boardId/sprint-assignments routing', () => {
  const handler = SprintsController.prototype.assign

  it('is a PUT at the contract path answering 204', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('boards/:boardId/sprint-assignments')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.PUT)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204)
  })

  it('validates boardId as a UUID and sits behind the auth guard', () => {
    const params = Reflect.getMetadata('__routeArguments__', SprintsController, 'assign') as Record<
      string,
      { data?: string; pipes?: unknown[] }
    >
    expect(Object.values(params).find((p) => p.data === 'boardId')?.pipes).toContain(UuidParamPipe)
    expect(Reflect.getMetadata(GUARDS_METADATA, SprintsController)).toContain(AuthGuard)
  })
})

describe('PUT boards/:boardId/sprint-assignments body', () => {
  it('hands the board and the parsed body to the service and returns nothing', async () => {
    const { controller, assigned } = controllerOver()

    const result = await controller.assign(BOARD, {
      ideaIds: [A, B],
      sprintId: SPRINT,
      statusId: STATUS,
    })

    expect(result).toBeUndefined()
    expect(assigned).toEqual([
      { boardId: BOARD, command: { ideaIds: [A, B], sprintId: SPRINT, statusId: STATUS } },
    ])
  })

  it.each([
    ['null', null],
    ['blank', ' '],
  ])('reads a %s sprintId as the backlog and a missing statusId as none', async (_l, sprintId) => {
    const { controller, assigned } = controllerOver()

    await controller.assign(BOARD, { ideaIds: [A], sprintId })

    expect(assigned[0]?.command).toEqual({ ideaIds: [A], sprintId: null, statusId: null })
  })

  it('refuses an omitted sprintId with 400 keyed sprintId, never reading it as the backlog', async () => {
    const { controller, assigned } = controllerOver()

    const error = await thrownBy(controller.assign(BOARD, { ideaIds: [A] }))

    expect(error).toBeInstanceOf(RequestValidationError)
    const rendered = renderProblem(error, URL)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['sprintId'])
    expect(assigned).toHaveLength(0)
  })

  it('refuses an omitted sprintId even when statusId or an invalid ideaIds is also sent', async () => {
    const { controller, assigned } = controllerOver()

    await thrownBy(controller.assign(BOARD, { ideaIds: [A], statusId: STATUS }))
    await thrownBy(controller.assign(BOARD, {}))

    expect(assigned).toHaveLength(0)
  })

  it('turns a non-GUID sprintId or statusId into the empty GUID so the service keys the 400', async () => {
    const { controller, assigned } = controllerOver()

    await controller.assign(BOARD, { ideaIds: [A], sprintId: 'x', statusId: 'y' })

    expect(assigned[0]?.command).toMatchObject({ sprintId: EMPTY_GUID, statusId: EMPTY_GUID })
  })

  it('turns a non-GUID element of ideaIds into the empty GUID, keeping the others', async () => {
    const { controller, assigned } = controllerOver()

    await controller.assign(BOARD, { ideaIds: [A, 'nope', 5], sprintId: SPRINT })

    expect(assigned[0]?.command.ideaIds).toEqual([A, EMPTY_GUID, EMPTY_GUID])
  })

  it('hands an absent ideaIds on as an empty list, which the service refuses', async () => {
    const { controller, assigned } = controllerOver()

    await controller.assign(BOARD, { sprintId: SPRINT })

    expect(assigned[0]?.command.ideaIds).toEqual([])
  })

  it.each([
    ['a string', 'abc'],
    ['an object', { 0: A }],
    ['a number', 3],
  ])(
    'refuses ideaIds that is %s with 400 keyed ideaIds, without calling the service',
    async (_l, ideaIds) => {
      const { controller, assigned } = controllerOver()

      const error = await thrownBy(controller.assign(BOARD, { ideaIds, sprintId: SPRINT }))

      expect(error).toBeInstanceOf(RequestValidationError)
      const rendered = renderProblem(error, URL)
      expect(rendered.status).toBe(400)
      expect(Object.keys(rendered.body.errors as object)).toEqual(['ideaIds'])
      expect(assigned).toHaveLength(0)
    },
  )
})

describe('PUT boards/:boardId/sprint-assignments refusals as a client sees them', () => {
  const failures = (key: string) =>
    new ValidationError('One or more fields are invalid.', { [key]: ['Nope.'] })

  it.each([
    ['ideaIds', 'ideaIds'],
    ['sprintId', 'sprintId'],
    ['statusId', 'statusId'],
  ])('renders a %s validation failure as 400 keyed %s', async (_l, key) => {
    const { controller } = controllerOver(failures(key))

    const rendered = renderProblem(
      await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual([key])
  })

  it.each([
    ['sprintItemOnOtherBoard'],
    ['taskBlocked'],
    ['effortRequiredForReferenceLane'],
    ['parentHasOpenTasks'],
  ])('renders %s as 422 carrying the code', async (code) => {
    const { controller } = controllerOver(new UnprocessableError(code, 'Refused.'))

    const rendered = renderProblem(
      await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
      URL,
    )

    expect(rendered.status).toBe(422)
    expect(rendered.body.detail).toBe(code)
  })

  it.each([
    ['a refused caller or item as 403', new ForbiddenError('No.'), 403],
    ['an unknown board or other organization as 404', new NotFoundError('Board not found.'), 404],
  ])('renders %s', async (_l, refusal, status) => {
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(
      await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
      URL,
    )

    expect(rendered.status).toBe(status)
  })
})

describe('the wire body of a per-item 422', () => {
  const CREATE_URL = `/api/v1/boards/${BOARD}/sprints`

  it.each([
    ['sprintItemOnOtherBoard', 'DL-12: a sprint holds items from its own board only.'],
    ['sprintItemAlreadyAssigned', 'DL-3: an item already in a sprint cannot be put in a new one.'],
    ['taskBlocked', 'DL-7: This item is blocked until every item blocking it is final.'],
  ])(
    'carries errors.ideaIds with the item-keyed message for %s, and detail stays the code',
    async (code, message) => {
      const { controller } = controllerOver(
        new UnprocessableError(code, message, { ideaIds: [message] }),
      )

      const rendered = renderProblem(
        await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
        URL,
      )

      expect(rendered.status).toBe(422)
      expect(rendered.body.detail).toBe(code)
      expect(rendered.body.errors).toEqual({ ideaIds: [message] })
    },
  )

  it.each([['sprintsNotEnabled'], ['parentHasOpenTasks'], ['effortRequiredForReferenceLane']])(
    'has no errors member on %s raised without failures',
    async (code) => {
      const { controller } = controllerOver(new UnprocessableError(code, 'Refused.'))

      const rendered = renderProblem(
        await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
        URL,
      )

      expect(rendered.status).toBe(422)
      expect(rendered.body.detail).toBe(code)
      expect(rendered.body).not.toHaveProperty('errors')
    },
  )

  it('renders the same keyed body on the create route', async () => {
    const message = "'Fix login': an item already in a sprint cannot be put in a new one."
    const { controller } = controllerOver(
      new UnprocessableError('sprintItemAlreadyAssigned', message, { ideaIds: [message] }),
    )

    const rendered = renderProblem(
      await thrownBy(
        controller.createForBoard(BOARD, {
          name: 'S',
          startDate: '2026-10-19',
          endDate: '2026-11-01',
          ideaIds: [A],
        }),
      ),
      CREATE_URL,
    )

    expect(rendered.body.errors).toEqual({ ideaIds: [message] })
  })

  it('does not add errors to a 403, 404 or plain 400 that has none', async () => {
    for (const refusal of [new ForbiddenError('No.'), new NotFoundError('Gone.')]) {
      const { controller } = controllerOver(refusal)
      const rendered = renderProblem(
        await thrownBy(controller.assign(BOARD, { ideaIds: [A], sprintId: SPRINT })),
        URL,
      )
      expect(rendered.body).not.toHaveProperty('errors')
    }
  })
})

describe('POST boards/:boardId/sprints with ideaIds', () => {
  const BODY = { name: 'S', startDate: '2026-10-19', endDate: '2026-11-01' }

  it('passes ideaIds to the service beside the sprint fields', async () => {
    const { controller, created } = controllerOver()

    await controller.createForBoard(BOARD, { ...BODY, ideaIds: [A, B] })

    expect(created[0]?.[1]).toMatchObject({ name: 'S', ideaIds: [A, B] })
  })

  it('leaves ideaIds off the command when the body has none', async () => {
    const { controller, created } = controllerOver()

    await controller.createForBoard(BOARD, BODY)

    expect(created[0]?.[1]).not.toHaveProperty('ideaIds')
  })

  it('keeps an empty ideaIds as an empty list', async () => {
    const { controller, created } = controllerOver()

    await controller.createForBoard(BOARD, { ...BODY, ideaIds: [] })

    expect((created[0]?.[1] as { ideaIds: unknown } | undefined)?.ideaIds).toEqual([])
  })

  it('maps a non-GUID element to the empty GUID', async () => {
    const { controller, created } = controllerOver()

    await controller.createForBoard(BOARD, { ...BODY, ideaIds: [A, 'x'] })

    expect((created[0]?.[1] as { ideaIds: unknown } | undefined)?.ideaIds).toEqual([A, EMPTY_GUID])
  })

  it('refuses a non-array ideaIds with 400 keyed ideaIds before the service', async () => {
    const { controller, created } = controllerOver()

    const error = await thrownBy(controller.createForBoard(BOARD, { ...BODY, ideaIds: 'x' }))

    const rendered = renderProblem(error, `/api/v1/boards/${BOARD}/sprints`)
    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['ideaIds'])
    expect(created).toHaveLength(0)
  })

  it.each([['sprintItemOnOtherBoard'], ['sprintItemAlreadyAssigned']])(
    'renders %s as 422 carrying the code',
    async (code) => {
      const { controller } = controllerOver(new UnprocessableError(code, 'Refused.'))

      const rendered = renderProblem(
        await thrownBy(controller.createForBoard(BOARD, { ...BODY, ideaIds: [A] })),
        `/api/v1/boards/${BOARD}/sprints`,
      )

      expect(rendered.status).toBe(422)
      expect(rendered.body.detail).toBe(code)
    },
  )
})

describe('the single assignment route is unchanged', () => {
  it('still lives on DeliveryController at ideas/:ideaId/sprint as a PUT answering 204', async () => {
    const { DeliveryController } = await import('../src/ideas/delivery.controller.js')
    const proto = DeliveryController.prototype as unknown as Record<string, unknown>
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (n) =>
        n !== 'constructor' &&
        Reflect.getMetadata(PATH_METADATA, proto[n] as object) === 'ideas/:ideaId/sprint',
    )
    expect(handlers).toHaveLength(1)
    const handler = proto[handlers[0] as string] as object
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.PUT)
  })
})
