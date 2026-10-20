// Slice 298: the reads and the removal the Board References task UI needs - a parent's task list,
// `parentItemKey` on item reads, `effort` on create, and deleting a task from its parent.

import { describe, expect, it } from 'vitest'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import { member, orgAdmin, readOnly, siteAdmin } from '../support/fixtures.js'
import {
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
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
    { statusId: TASK_LANE_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: TASK_LANE_2, displayOrder: 1, isFinal: true, referencesBoardId: null },
  ],
})

function task(id: string, overrides: Parameters<typeof idea>[0] = {}) {
  return idea({
    id,
    boardId: BOARD_B,
    statusId: TASK_LANE_1,
    parentIdeaId: 'idea-1',
    itemNumber: Number(id.split('-')[1]),
    ...overrides,
  })
}

function setup(user = orgAdmin()) {
  return harness({
    currentUser: user,
    boards: [PARENT_BOARD, CHILD_BOARD],
    ideas: [
      idea({ statusId: STATUS_2, itemNumber: 7 }),
      task('task-1', { createdAtUtc: new Date('2026-09-01T00:00:00Z') }),
      task('task-2', { statusId: TASK_LANE_2, createdAtUtc: new Date('2026-09-02T00:00:00Z') }),
    ],
  })
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('IdeaService.listBoardTasks', () => {
  it('lists the tasks in creation order with key, lane, finality and blockers', async () => {
    const h = setup()
    h.edges.push({ blockedId: 'task-1', blockerId: 'task-2' })

    const tasks = await h.service.listBoardTasks('idea-1')

    expect(tasks.map((t) => t.ideaId)).toEqual(['task-1', 'task-2'])
    expect(tasks[0]).toMatchObject({
      itemKey: 'DL-1',
      statusId: TASK_LANE_1,
      isFinal: false,
      blockedBy: [{ ideaId: 'task-2', itemKey: 'DL-2', isFinal: true }],
    })
    expect(tasks[1]).toMatchObject({ isFinal: true, blockedBy: [] })
  })

  it('is open to Read Only and answers an empty list for a parent with no tasks', async () => {
    const h = harness({
      currentUser: readOnly(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_2 })],
    })

    expect(await h.service.listBoardTasks('idea-1')).toEqual([])
  })

  it('is a 404 for a missing parent and for one in another organization', async () => {
    const h = setup(orgAdmin('org-b'))

    expect(await failure(h.service.listBoardTasks('idea-1'))).toBeInstanceOf(NotFoundError)
    expect(await failure(h.service.listBoardTasks('nope'))).toBeInstanceOf(NotFoundError)
  })
})

describe('parentItemKey', () => {
  it('is the parent key on a task and null on the parent', async () => {
    const h = setup()

    const detail = await h.service.getById('task-1')
    const parent = await h.service.getById('idea-1')

    expect(detail.parentItemKey).toBe('CI-7')
    expect(parent.parentItemKey).toBeNull()
  })

  it('rides on the board list items', async () => {
    const h = setup()

    const page = await h.service.listByBoard(BOARD_B, LIST_QUERY)

    expect(page.items.map((i) => i.parentItemKey)).toEqual(['CI-7', 'CI-7'])
  })

  it('is null when the parent has no key', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [idea({ statusId: STATUS_2, itemNumber: null }), task('task-1')],
    })

    expect((await h.service.getById('task-1')).parentItemKey).toBeNull()
  })
})

describe('effort on create', () => {
  it('stores a recognised effort on a board idea and on a pool idea', async () => {
    const h = harness({ currentUser: member() })

    await h.service.create('board-a', { ...CREATE, effort: 'high' })
    await h.service.createInPool('org-a', { ...CREATE, effort: 'Low' })

    expect(h.added.map((i) => i.effort)).toEqual(['High', 'Low'])
  })

  it('stores none when absent or blank', async () => {
    const h = harness({ currentUser: member() })

    await h.service.create('board-a', CREATE)
    await h.service.create('board-a', { ...CREATE, effort: '  ' })

    expect(h.added.map((i) => i.effort)).toEqual([null, null])
  })

  it('refuses an unrecognised value as a field-keyed 400 and creates nothing', async () => {
    const h = harness({ currentUser: member() })

    const error = await failure(h.service.create('board-a', { ...CREATE, effort: 'Huge' }))

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['effort'])
    expect(h.added).toHaveLength(0)
  })
})

describe('IdeaService.deleteBoardTask', () => {
  it('soft-deletes the task, drops its blocker links both ways and audits it', async () => {
    const h = setup()
    h.edges.push(
      { blockedId: 'task-1', blockerId: 'task-2' },
      { blockedId: 'task-2', blockerId: 'task-1' },
    )

    await h.service.deleteBoardTask('idea-1', 'task-1')

    expect(h.saved).toHaveLength(1)
    expect(h.saved[0]).toMatchObject({ id: 'task-1', isDeleted: true })
    expect(h.edges).toEqual([])
    const event = h.audit.events.find((e) => e.eventType === 'BoardTaskDeleted')
    expect(event?.entityId).toBe('task-1')
  })

  it('lets a plain member remove a task, but not Read Only or a direct Site Admin', async () => {
    await setup(member()).service.deleteBoardTask('idea-1', 'task-1')

    for (const user of [readOnly(), siteAdmin()]) {
      const h = setup(user)
      expect(await failure(h.service.deleteBoardTask('idea-1', 'task-1'))).toBeInstanceOf(
        ForbiddenError,
      )
      expect(h.saved).toHaveLength(0)
    }
  })

  it('is a 404 when the task is missing, is not a child of that parent, or the parent is missing', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD, CHILD_BOARD],
      ideas: [
        idea({ statusId: STATUS_2 }),
        idea({ id: 'idea-2', statusId: STATUS_2 }),
        task('task-1'),
      ],
    })

    expect(await failure(h.service.deleteBoardTask('idea-2', 'task-1'))).toBeInstanceOf(
      NotFoundError,
    )
    expect(await failure(h.service.deleteBoardTask('idea-1', 'idea-2'))).toBeInstanceOf(
      NotFoundError,
    )
    expect(await failure(h.service.deleteBoardTask('idea-1', 'nope'))).toBeInstanceOf(NotFoundError)
    expect(await failure(h.service.deleteBoardTask('nope', 'task-1'))).toBeInstanceOf(NotFoundError)
    expect(h.saved).toHaveLength(0)
  })
})
