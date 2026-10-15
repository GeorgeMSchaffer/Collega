// `POST /ideas/{ideaId}/board-tasks` at the HTTP boundary (SPEC/contracts/ideas.md "Tasks and item
// keys"). The controller is driven directly with a stand-in IdeaService; failures are rendered
// through ProblemDetailsFilter so the status and rule code are what a client sees. The role rules
// themselves are the service's, and are pinned in idea-service-board-tasks-qa.test.ts.

import { ForbiddenError, NotFoundError, UnprocessableError } from '@collega/application/common'
import type { CreateBoardTaskCommand, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { RequestMethod } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { UuidParamPipe } from '../src/common/uuid-param.pipe.js'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from './route-metadata.js'

const PARENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const URL = `/api/v1/ideas/${PARENT}/board-tasks`

const VALID = {
  title: 'Wire the form',
  problem: 'Nothing sends the form.',
  proposedSolutions: ['Post it.'],
  impactRationale: 'Unblocks the parent.',
  priority: 'Medium',
}

type Seen = { ideaId: string; command: CreateBoardTaskCommand }

function controllerOver(outcome: 'accept' | Error): { controller: IdeasController; seen: Seen[] } {
  const seen: Seen[] = []
  const ideas = {
    createBoardTask: async (ideaId: string, command: CreateBoardTaskCommand) => {
      seen.push({ ideaId, command })
      if (outcome instanceof Error) throw outcome
      return { ideaId: 'new-task', parentIdeaId: ideaId }
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

describe('POST /ideas/:ideaId/board-tasks routing', () => {
  const handler = IdeasController.prototype.createBoardTask

  it('is a POST at the contract path answering 201', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('ideas/:ideaId/board-tasks')
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.POST)
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(201)
  })

  it('validates the idea id as a UUID path parameter', () => {
    const params = Reflect.getMetadata(
      '__routeArguments__',
      IdeasController,
      'createBoardTask',
    ) as Record<string, { data?: string; pipes?: unknown[] }>
    const ideaParam = Object.values(params).find((p) => p.data === 'ideaId')
    expect(ideaParam?.pipes).toContain(UuidParamPipe)
  })
})

describe('POST /ideas/:ideaId/board-tasks body', () => {
  it('returns the service result and hands over the parent and the task fields', async () => {
    const { controller, seen } = controllerOver('accept')

    const result = await controller.createBoardTask(PARENT, VALID)

    expect(result).toEqual({ ideaId: 'new-task', parentIdeaId: PARENT })
    expect(seen[0]?.ideaId).toBe(PARENT)
    expect(seen[0]?.command).toMatchObject({ title: VALID.title, priority: 'Medium' })
  })

  it('drops ideaTypeId, businessImpactId, statusId and fieldValues if sent', async () => {
    const { controller, seen } = controllerOver('accept')
    const guid = 'c0000000-0000-4000-8000-000000000001'

    await controller.createBoardTask(PARENT, {
      ...VALID,
      ideaTypeId: guid,
      businessImpactId: guid,
      statusId: guid,
      fieldValues: [{ fieldDefinitionId: guid, value: 'x' }],
    })

    const command = seen[0]?.command as Record<string, unknown>
    for (const key of ['ideaTypeId', 'businessImpactId', 'statusId', 'fieldValues']) {
      expect(command).not.toHaveProperty(key)
    }
  })

  it('answers 400 keyed title when the title is missing, before the service is reached', async () => {
    const { controller, seen } = controllerOver('accept')
    const { title: _omitted, ...withoutTitle } = VALID

    const rendered = renderProblem(
      await thrownBy(controller.createBoardTask(PARENT, withoutTitle)),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
    expect(seen).toHaveLength(0)
  })
})

describe('POST /ideas/:ideaId/board-tasks refusals', () => {
  it.each([
    [
      'Read Only or a direct Site Admin',
      new ForbiddenError('You are not allowed to create ideas.'),
      403,
    ],
    ['a missing or out-of-scope parent', new NotFoundError('Idea not found.'), 404],
  ])('renders %s with that status', async (_label, refusal, status) => {
    const { controller } = controllerOver(refusal)

    const rendered = renderProblem(await thrownBy(controller.createBoardTask(PARENT, VALID)), URL)

    expect(rendered.status).toBe(status)
  })

  it.each([
    'parentIsTask',
    'parentNotInReferenceLane',
    'referencedBoardArchived',
    'noDefaultIdeaType',
    'noDefaultBusinessImpact',
  ])('renders %s as 422 with the code as the detail', async (code) => {
    const { controller } = controllerOver(new UnprocessableError(code, 'refused'))

    const rendered = renderProblem(await thrownBy(controller.createBoardTask(PARENT, VALID)), URL)

    expect(rendered.status).toBe(422)
    expect(rendered.body.detail).toBe(code)
  })
})
