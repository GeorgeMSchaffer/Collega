// QA for `SprintService.createForBoard` with `ideaIds` (SPEC/contracts/sprints.md "POST
// /boards/{boardId}/sprints - ideaIds"): the keyed 400s, the two 422s, all-or-nothing, the audit
// events and the response counts. Nothing written is asserted as no sprint added, no commit and no
// audit event; real rollback is the Postgres suite's.

import { Priority } from '@collega/domain/enums'
import { createIdea, type Idea } from '@collega/domain/ideas'
import type { Sprint } from '@collega/domain/sprints'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, UnprocessableError, ValidationError } from '../../src/common/index.js'
import type { SprintBoard, SprintIssuesPort } from '../../src/sprints/ports.js'
import { SprintService } from '../../src/sprints/sprint.service.js'
import {
  countingUnitOfWork,
  fixedClock,
  member,
  NOW,
  ORG_A,
  ORG_B,
  openBoards,
  orgAdmin,
  readOnly,
  recordingAudit,
  siteAdmin,
} from '../support/fixtures.js'

const BOARD = 'board-a'
const FINAL = 'lane-final'
const COMMAND = {
  name: 'Sprint 9',
  goal: null,
  startDate: '2026-10-19',
  endDate: '2026-11-01',
  ownerUserId: null,
}

const board: SprintBoard = {
  id: BOARD,
  organizationId: ORG_A,
  sprintsEnabled: true,
  isArchived: false,
  keyPrefix: 'DL',
  finalStatusIds: [FINAL],
}
const otherBoard: SprintBoard = { ...board, id: 'board-b', keyPrefix: 'OT' }
const unprefixedBoard: SprintBoard = { ...board, id: 'board-c', keyPrefix: null }

function item(id: string, over: Partial<Idea> = {}): Idea {
  return {
    ...createIdea({
      id,
      organizationId: ORG_A,
      boardId: BOARD,
      statusId: 'lane-1',
      title: id,
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.Medium,
      ideaTypeId: 't',
      businessImpactId: 'b',
      dueDate: null,
      authorUserId: 'author',
      assigneeUserIds: [],
      tagIds: [],
      mentionedUserIds: [],
      nowUtc: NOW,
    }),
    ...over,
  }
}

function make(ideas: Idea[], currentUser = orgAdmin(ORG_A)) {
  const added: Sprint[] = []
  const updates: Idea[] = []
  const audit = recordingAudit()
  const unitOfWork = countingUnitOfWork()
  const issues: SprintIssuesPort = {
    listBySprint: async () => [],
    listByIds: async (ids) => ideas.filter((i) => ids.includes(i.id) && !i.isDeleted),
    countsBySprintIds: async () => new Map(),
    update: async (idea) => {
      updates.push(idea)
    },
  }
  const service = new SprintService(
    {
      getById: async () => null,
      listByOrganization: async () => [],
      listByBoard: async () => [],
      add: async (s) => {
        added.push(s)
      },
      save: async () => {},
    },
    issues,
    { listByIds: async () => [] },
    unitOfWork,
    audit,
    currentUser,
    fixedClock(),
    {
      getSprintBoard: async (id) =>
        [board, otherBoard, unprefixedBoard].find((b) => b.id === id) ?? null,
    },
    openBoards(),
  )
  return { service, added, updates, audit, unitOfWork }
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
}

