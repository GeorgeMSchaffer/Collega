// The reference-lane lock and the `autoCreateTask` lane flag at the HTTP boundary (SPEC/decisions.md
// 2026-10-16; contracts/ideas.md status route and `DELETE /ideas/{id}/board`; contracts/boards.md
// "Pulling items" and "Board References"). The controllers are driven directly with stand-in
// services and failures are rendered through ProblemDetailsFilter, so the status and the rule code
// are what a client sees. What the lock decides is the services' and is pinned in
// packages/application/test/{ideas,boards}/*reference-lock-qa.test.ts.
//
// Deliberately not pinned (open owner question): 403-versus-404 ordering for `forceReason`.

import type {
  BoardService,
  CreateBoardCommand,
  UpdateBoardCommand,
} from '@collega/application/boards'
import { ForbiddenError, UnprocessableError, ValidationError } from '@collega/application/common'
import type { ChangeIdeaStatusCommand, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { BoardsController } from '../src/boards/boards.controller.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const IDEA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const STATUS = 'c0000000-0000-4000-8000-000000000001'
const BOARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORG = '11111111-1111-4111-8111-111111111111'
const OTHER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const ITEM = 'f0000000-0000-4000-8000-000000000001'

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

function ideasController(refusal?: Error) {
  const statusCalls: { ideaId: string; command: ChangeIdeaStatusCommand }[] = []
  const detachCalls: { ideaId: string; forceReason: string | null | undefined }[] = []
  const ideas = {
    changeStatus: async (ideaId: string, command: ChangeIdeaStatusCommand) => {
      statusCalls.push({ ideaId, command })
      if (refusal) throw refusal
    },
    detachFromBoard: async (ideaId: string, forceReason?: string | null) => {
      detachCalls.push({ ideaId, forceReason })
      if (refusal) throw refusal
    },
  } as unknown as IdeaService
  return {
    controller: new IdeasController(ideas, {} as UpvoteService),
    statusCalls,
    detachCalls,
  }
}

describe('POST /ideas/:ideaId/status: the lock at the boundary', () => {
  it('keeps the route and its 204', () => {
    const handler = IdeasController.prototype.changeStatus
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/status')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204)
  })

  it('hands the service the reason exactly as sent', async () => {
    const { controller, statusCalls } = ideasController()

    await controller.changeStatus(IDEA, { statusId: STATUS, forceReason: 'Customer escalation' })

    expect(statusCalls[0]).toEqual({
      ideaId: IDEA,
      command: { statusId: STATUS, forceReason: 'Customer escalation' },
    })
  })

  it.each([
    ['absent', undefined],
    ['an empty string', ''],
    ['spaces only', '   '],
    ['null', null],
    ['a number', 7],
    ['an object', { reason: 'x' }],
  ])('reads %s as no reason', async (_label, forceReason) => {
    const { controller, statusCalls } = ideasController()

    await controller.changeStatus(IDEA, { statusId: STATUS, forceReason })

    expect(statusCalls[0]?.command.forceReason).toBeNull()
  })

  it('renders parentHasOpenTasks as 422 with the code as the detail', async () => {
    const { controller } = ideasController(
      new UnprocessableError('parentHasOpenTasks', "'Idea' is waiting on 2 open tasks."),
    )

    const rendered = renderProblem(
      await thrownBy(controller.changeStatus(IDEA, { statusId: STATUS })),
      `/api/v1/ideas/${IDEA}/status`,
    )

    expect(rendered.status).toBe(422)
    expect(rendered.body.detail).toBe('parentHasOpenTasks')
  })

  it('renders a reason from anyone but an Org Admin as 403', async () => {
    const { controller } = ideasController(
      new ForbiddenError('Only an Org Admin can move an item past its open tasks.'),
    )

    const rendered = renderProblem(
      await thrownBy(controller.changeStatus(IDEA, { statusId: STATUS, forceReason: 'x' })),
      `/api/v1/ideas/${IDEA}/status`,
    )

    expect(rendered.status).toBe(403)
  })
})

describe('DELETE /ideas/:ideaId/board: the lock at the boundary', () => {
  it('keeps the route and its 204', () => {
    const handler = IdeasController.prototype.detachFromBoard
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/board')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.DELETE)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(204)
  })

  it('takes no body: a bodiless DELETE still detaches, with no reason', async () => {
    const { controller, detachCalls } = ideasController()

    await controller.detachFromBoard(IDEA, undefined)

    expect(detachCalls[0]).toEqual({ ideaId: IDEA, forceReason: null })
  })

  it('takes an empty object body the same way', async () => {
    const { controller, detachCalls } = ideasController()

    await controller.detachFromBoard(IDEA, {})

    expect(detachCalls[0]?.forceReason).toBeNull()
  })

  it('hands the service the reason from the body', async () => {
    const { controller, detachCalls } = ideasController()

    await controller.detachFromBoard(IDEA, { forceReason: 'Board is being retired' })

    expect(detachCalls[0]).toEqual({ ideaId: IDEA, forceReason: 'Board is being retired' })
  })

  it.each([
    ['an empty string', ''],
    ['spaces only', '   '],
    ['a number', 7],
  ])('reads %s as no reason', async (_label, forceReason) => {
    const { controller, detachCalls } = ideasController()

    await controller.detachFromBoard(IDEA, { forceReason })

    expect(detachCalls[0]?.forceReason).toBeNull()
  })

  it('renders parentHasOpenTasks as 422 and a reason from a non-admin as 403', async () => {
    const locked = ideasController(
      new UnprocessableError('parentHasOpenTasks', 'waiting on 2 open tasks'),
    )
    const refused = ideasController(new ForbiddenError('Only an Org Admin can move an item.'))

    const lockedRender = renderProblem(
      await thrownBy(locked.controller.detachFromBoard(IDEA, undefined)),
      `/api/v1/ideas/${IDEA}/board`,
    )
    const refusedRender = renderProblem(
      await thrownBy(refused.controller.detachFromBoard(IDEA, { forceReason: 'x' })),
      `/api/v1/ideas/${IDEA}/board`,
    )

    expect(lockedRender.status).toBe(422)
    expect(lockedRender.body.detail).toBe('parentHasOpenTasks')
    expect(refusedRender.status).toBe(403)
  })
})

function boardsController(refusal?: Error) {
  const created: CreateBoardCommand[] = []
  const updated: UpdateBoardCommand[] = []
  const reordered: { boardId: string; swimlanes: unknown }[] = []
  const boards = {
    create: async (_organizationId: string, command: CreateBoardCommand) => {
      created.push(command)
      if (refusal) throw refusal
      return {} as never
    },
    update: async (_boardId: string, command: UpdateBoardCommand) => {
      updated.push(command)
      if (refusal) throw refusal
      return {} as never
    },
    reorderSwimlanes: async (boardId: string, command: { swimlanes: unknown }) => {
      reordered.push({ boardId, swimlanes: command.swimlanes })
    },
  } as unknown as BoardService
  return { controller: new BoardsController(boards), created, updated, reordered }
}

const LANES = [
  { statusId: STATUS, order: 0 },
  { statusId: 'c0000000-0000-4000-8000-000000000002', order: 1 },
]

describe('board create and update: forceReason on a pull', () => {
  it('hands the reason to the service on create and on update', async () => {
    const { controller, created, updated } = boardsController()

    await controller.create(ORG, {
      name: 'Ideas',
      swimlanes: LANES,
      pullItemIds: [ITEM],
      forceReason: 'Board is being merged',
    })
    await controller.update(BOARD, {
      name: 'Ideas',
      swimlanes: LANES,
      pullItemIds: [ITEM],
      forceReason: 'Board is being merged',
    })

    expect(created[0]?.forceReason).toBe('Board is being merged')
    expect(updated[0]?.forceReason).toBe('Board is being merged')
  })

  it.each([
    ['absent', undefined],
    ['an empty string', ''],
    ['spaces only', '  '],
    ['a number', 3],
  ])('reads %s as no reason on create and on update', async (_label, forceReason) => {
    const { controller, created, updated } = boardsController()

    await controller.create(ORG, { name: 'Ideas', swimlanes: LANES, forceReason })
    await controller.update(BOARD, { name: 'Ideas', swimlanes: LANES, forceReason })

    expect(created[0]?.forceReason).toBeNull()
    expect(updated[0]?.forceReason).toBeNull()
  })

  it('renders the pull lock as a 400 keyed pullItemIds with the exact message', async () => {
    const message = "'Item 1' is waiting on 2 open tasks, so it cannot be pulled."
    const { controller } = boardsController(
      new ValidationError('One or more fields are invalid.', { pullItemIds: [message] }),
    )

    const rendered = renderProblem(
      await thrownBy(
        controller.create(ORG, { name: 'Ideas', swimlanes: LANES, pullItemIds: [ITEM] }),
      ),
      `/api/v1/organizations/${ORG}/boards`,
    )

    expect(rendered.status).toBe(400)
    expect(rendered.body.errors).toEqual({ pullItemIds: [message] })
  })

  it('renders a reason from a non-Org-Admin as 403', async () => {
    const { controller } = boardsController(
      new ForbiddenError('Only an Org Admin can move an item past its open tasks.'),
    )

    const rendered = renderProblem(
      await thrownBy(
        controller.create(ORG, {
          name: 'Ideas',
          swimlanes: LANES,
          pullItemIds: [ITEM],
          forceReason: 'x',
        }),
      ),
      `/api/v1/organizations/${ORG}/boards`,
    )

    expect(rendered.status).toBe(403)
  })
})

describe('board lane bodies: autoCreateTask', () => {
  const withFlag = (autoCreateTask: unknown) => [
    { statusId: STATUS, order: 0, referencesBoardId: OTHER, autoCreateTask },
    { statusId: 'c0000000-0000-4000-8000-000000000002', order: 1 },
  ]

  it('hands the flag on each lane to create, update and reorder', async () => {
    const { controller, created, updated, reordered } = boardsController()

    await controller.create(ORG, { name: 'Ideas', swimlanes: withFlag(true) as never })
    await controller.update(BOARD, { name: 'Ideas', swimlanes: withFlag(true) as never })
    await controller.reorderSwimlanes(BOARD, { swimlanes: withFlag(true) as never })

    const flags = (lanes: unknown) =>
      (lanes as { autoCreateTask?: boolean }[]).map((lane) => lane.autoCreateTask)
    expect(flags(created[0]?.swimlanes)).toEqual([true, false])
    expect(flags(updated[0]?.swimlanes)).toEqual([true, false])
    expect(flags(reordered[0]?.swimlanes)).toEqual([true, false])
  })

  it.each([
    ['absent', undefined],
    ['the string "true"', 'true'],
    ['the number 1', 1],
    ['null', null],
  ])('reads %s as false', async (_label, flag) => {
    const { controller, updated } = boardsController()

    await controller.update(BOARD, { name: 'Ideas', swimlanes: withFlag(flag) as never })

    expect(updated[0]?.swimlanes.map((lane) => lane.autoCreateTask)).toEqual([false, false])
  })

  it('renders autoCreateTaskRequiresReference as 422 with the code as the detail', async () => {
    const { controller } = boardsController(
      new UnprocessableError(
        'autoCreateTaskRequiresReference',
        'A lane can create a task on entry only when it references a board.',
      ),
    )

    const rendered = renderProblem(
      await thrownBy(
        controller.update(BOARD, { name: 'Ideas', swimlanes: withFlag(true) as never }),
      ),
      `/api/v1/boards/${BOARD}`,
    )

    expect(rendered.status).toBe(422)
    expect(rendered.body.detail).toBe('autoCreateTaskRequiresReference')
  })
})
