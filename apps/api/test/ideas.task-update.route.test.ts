// `PUT /ideas/{ideaId}` on a task (SPEC/decisions.md 2026-10-16 "Board References follow-ups" item 3;
// contracts/ideas.md "Updating a task"): the route asks `isTask` first, and a task takes only title,
// description, assigneeUserIds and tagNames - the idea-only fields are ignored, not validated, and
// not required. An ordinary idea keeps the full update. Refusals render with their contract
// status. The controller is driven directly with a stand-in IdeaService.

import { ConflictError, ForbiddenError, NotFoundError } from '@collega/application/common'
import type { IdeaService, UpdateIdeaCommand, UpdateTaskCommand } from '@collega/application/ideas'
import type { UpvoteService } from '@collega/application/upvotes'
import { describe, expect, it } from 'vitest'
import { IdeasController } from '../src/ideas/ideas.controller.js'
import { renderProblem } from './problem-render.js'

const IDEA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const USER = 'a0000000-0000-4000-8000-000000000001'
const URL = `/api/v1/ideas/${IDEA}`

type Calls = { method: string; args: unknown[] }[]

function controllerOver(options: { task: boolean; updateTask?: () => Promise<never> }) {
  const calls: Calls = []
  const ideas = {
    isTask: async (ideaId: string) => {
      calls.push({ method: 'isTask', args: [ideaId] })
      return options.task
    },
    updateTask: async (ideaId: string, command: UpdateTaskCommand) => {
      calls.push({ method: 'updateTask', args: [ideaId, command] })
      return options.updateTask ? options.updateTask() : ({} as never)
    },
    update: async (ideaId: string, command: UpdateIdeaCommand) => {
      calls.push({ method: 'update', args: [ideaId, command] })
      return {} as never
    },
  } as unknown as IdeaService
  return { controller: new IdeasController(ideas, {} as UpvoteService), calls }
}

async function thrownBy(promise: Promise<unknown>): Promise<unknown> {
  const error = await promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
  expect(error).not.toBeNull()
  return error
}

const IDEA_ONLY = {
  problem: 'A problem',
  proposedSolutions: ['A solution'],
  impactRationale: 'A rationale',
  priority: 'Critical',
  dueDate: '2030-01-01',
  ideaTypeId: USER,
  businessImpactId: USER,
  mentionEmails: ['someone@acme.test'],
  fieldValues: [{ fieldDefinitionId: USER, value: 'x' }],
  effort: 'High',
}

describe('PUT /ideas/:ideaId on a task', () => {
  it('asks isTask first and hands the service exactly title, description, assigneeUserIds and tagNames', async () => {
    const { controller, calls } = controllerOver({ task: true })

    await controller.update(IDEA, {
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [USER],
      tagNames: ['Frontend'],
    })

    expect(calls.map((c) => c.method)).toEqual(['isTask', 'updateTask'])
    expect(calls[1]?.args).toEqual([
      IDEA,
      {
        title: 'Wire the form',
        description: 'Both screens',
        assigneeUserIds: [USER],
        tagNames: ['Frontend'],
      },
    ])
  })

  it('reads the optional fields as null when absent', async () => {
    const { controller, calls } = controllerOver({ task: true })

    await controller.update(IDEA, { title: 'Wire the form' })

    expect(calls[1]?.args[1]).toEqual({
      title: 'Wire the form',
      description: null,
      assigneeUserIds: null,
      tagNames: null,
    })
  })

  it('ignores every idea-only field: none reaches the service and none is required', async () => {
    const { controller, calls } = controllerOver({ task: true })

    await controller.update(IDEA, { title: 'Wire the form', ...IDEA_ONLY } as never)

    expect(Object.keys((calls[1]?.args[1] as object) ?? {}).sort()).toEqual([
      'assigneeUserIds',
      'description',
      'tagNames',
      'title',
    ])
    expect(calls.map((c) => c.method)).not.toContain('update')
  })

  it('does not validate the idea-only fields: a bad priority or due date on a task is ignored', async () => {
    const { controller, calls } = controllerOver({ task: true })

    await controller.update(IDEA, {
      title: 'Wire the form',
      priority: 'Nonsense',
      dueDate: 'not-a-date',
      problem: 'x'.repeat(5000),
    } as never)

    expect(calls.map((c) => c.method)).toEqual(['isTask', 'updateTask'])
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['spaces only', '   '],
    ['over 150 characters', 'x'.repeat(151)],
  ])('answers 400 keyed title for a title that is %s, before updateTask', async (_l, title) => {
    const { controller, calls } = controllerOver({ task: true })

    const rendered = renderProblem(
      await thrownBy(controller.update(IDEA, title === undefined ? {} : { title })),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['title'])
    expect(calls.map((c) => c.method)).toEqual(['isTask'])
  })

  it('answers 400 keyed description for a description over 4000 characters', async () => {
    const { controller, calls } = controllerOver({ task: true })

    const rendered = renderProblem(
      await thrownBy(
        controller.update(IDEA, { title: 'Wire the form', description: 'x'.repeat(4001) }),
      ),
      URL,
    )

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(['description'])
    expect(calls.map((c) => c.method)).toEqual(['isTask'])
  })

  it.each([
    [
      '403 for a refused editor',
      new ForbiddenError('Only the author or an Org Admin can edit this task.'),
      403,
    ],
    ['409 when it stopped being a task', new ConflictError('This item is no longer a task.'), 409],
    ['404 for a task that vanished', new NotFoundError('Idea not found.'), 404],
  ])('renders the service refusal as %s', async (_label, refusal, status) => {
    const { controller } = controllerOver({
      task: true,
      updateTask: async () => {
        throw refusal
      },
    })

    const rendered = renderProblem(await thrownBy(controller.update(IDEA, { title: 'T' })), URL)

    expect(rendered.status).toBe(status)
  })
})

describe('PUT /ideas/:ideaId on an ordinary idea', () => {
  it('keeps the full update: isTask false routes to update, never updateTask', async () => {
    const { controller, calls } = controllerOver({ task: false })

    await controller.update(IDEA, {
      title: 'An idea',
      problem: 'A problem',
      proposedSolutions: ['A solution'],
      impactRationale: 'A rationale',
      priority: 'High',
      ideaTypeId: USER,
      businessImpactId: USER,
    })

    expect(calls.map((c) => c.method)).toEqual(['isTask', 'update'])
    expect(calls[1]?.args[1]).toMatchObject({
      title: 'An idea',
      problem: 'A problem',
      priority: 'High',
    })
  })

  it('still requires the idea-only fields on an ordinary idea', async () => {
    const { controller, calls } = controllerOver({ task: false })

    const rendered = renderProblem(await thrownBy(controller.update(IDEA, { title: 'T' })), URL)

    expect(rendered.status).toBe(400)
    expect(Object.keys(rendered.body.errors as object)).toEqual(expect.arrayContaining(['problem']))
    expect(calls.map((c) => c.method)).toEqual(['isTask'])
  })
})