function expectNothingWritten(h: ReturnType<typeof make>): void {
  expect(h.added).toHaveLength(0)
  expect(h.unitOfWork.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
}

describe('createForBoard with ideaIds', () => {
  it('creates the sprint and assigns every item in one commit', async () => {
    const h = make([item('a'), item('b')])

    const result = await h.service.createForBoard(BOARD, { ...COMMAND, ideaIds: ['a', 'b'] })

    expect(h.unitOfWork.saves).toBe(1)
    expect(h.added).toHaveLength(1)
    expect(h.updates.map((i) => [i.id, i.sprintId])).toEqual([
      ['a', result.sprintId],
      ['b', result.sprintId],
    ])
  })

  it.each([
    ['absent', undefined],
    ['empty', []],
  ])('creates an empty sprint when ideaIds is %s', async (_l, ideaIds) => {
    const h = make([item('a')])

    const result = await h.service.createForBoard(BOARD, { ...COMMAND, ideaIds })

    expect(result.issueCount).toBe(0)
    expect(h.updates).toHaveLength(0)
    expect(h.audit.events.map((e) => e.eventType)).toEqual(['SprintCreated'])
  })

  it('writes SprintCreated and one IssueSprintAssignmentChanged per item', async () => {
    const h = make([item('a'), item('b'), item('c')])

    const result = await h.service.createForBoard(BOARD, { ...COMMAND, ideaIds: ['a', 'b', 'c'] })

    expect(h.audit.events.map((e) => e.eventType)).toEqual([
      'SprintCreated',
      'IssueSprintAssignmentChanged',
      'IssueSprintAssignmentChanged',
      'IssueSprintAssignmentChanged',
    ])
    expect(h.audit.events.slice(1).map((e) => e.entityId)).toEqual(['a', 'b', 'c'])
    expect(JSON.parse(h.audit.events[1]?.metadataJson ?? '{}')).toEqual({
      fromSprintId: null,
      toSprintId: result.sprintId,
    })
  })

  it('answers issueCount equal to the items assigned, with done and idea counts', async () => {
    const h = make([
      item('a'),
      item('b', { statusId: FINAL, parentIdeaId: 'p1' }),
      item('c', { parentIdeaId: 'p1' }),
      item('d', { parentIdeaId: 'p2' }),
    ])

    const result = await h.service.createForBoard(BOARD, {
      ...COMMAND,
      ideaIds: ['a', 'b', 'c', 'd'],
    })

    expect(result).toMatchObject({ issueCount: 4, doneCount: 1, ideaCount: 2 })
  })

  it('accepts exactly 200 items', async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `i${i}`)
    const h = make(ids.map((id) => item(id)))

    const result = await h.service.createForBoard(BOARD, { ...COMMAND, ideaIds: ids })

    expect(result.issueCount).toBe(200)
  })

  describe('refusals write nothing', () => {
    async function refused(ideas: Idea[], ideaIds: string[]) {
      const h = make(ideas)
      const error = await failure(h.service.createForBoard(BOARD, { ...COMMAND, ideaIds }))
      expectNothingWritten(h)
      expect(h.updates).toHaveLength(0)
      return error
    }

    it('201 ids: 400 keyed ideaIds', async () => {
      const ids = Array.from({ length: 201 }, (_, i) => `i${i}`)

      const error = await refused(
        ids.map((id) => item(id)),
        ids,
      )

      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).failures).toHaveProperty('ideaIds')
    })

    it('a duplicate id: 400 keyed ideaIds', async () => {
      const error = await refused([item('a')], ['a', 'a'])

      expect((error as ValidationError).failures).toHaveProperty('ideaIds')
    })

    it('an id naming no item: 400 keyed ideaIds, valid ones unassigned', async () => {
      const error = await refused([item('a')], ['a', 'ghost'])

      expect((error as ValidationError).failures).toHaveProperty('ideaIds')
    })

    it('a soft-deleted item: 400 keyed ideaIds', async () => {
      const error = await refused([item('a'), item('gone', { isDeleted: true })], ['a', 'gone'])

      expect((error as ValidationError).failures).toHaveProperty('ideaIds')
    })

    it('an item of another organization: 400 keyed ideaIds', async () => {
      const error = await refused([item('a'), item('x', { organizationId: ORG_B })], ['a', 'x'])

      expect((error as ValidationError).failures).toHaveProperty('ideaIds')
    })

    it('an item of another board: 422 sprintItemOnOtherBoard', async () => {
      const error = await refused([item('a'), item('b', { boardId: 'board-b' })], ['a', 'b'])

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    })

    it('an item already in a sprint: 422 sprintItemAlreadyAssigned, not moved', async () => {
      const error = await refused([item('a'), item('b', { sprintId: 'other-sprint' })], ['a', 'b'])

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code: 'sprintItemAlreadyAssigned' })
    })

    it('a valid item followed by a bad one leaves no sprint behind', async () => {
      const error = await refused(
        [item('a'), item('b', { sprintId: 'other' }), item('c')],
        ['a', 'c', 'b'],
      )

      expect(error).toMatchObject({ code: 'sprintItemAlreadyAssigned' })
    })
  })

  it('still refuses a User, Read Only and a direct Site Admin before looking at the items', async () => {
    for (const user of [member(ORG_A), readOnly(ORG_A), siteAdmin()]) {
      const h = make([item('a')], user)

      const error = await failure(h.service.createForBoard(BOARD, { ...COMMAND, ideaIds: ['a'] }))

      expect(error).toBeInstanceOf(ForbiddenError)
      expectNothingWritten(h)
    }
  })

  it('keeps the sprint field errors ahead of ideaIds', async () => {
    const h = make([item('a')])

    const error = await failure(
      h.service.createForBoard(BOARD, { ...COMMAND, name: '', ideaIds: ['a'] }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expectNothingWritten(h)
  })
})

