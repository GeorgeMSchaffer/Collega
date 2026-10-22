// `POST /boards/{boardId}/tasks` and the `hideFinal` / `sprintId` list parameters at the HTTP
// boundary (SPEC/contracts/ideas.md). The controller is driven directly with a stand-in
// IdeaService; failures are rendered through ProblemDetailsFilter so the status, rule code and
// field key are what a client sees. The rules themselves are pinned in the application suite.

import { ForbiddenError, NotFoundError, UnprocessableError } from '@collega/application/common'
import type { CreateBoardCardCommand, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const BOARD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PARENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const SPRINT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ORG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const URL = `/api/v1/boards/${BOARD}/tasks`

function controllerOver(outcome: 'accept' | Error) {
  const seen: { boardId: string; command: CreateBoardCardCommand }[] = []
  const boardQueries: unknown[] = []
  const orgQueries: unknown[] = []
  const ideas = {
    createTaskOnBoard: async (boardId: string, command: CreateBoardCardCommand) => {
      seen.push({ boardId, command })
      if (outcome instanceof Error) throw outcome
      return { ideaId: 'new-card', parentIdeaId: command.parentIdeaId }
    },
    listByBoard: async (_id: string, query: unknown) => {
      boardQueries.push(query)
      return { items: [] }
    },
    listByOrganization: async (_id: string, query: unknown) => {
      orgQueries.push(query)
      return { items: [] }
    },
  } as unknown as IdeaService
  return {
    controller: new IdeasController(ideas, {} as UpvoteService),
    seen,
    boardQueries,
    orgQueries,
  }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

describe('POST /boards/:boardId/tasks routing', () => {
  const handler = IdeasController.prototype.createBoardCard

  it('is a POST at the contract path answering 201', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('boards/:boardId/tasks')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(201)
  })

  it('validates the board id as a UUID path parameter', () => {
    const params = Reflect.getMetadata(
      '__routeArguments__',
      IdeasController,
      'createBoardCard',
    ) as Record<string, { data?: string; pipes?: unknown[] }>
    const boardParam = Object.values(params).find((p) => p.data === 'boardId')
    expect(boardParam?.pipes).toContain(UuidParamPipe)
  })
})

describe('POST /boards/:boardId/tasks body', () => {
  it('hands over the task fields with no parent and no sprint when none are sent', async () => {
    const { controller, seen } = controllerOver('accept')

    const result = await controller.createBoardCard(BOARD, { title: 'Wire the form' })

    expect(result).toMatchObject({ ideaId: 'new-card' })
    expect(seen[0]?.boardId).toBe(BOARD)
    expect(seen[0]?.command).toMatchObject({
      title: 'Wire the form',
      parentIdeaId: null,
      sprintId: null,
    })
  })

  it('passes parentIdeaId and sprintId through, and trims blanks to none', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.createBoardCard(BOARD, { title: 'x', parentIdeaId: PARENT, sprintId: SPRINT })
    await controller.createBoardCard(BOARD, { title: 'x', parentIdeaId: ' ', sprintId: '' })

    expect(seen[0]?.command).toMatchObject({ parentIdeaId: PARENT, sprintId: SPRINT })
    expect(seen[1]?.command).toMatchObject({ parentIdeaId: null, sprintId: null })
  })

  it('turns a non-GUID parentIdeaId or sprintId into the empty GUID, never the raw text', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.createBoardCard(BOARD, {
      title: 'x',
      parentIdeaId: "x' OR 1=1",
      sprintId: 'nope',
    })

    expect(seen[0]?.command).toMatchObject({ parentIdeaId: EMPTY_GUID, sprintId: EMPTY_GUID })
  })

  it('drops ideaTypeId, businessImpactId, statusId and fieldValues if sent', async () => {
    const { controller, seen } = controllerOver('accept')

    await controller.createBoardCard(BOARD, {
      title: 'x',
      ideaTypeId: SPRINT,
      businessImpactId: SPRINT,
      statusId: SPRINT,
      fieldValues: [],
    })

    const command = seen[0]?.command as Record<string, unknown>
    for (const key of ['ideaTypeId', 'businessImpactId', 'statusId', 'fieldValues']) {
      expect(command).not.toHaveProperty(key)
    }
  })

  it('answers 400 keyed title when the title is missing, before the service is reached', async () => {
    const { controller, seen } = controllerOver('accept')

    const rendered = renderProblem(await thrownBy(controller.createBoardCard(BOARD, {})), URL)

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
    expect(seen).toHaveLength(0)
  })
})

