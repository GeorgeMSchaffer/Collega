// Board tasks (Board References Ruling 2): a task is created from a parent that sits in a lane
// referencing a board, lands in that board's leftmost lane, and carries the organization's default
// type and impact, which a read never exposes.

import { describe, expect, it } from 'vitest'
import { UnprocessableError } from '../../src/common/index.js'
import { orgAdmin } from '../support/fixtures.js'
import {
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const TASK_LANE_1 = 'task-lane-1'
const TASK_LANE_2 = 'task-lane-2'

const PARENT_BOARD = board({
  keyPrefix: 'CI',
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
  ],
})
const CHILD_BOARD = board({
  boardId: BOARD_B,
  name: 'Delivery',
  keyPrefix: 'DL',
  ideaFeaturesEnabled: false,
  swimlanes: [
    { statusId: TASK_LANE_2, displayOrder: 1, isFinal: true, referencesBoardId: null },
    { statusId: TASK_LANE_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
  ],
})

const TASK_BODY = { ...CREATE, ideaTypeId: '', businessImpactId: '' }

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('IdeaService.createBoardTask', () => {
  it('creates the task on the referenced board in its leftmost lane, with a key and the default type', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const task = await h.service.createBoardTask('idea-1', TASK_BODY)

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({
      boardId: BOARD_B,
      statusId: TASK_LANE_1,
      parentIdeaId: 'idea-1',
      itemNumber: 1,
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
    })
    expect(task.itemKey).toBe('DL-1')
    expect(task.parentIdeaId).toBe('idea-1')
    expect(task.ideaTypeId).toBeNull()
    expect(h.audit.events.map((e) => e.eventType)).toContain('BoardTaskCreated')
  })

  it('refuses a parent that sits in a lane that references no board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_1 })],
    })

    const error = await failure(h.service.createBoardTask('idea-1', TASK_BODY))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect((error as UnprocessableError).code).toBe('parentNotInReferenceLane')
    expect(h.added).toHaveLength(0)
  })

  it('refuses a parent that is itself a task', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_2, parentIdeaId: 'someone' })],
    })

    const error = await failure(h.service.createBoardTask('idea-1', TASK_BODY))

    expect((error as UnprocessableError).code).toBe('parentIsTask')
  })

  it('refuses when the referenced board is archived', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, { ...CHILD_BOARD, isArchived: true }],
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const error = await failure(h.service.createBoardTask('idea-1', TASK_BODY))

    expect((error as UnprocessableError).code).toBe('referencedBoardArchived')
  })

  it('refuses a Read Only caller and an unknown parent', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [PARENT_BOARD, CHILD_BOARD] })

    const error = await failure(h.service.createBoardTask('missing', TASK_BODY))

    expect((error as Error).name).toMatch(/NotFound/i)
  })

  it('hides the stored type and impact on a read of the task', async () => {
    const task = idea({
      id: 'task-1',
      boardId: BOARD_B,
      statusId: TASK_LANE_1,
      parentIdeaId: 'idea-1',
    })
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [task],
    })

    const detail = await h.service.getById('task-1')

    expect(detail.ideaTypeId).toBeNull()
    expect(detail.businessImpactId).toBeNull()
    expect(detail.fieldValues).toEqual([])
    expect(detail.upvoteCount).toBe(0)
    expect(detail.parentIdeaId).toBe('idea-1')
  })
})

describe('taskCounts', () => {
  it('counts children on an item in a reference lane and omits it elsewhere', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [
        idea({ id: 'in-ref', statusId: STATUS_2 }),
        idea({ id: 'elsewhere', statusId: STATUS_1 }),
      ],
      childCounts: { 'in-ref': { total: 3, done: 1 }, elsewhere: { total: 2, done: 2 } },
    })

    const inRef = await h.service.getById('in-ref')
    const elsewhere = await h.service.getById('elsewhere')

    expect(inRef.taskCounts).toEqual({ total: 3, done: 1 })
    expect(elsewhere.taskCounts).toBeNull()
  })
})

describe('IdeaService.delete with tasks', () => {
  it('refuses a parent with live children', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_2 })],
      childCounts: { 'idea-1': { total: 1, done: 0 } },
    })

    const error = await failure(h.service.delete('idea-1'))

    expect((error as UnprocessableError).code).toBe('hasOpenTasks')
    expect(h.saved).toHaveLength(0)
  })

  it('deletes an idea with no children', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea()],
    })

    await h.service.delete('idea-1')

    expect(h.saved[0]?.isDeleted).toBe(true)
  })
})