describe('createForBoard: a per-item 422 names the item on ideaIds', () => {
  async function refusal(ideas: Idea[], ideaIds: string[]) {
    const h = make(ideas)
    const error = await failure(h.service.createForBoard(BOARD, { ...COMMAND, ideaIds }))
    expect(error).toBeInstanceOf(UnprocessableError)
    expectNothingWritten(h)
    return error as UnprocessableError
  }

  it('sprintItemOnOtherBoard leads with the item key from the item’s own board', async () => {
    const error = await refusal(
      [item('a'), item('b', { boardId: 'board-b', itemNumber: 12 })],
      ['a', 'b'],
    )

    expect(error.code).toBe('sprintItemOnOtherBoard')
    expect(error.message.startsWith('OT-12: ')).toBe(true)
    expect(error.failures).toEqual({ ideaIds: [error.message] })
  })

  it('sprintItemAlreadyAssigned leads with the key from this board', async () => {
    const error = await refusal(
      [item('a'), item('b', { sprintId: 'other', itemNumber: 3 })],
      ['a', 'b'],
    )

    expect(error.code).toBe('sprintItemAlreadyAssigned')
    expect(error.message.startsWith('DL-3: ')).toBe(true)
    expect(error.failures).toEqual({ ideaIds: [error.message] })
  })

  it('names the quoted title when the item’s board has no prefix', async () => {
    const error = await refusal(
      [item('b', { boardId: 'board-c', title: 'Fix login', itemNumber: 5 })],
      ['b'],
    )

    expect(error.message.startsWith("'Fix login': ")).toBe(true)
  })

  it('names the quoted title when the item has no number', async () => {
    const error = await refusal(
      [item('b', { sprintId: 'other', title: 'Unnumbered', itemNumber: null })],
      ['b'],
    )

    expect(error.message.startsWith("'Unnumbered': ")).toBe(true)
  })

  it('names the quoted title for an item with no board', async () => {
    const error = await refusal(
      [item('b', { boardId: null, title: 'Loose', itemNumber: 2 })],
      ['b'],
    )

    expect(error.message.startsWith("'Loose': ")).toBe(true)
  })

  it('does not key the 400s: they stay ValidationError', async () => {
    const h = make([item('a')])
    const error = await failure(
      h.service.createForBoard(BOARD, { ...COMMAND, ideaIds: ['a', 'a'] }),
    )

    expect(error).not.toBeInstanceOf(UnprocessableError)
  })
})