describe('POST /boards/:boardId/tasks refusals', () => {
  it('renders a sprintId refusal as 403 with the errors keyed sprintId', async () => {
    const refusal = new ForbiddenError('You are not allowed to assign tasks to a sprint.', {
      sprintId: ['Only an Org Admin can put a task in a sprint.'],
    })
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(
      await thrownBy(controller.createBoardCard(BOARD, { title: 'x', sprintId: SPRINT })),
      URL,
    )

    expect(rendered.status).toBe(403)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['sprintId'])
  })

  it('renders a plain 403 with no errors member', async () => {
    const { controller } = controllerOver(new ForbiddenError('You are not allowed.'))

    const rendered = renderProblem(
      await thrownBy(controller.createBoardCard(BOARD, { title: 'x' })),
      URL,
    )

    expect(rendered.status).toBe(403)
    expect(rendered.body).not.toHaveProperty('errors')
  })

  it('renders a missing board or parent as 404', async () => {
    const { controller } = controllerOver(new NotFoundError('Board not found.'))

    const rendered = renderProblem(
      await thrownBy(controller.createBoardCard(BOARD, { title: 'x' })),
      URL,
    )

    expect(rendered.status).toBe(404)
  })

  it.each([
    'boardIsNotAWorkBoard',
    'parentNotInReferenceLane',
    'parentIsTask',
    'referencedBoardArchived',
    'noDefaultIdeaType',
    'noDefaultBusinessImpact',
  ])('renders %s as 422 with the code as the detail', async (code) => {
    const { controller } = controllerOver(new UnprocessableError(code, 'refused'))

    const rendered = renderProblem(
      await thrownBy(controller.createBoardCard(BOARD, { title: 'x' })),
      URL,
    )

    expect(rendered.status).toBe(422)
    expect(rendered.body.detail).toBe(code)
  })
})

describe('hideFinal and sprintId on the list routes', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['nonsense', false],
    ['true', true],
    ['TRUE', true],
  ])('reads hideFinal=%j on the board list as %s', async (value, expected) => {
    const { controller, boardQueries } = controllerOver('accept')

    await controller.listByBoard(BOARD, { hideFinal: value })

    expect(boardQueries[0]).toMatchObject({ hideFinal: expected })
  })

  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
  ])('reads hideFinal=%j on the organization list as %s', async (value, expected) => {
    const { controller, orgQueries } = controllerOver('accept')

    await controller.listByOrganization(ORG, { hideFinal: value })

    expect(orgQueries[0]).toMatchObject({ hideFinal: expected })
  })

  it('reads sprintId on the organization list as a GUID, none, or the empty GUID', async () => {
    const { controller, orgQueries } = controllerOver('accept')

    await controller.listByOrganization(ORG, {})
    await controller.listByOrganization(ORG, { sprintId: SPRINT })
    await controller.listByOrganization(ORG, { sprintId: 'none' })
    await controller.listByOrganization(ORG, { sprintId: 'junk' })

    expect(orgQueries[0]).toMatchObject({ sprintId: null, noSprint: false })
    expect(orgQueries[1]).toMatchObject({ sprintId: SPRINT, noSprint: false })
    expect(orgQueries[2]).toMatchObject({ sprintId: null, noSprint: true })
    expect(orgQueries[3]).toMatchObject({ sprintId: EMPTY_GUID, noSprint: false })
  })

  it('composes sprintId=none and hideFinal with boardId and scope=assigned', async () => {
    const { controller, orgQueries } = controllerOver('accept')

    await controller.listByOrganization(ORG, {
      sprintId: 'none',
      hideFinal: 'true',
      boardId: [BOARD, SPRINT],
      scope: 'assigned',
    })

    expect(orgQueries[0]).toMatchObject({
      noSprint: true,
      hideFinal: true,
      boardIds: [BOARD, SPRINT],
      scope: 'assigned',
    })
  })
})
