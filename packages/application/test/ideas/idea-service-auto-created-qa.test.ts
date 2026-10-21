// QA for slice 303 (contracts/ideas.md `GET /ideas/{id}/board-tasks`): a task knows whether the
// system made it. `autoCreated` is set on the one staging path every `autoCreateTask` entry shares
// (a status move, and the staging a pull and a bulk lane move call), is false for a task someone
// adds by hand, and rides on the board-tasks read only - never on an idea read or list.
// In-memory ports, fixed clock and ids.

import { EffortLevel } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { orgAdmin, readOnly } from '../support/fixtures.js'
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

/** Lane 2 hands work to BOARD_B, creating a task on entry when `autoCreateTask`. */
const parentBoard = (autoCreateTask: boolean) =>
  board({
    keyPrefix: 'CI',
    swimlanes: [
      { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
      {
        statusId: STATUS_2,
        displayOrder: 1,
        isFinal: false,
        referencesBoardId: BOARD_B,
        autoCreateTask,
      },
    ],
  })
const childBoard = () =>
  board({
    boardId: BOARD_B,
    name: 'Delivery',
    keyPrefix: 'DL',
    ideaFeaturesEnabled: false,
    swimlanes: [
      { statusId: TASK_LANE_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
      { statusId: TASK_LANE_2, displayOrder: 1, isFinal: true, referencesBoardId: null },
    ],
  })

describe('autoCreated on a task the system stages', () => {
  const setup = () =>
    harness({
      currentUser: orgAdmin(),
      boards: [parentBoard(true), childBoard()],
      ideas: [idea({ statusId: STATUS_1, effort: EffortLevel.Medium })],
    })

  it('is true on the task made by moving the card into an auto-create lane', async () => {
    const h = setup()

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({ parentIdeaId: 'idea-1', autoCreated: true })
  })

  it('is true on the task staged for a pull or a bulk lane move', async () => {
    const h = setup()

    await h.service.stageAutoCreatedTask(
      { id: 'idea-1', organizationId: 'org-a', title: 'Card', parentIdeaId: null },
      BOARD_B,
    )

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({ parentIdeaId: 'idea-1', autoCreated: true })
  })
})

describe('autoCreated on a task someone adds', () => {
  it('is false for a task added by hand to a parent in the reference lane', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [parentBoard(true), childBoard()],
      ideas: [idea({ statusId: STATUS_2 })],
    })

    await h.service.createBoardTask('idea-1', {
      title: CREATE.title,
      description: CREATE.description,
      assigneeUserIds: null,
      tagNames: null,
    })

    expect(h.added).toHaveLength(1)
    expect(h.added[0]?.autoCreated).toBe(false)
  })

  it('is false on a task moved into a lane that does not auto-create', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [parentBoard(false), childBoard()],
      ideas: [idea({ statusId: STATUS_1, effort: EffortLevel.Medium })],
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.added).toHaveLength(0)
  })
})

describe('autoCreated on reads', () => {
  const task = (id: string, autoCreated: boolean) =>
    idea({
      id,
      boardId: BOARD_B,
      statusId: TASK_LANE_1,
      parentIdeaId: 'idea-1',
      itemNumber: Number(id.split('-')[1]),
      autoCreated,
      createdAtUtc: new Date(`2026-09-0${id.split('-')[1]}T00:00:00Z`),
    })
  const setup = () =>
    harness({
      currentUser: readOnly(),
      boards: [parentBoard(true), childBoard()],
      ideas: [
        idea({ statusId: STATUS_2, itemNumber: 7 }),
        task('task-1', true),
        task('task-2', false),
      ],
    })

  it('is returned per task by the board-tasks read, true and false apart', async () => {
    const tasks = await setup().service.listBoardTasks('idea-1')

    expect(tasks.map((t) => [t.ideaId, t.autoCreated])).toEqual([
      ['task-1', true],
      ['task-2', false],
    ])
  })

  it('is not on an idea read', async () => {
    const detail = await setup().service.getById('task-1')

    expect(detail).not.toHaveProperty('autoCreated')
  })

  it('is not on a board list item', async () => {
    const page = await setup().service.listByBoard(BOARD_B, LIST_QUERY)

    expect(page.items.length).toBeGreaterThan(0)
    for (const item of page.items) expect(item).not.toHaveProperty('autoCreated')
  })
})
