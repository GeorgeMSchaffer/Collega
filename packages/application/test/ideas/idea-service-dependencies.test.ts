// Effort entry rule, blocked-by sets and the taskBlocked guard (Board References Rulings 6, 8, 10).

import { EffortLevel } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { NotFoundError, UnprocessableError } from '../../src/common/index.js'
import { orgAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const FINAL = 'final-lane'

const TASK_BOARD = board({
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: null },
    { statusId: FINAL, displayOrder: 2, isFinal: true, referencesBoardId: null },
  ],
})
const PARENT_BOARD = board({
  boardId: BOARD_B,
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_A },
  ],
})

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    if (error instanceof UnprocessableError) {
      return error.code
    }
    if (error instanceof NotFoundError) {
      return 'notFound'
    }
    throw error
  }
  return 'none'
}

const item = (id: string, over: Parameters<typeof idea>[0] = {}) => idea({ id, title: id, ...over })

describe('changeStatus: Effort entry rule', () => {
  it('refuses a move into a reference lane when Effort is unset', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD],
      ideas: [item('idea-1', { boardId: BOARD_B })],
    })

    expect(await codeOf(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))).toBe(
      'effortRequiredForReferenceLane',
    )
    expect(h.saved).toHaveLength(0)
  })

  it('allows the move once Effort is set, and any move into an ordinary lane', async () => {
    const withEffort = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD],
      ideas: [item('idea-1', { boardId: BOARD_B, effort: EffortLevel.Low })],
    })
    await withEffort.service.changeStatus('idea-1', { statusId: STATUS_2 })
    expect(withEffort.saved).toHaveLength(1)

    const ordinary = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('idea-1')],
    })
    await ordinary.service.changeStatus('idea-1', { statusId: STATUS_2 })
    expect(ordinary.saved).toHaveLength(1)
  })
})

describe('setBlockedBy', () => {
  const ideas = () => [item('a'), item('b'), item('c'), item('other', { boardId: BOARD_B })]
  const make = (dependencies: { blockedId: string; blockerId: string }[] = []) =>
    harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD, PARENT_BOARD],
      ideas: ideas(),
      dependencies,
    })

  it('replaces the set atomically, dedupes, audits, and returns the blockers', async () => {
    const h = make([{ blockedId: 'a', blockerId: 'c' }])

    const detail = await h.service.setBlockedBy('a', ['b', 'b'])

    expect(h.edges).toEqual([{ blockedId: 'a', blockerId: 'b' }])
    expect(detail.blockedBy).toEqual([{ ideaId: 'b', itemKey: null, isFinal: false }])
    expect(h.audit.events.map((e) => e.eventType)).toEqual(['IdeaBlockedByChanged'])
  })

  it('clears the set with an empty list', async () => {
    const h = make([{ blockedId: 'a', blockerId: 'b' }])

    await h.service.setBlockedBy('a', [])

    expect(h.edges).toEqual([])
  })

  it('refuses a blocker equal to the item', async () => {
    expect(await codeOf(make().service.setBlockedBy('a', ['a']))).toBe('blockerIsSelf')
  })

  it('refuses a blocker on another board', async () => {
    expect(await codeOf(make().service.setBlockedBy('a', ['other']))).toBe('blockerOnOtherBoard')
  })

  it.each([
    ['two items', [{ blockedId: 'b', blockerId: 'a' }], 'a', ['b']],
    [
      'three items',
      [
        { blockedId: 'b', blockerId: 'c' },
        { blockedId: 'c', blockerId: 'a' },
      ],
      'a',
      ['b'],
    ],
  ])('refuses a cycle through %s', async (_label, edges, blocked, blockers) => {
    const h = make(edges)

    expect(await codeOf(h.service.setBlockedBy(blocked, blockers))).toBe('dependencyCycle')
    expect(h.edges).toEqual(edges)
  })

  it('answers 404 for a missing item or blocker', async () => {
    expect(await codeOf(make().service.setBlockedBy('nope', []))).toBe('notFound')
    expect(await codeOf(make().service.setBlockedBy('a', ['nope']))).toBe('notFound')
  })
})

describe('changeStatus: taskBlocked', () => {
  it('refuses leaving the first lane while a blocker is not final, and allows it once final', async () => {
    const edges = [{ blockedId: 'a', blockerId: 'b' }]
    const open = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('b', { statusId: STATUS_2 })],
      dependencies: edges,
    })
    expect(await codeOf(open.service.changeStatus('a', { statusId: STATUS_2 }))).toBe('taskBlocked')

    const done = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('b', { statusId: FINAL })],
      dependencies: edges,
    })
    await done.service.changeStatus('a', { statusId: STATUS_2 })
    expect(done.saved).toHaveLength(1)
  })

  it('does not hold a task that is already past its first lane', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a', { statusId: STATUS_2 }), item('b')],
      dependencies: [{ blockedId: 'a', blockerId: 'b' }],
    })

    await h.service.changeStatus('a', { statusId: FINAL })
    expect(h.saved).toHaveLength(1)
  })
})

describe('delete removes dependencies in both directions', () => {
  it('drops links where the item blocks and where it is blocked', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('b'), item('c')],
      dependencies: [
        { blockedId: 'a', blockerId: 'b' },
        { blockedId: 'c', blockerId: 'a' },
        { blockedId: 'c', blockerId: 'b' },
      ],
    })

    await h.service.delete('a')

    expect(h.edges).toEqual([{ blockedId: 'c', blockerId: 'b' }])
  })
})

describe('create and CSV import: Effort entry rule', () => {
  it('refuses creating an idea in a reference lane, and allows an ordinary lane', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [PARENT_BOARD] })

    expect(
      await codeOf(h.service.create(BOARD_B, { ...CREATE, statusId: STATUS_2 })),
    ).toBe('effortRequiredForReferenceLane')
    expect(h.added).toHaveLength(0)

    await h.service.create(BOARD_B, { ...CREATE, statusId: STATUS_1 })
    expect(h.added).toHaveLength(1)
  })

  it('refuses the default lane when the leftmost lane references a board', async () => {
    const leftReference = board({
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: BOARD_B },
      ],
    })
    const h = harness({ currentUser: orgAdmin(), boards: [leftReference] })

    expect(await codeOf(h.service.create(BOARD_A, CREATE))).toBe('effortRequiredForReferenceLane')
  })

  it('rejects a CSV row landing in a reference lane', async () => {
    const leftReference = board({
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: BOARD_B },
      ],
    })
    const h = harness({ currentUser: orgAdmin(), boards: [leftReference] })

    const result = await h.service.importBoardIdeas(BOARD_A, [
      {
        rowNumber: 1,
        cells: new Map(
          Object.entries({
            title: 'Row',
            priority: 'Medium',
            'idea type': 'Improvement',
            'business impact': 'Medium',
            status: 'New',
          }),
        ),
      },
    ])

    expect(result.createdCount).toBe(0)
    expect(result.rejectedCount).toBe(1)
    expect(JSON.stringify(result.rows)).toContain('Effort')
  })
})
