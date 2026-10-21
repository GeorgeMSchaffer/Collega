// `POST /ideas/{ideaId}/board-tasks` takes title, description, assigneeUserIds and tagNames only
// (SPEC/decisions.md 2026-10-16 "Metric types are an organization table...", the board-task bullet;
// contracts/ideas.md "Tasks and item keys"). Everything else a caller sends is ignored, and a title
// is required. The controller is driven directly with a stand-in IdeaService.

import type { CreateBoardTaskCommand, IdeaService } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { describe, expect, it } from 'vitest'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'

const PARENT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const USER = 'a0000000-0000-4000-8000-000000000001'
const GUID = 'c0000000-0000-4000-8000-000000000001'
const URL = `/api/v1/ideas/${PARENT}/board-tasks`

function controllerOver() {
  const seen: CreateBoardTaskCommand[] = []
  const ideas = {
    createBoardTask: async (_ideaId: string, command: CreateBoardTaskCommand) => {
      seen.push(command)
      return {} as never
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

describe('POST /ideas/:ideaId/board-tasks body', () => {
  it('hands the service exactly title, description, assigneeUserIds and tagNames', async () => {
    const { controller, seen } = controllerOver()

    await controller.createBoardTask(PARENT, {
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [USER],
      tagNames: ['Frontend'],
    })

    expect(seen[0]).toEqual({
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [USER],
      tagNames: ['Frontend'],
    })
  })

  it('reads the optional fields as null when absent', async () => {
    const { controller, seen } = controllerOver()

    await controller.createBoardTask(PARENT, { title: 'Wire the form' })

    expect(seen[0]).toEqual({
      title: 'Wire the form',
      description: null,
      assigneeUserIds: null,
      tagNames: null,
    })
  })

  it('ignores every other idea field if sent: no extra key reaches the service', async () => {
    const { controller, seen } = controllerOver()

    await controller.createBoardTask(PARENT, {
      title: 'Wire the form',
      problem: 'A problem',
      proposedSolutions: ['A solution'],
      impactRationale: 'A rationale',
      priority: 'Critical',
      dueDate: '2030-01-01',
      mentionEmails: ['someone@acme.test'],
      ideaTypeId: GUID,
      businessImpactId: GUID,
      statusId: GUID,
      fieldValues: [{ fieldDefinitionId: GUID, value: 'x' }],
      effort: 'High',
      sprintId: GUID,
    } as never)

    expect(Object.keys(seen[0] ?? {}).sort()).toEqual([
      'assigneeUserIds',
      'description',
      'tagNames',
      'title',
    ])
  })

  it('does not run the idea-only validators: a task needs no problem, solutions or rationale', async () => {
    const { controller, seen } = controllerOver()

    await controller.createBoardTask(PARENT, { title: 'Wire the form' })

    expect(seen).toHaveLength(1)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['spaces only', '   '],
  ])(
    'answers 400 keyed title for a title that is %s, before the service is reached',
    async (_l, title) => {
      const { controller, seen } = controllerOver()

      const rendered = renderProblem(
        await thrownBy(controller.createBoardTask(PARENT, title === undefined ? {} : { title })),
        URL,
      )

      expect(rendered.status).toBe(400)
      expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
      expect(seen).toHaveLength(0)
    },
  )

  it('answers 400 keyed title for a title over 150 characters', async () => {
    const { controller, seen } = controllerOver()

    const rendered = renderProblem(
      await thrownBy(controller.createBoardTask(PARENT, { title: 'x'.repeat(151) })),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
    expect(seen).toHaveLength(0)
  })

  it('answers 400 keyed description for a description over 4000 characters', async () => {
    const { controller, seen } = controllerOver()

    const rendered = renderProblem(
      await thrownBy(
        controller.createBoardTask(PARENT, {
          title: 'Wire the form',
          description: 'x'.repeat(4001),
        }),
      ),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['description'])
    expect(seen).toHaveLength(0)
  })

  it('answers 400 keyed tagNames for tagNames that is not a list', async () => {
    const { controller, seen } = controllerOver()

    const rendered = renderProblem(
      await thrownBy(
        controller.createBoardTask(PARENT, {
          title: 'Wire the form',
          tagNames: 'Frontend' as never,
        }),
      ),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['tagNames'])
    expect(seen).toHaveLength(0)
  })
})
