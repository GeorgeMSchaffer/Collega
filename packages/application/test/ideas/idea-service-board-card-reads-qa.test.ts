// QA for "a card on a referenced board is a task on read" (SPEC/decisions.md 2026-10-22): a
// standalone card made by `POST /boards/{boardId}/tasks` is stored as an ordinary item row with
// stand-in values, so reads must hide them the way the create response does, and edits go through
// the task path. Ordinary cards on a non-work board and parented tasks must not change.

import { EffortLevel } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ConflictError } from '../../src/common/index.js'
import type { CreateBoardCardCommand, UpdateTaskCommand } from '../../src/ideas/index.js'
import { orgAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  board,
  harness,
  idea,
  LIST_QUERY,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const LEFT_LANE = 'work-lane-1'
const PLAIN = 'board-plain'

const PLANNING = board({
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
  ],
})
const WORK = board({
  boardId: BOARD_B,
  name: 'Delivery',
  keyPrefix: 'DL',
  swimlanes: [{ statusId: LEFT_LANE, displayOrder: 0, isFinal: false, referencesBoardId: null }],
})
const PLAIN_BOARD = board({
  boardId: PLAIN,
  name: 'Plain',
  swimlanes: [{ statusId: 'plain-lane', displayOrder: 0, isFinal: false, referencesBoardId: null }],
})
const BOARDS = [PLANNING, WORK, PLAIN_BOARD]

const CARD: CreateBoardCardCommand = {
  title: 'Wire the form',
  description: 'Details',
  assigneeUserIds: null,
  tagNames: null,
  parentIdeaId: null,
  sprintId: null,
}
const EDIT: UpdateTaskCommand = {
  title: 'Wire the form v2',
  description: 'More',
  assigneeUserIds: [],
  tagNames: null,
}

/** Creates a standalone card through the service, then reopens the store holding it. */
async function cardInStore(extra: Parameters<typeof idea>[0] = {}) {
  const creator = harness({ currentUser: orgAdmin(), boards: BOARDS })
  const created = await creator.service.createTaskOnBoard(BOARD_B, CARD)
  const stored = { ...creator.added[0], ...extra } as ReturnType<typeof idea>
  const reader = harness({ currentUser: orgAdmin(), boards: BOARDS, ideas: [stored] })
  return { created, stored, reader }
}

describe('a standalone card reads as its create response does', () => {
  it('shows no priority, type, impact, problem, solutions, rationale or effort on the list', async () => {
    const { created, stored, reader } = await cardInStore()

    const page = await reader.service.listByBoard(BOARD_B, LIST_QUERY)
    const item = page.items.find((i) => i.ideaId === stored.id)

    expect(item).toBeDefined()
    expect(item).toMatchObject({
      title: created.title,
      priority: created.priority,
      ideaTypeId: created.ideaTypeId,
      businessImpactId: created.businessImpactId,
      itemKey: created.itemKey,
    })
    expect(item?.priority).toBeNull()
    expect(item?.ideaTypeId).toBeNull()
    expect(item?.businessImpactId).toBeNull()
  })

  it('shows none of them on the detail either', async () => {
    const { created, stored, reader } = await cardInStore({ effort: EffortLevel.Medium })

    const detail = await reader.service.getById(stored.id)

    expect(detail).toMatchObject({
      title: created.title,
      priority: null,
      ideaTypeId: null,
      businessImpactId: null,
      problem: null,
      proposedSolutions: [],
      impactRationale: null,
      effort: null,
      fieldValues: [],
    })
  })

  it('shows none of them on the organization list', async () => {
    const { stored, reader } = await cardInStore()

    const page = await reader.service.listByOrganization('org-a', {
      page: null,
      pageSize: null,
      search: null,
      scope: null,
      sortBy: null,
      sortDirection: null,
      fieldFilters: null,
      boardIds: [],
      includeNoBoard: false,
      statusIds: [],
      priorities: [],
      tags: [],
      user: null,
      phase: null,
    })
    const item = page.items.find((i) => i.ideaId === stored.id)

    expect(item).toMatchObject({ priority: null, ideaTypeId: null, businessImpactId: null })
  })
})

describe('a standalone card is edited as a task', () => {
  it('is reported by isTask and updates through updateTask', async () => {
    const { stored, reader } = await cardInStore()

    expect(await reader.service.isTask(stored.id)).toBe(true)
    await reader.service.updateTask(stored.id, EDIT)

    expect(reader.saved[0]).toMatchObject({ id: stored.id, title: 'Wire the form v2' })
  })

  it('stops being a task when no live lane references its board', async () => {
    const { stored } = await cardInStore()
    const unreferenced = harness({
      currentUser: orgAdmin(),
      boards: [board({ ...PLANNING, isArchived: true }), WORK],
      ideas: [stored],
    })

    expect(await unreferenced.service.isTask(stored.id)).toBe(false)
    await expect(unreferenced.service.updateTask(stored.id, EDIT)).rejects.toBeInstanceOf(
      ConflictError,
    )
  })
})

describe('other cards are unaffected', () => {
  it('keeps priority, type, impact and the idea text on a card of a non-work board', async () => {
    const ordinary = idea({ id: 'plain-1', boardId: PLAIN, statusId: 'plain-lane' })
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS, ideas: [ordinary] })

    const detail = await h.service.getById('plain-1')
    const page = await h.service.listByBoard(PLAIN, LIST_QUERY)

    expect(detail).toMatchObject({
      priority: ordinary.priority,
      ideaTypeId: ordinary.ideaTypeId,
      businessImpactId: ordinary.businessImpactId,
      problem: ordinary.problem,
      proposedSolutions: ordinary.proposedSolutions,
      impactRationale: ordinary.impactRationale,
    })
    expect(page.items[0]).toMatchObject({
      priority: ordinary.priority,
      ideaTypeId: ordinary.ideaTypeId,
    })
    expect(await h.service.isTask('plain-1')).toBe(false)
    await expect(h.service.updateTask('plain-1', EDIT)).rejects.toBeInstanceOf(ConflictError)
  })

  it('keeps hiding the fields of a parented task, which is still a task', async () => {
    const parented = idea({
      id: 'task-1',
      boardId: BOARD_B,
      statusId: LEFT_LANE,
      parentIdeaId: 'idea-1',
    })
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 }), parented],
    })

    const detail = await h.service.getById('task-1')

    expect(detail).toMatchObject({
      priority: null,
      ideaTypeId: null,
      problem: null,
      proposedSolutions: [],
      effort: null,
    })
    expect(await h.service.isTask('task-1')).toBe(true)
  })

  it('does not treat the planning board card as a task: the parent keeps its idea fields', async () => {
    const parent = idea({ statusId: STATUS_2 })
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS, ideas: [parent] })

    const detail = await h.service.getById('idea-1')

    expect(BOARD_A).toBe(parent.boardId)
    expect(detail).toMatchObject({ priority: parent.priority, problem: parent.problem })
    expect(await h.service.isTask('idea-1')).toBe(false)
  })
})
