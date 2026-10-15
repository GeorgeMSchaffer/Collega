// QA for idea dependencies (SPEC/contracts/idea-dependencies.md and contracts/ideas.md "Tasks and
// item keys"): roles, scope, set semantics, the blockedBy read shape, taskBlocked and the Effort
// rule on changeStatus.

import { EffortLevel, Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, NotFoundError, UnprocessableError } from '../../src/common/index.js'
import {
  impersonating,
  member,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
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

const FINAL = 'final-lane'

const TASK_BOARD = board({
  keyPrefix: 'CI',
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

const item = (id: string, over: Parameters<typeof idea>[0] = {}) => idea({ id, title: id, ...over })

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await failure(promise)
  if (error === null) {
    return 'none'
  }
  if (error instanceof UnprocessableError) {
    return error.code
  }
  if (error instanceof NotFoundError) {
    return 'notFound'
  }
  throw error
}

describe('setBlockedBy: who may edit the set', () => {
  const make = (currentUser: Parameters<typeof harness>[0]['currentUser']) =>
    harness({ currentUser, boards: [TASK_BOARD], ideas: [item('a'), item('b')] })

  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    [
      'a User seen through View As',
      impersonating({ targetUserId: 'user-1', targetRole: Role.User, targetOrganizationId: ORG_A }),
    ],
  ])('lets %s set blockers', async (_label, currentUser) => {
    const h = make(currentUser)

    await h.service.setBlockedBy('a', ['b'])

    expect(h.edges).toEqual([{ blockedId: 'a', blockerId: 'b' }])
  })

  it.each([
    ['a Read Only user', readOnly()],
    ['a direct Site Admin', siteAdmin()],
    [
      'a Read Only user seen through View As',
      impersonating({
        targetUserId: 'ro-1',
        targetRole: Role.ReadOnly,
        targetOrganizationId: ORG_A,
      }),
    ],
  ])('refuses %s with Forbidden and changes nothing', async (_label, currentUser) => {
    const h = make(currentUser)

    expect(await failure(h.service.setBlockedBy('a', ['b']))).toBeInstanceOf(ForbiddenError)
    expect(h.edges).toEqual([])
    expect(h.audit.events).toHaveLength(0)
  })

  it('answers 404 for an item or a blocker in another organization', async () => {
    const foreign = item('foreign', { organizationId: ORG_B })
    const h = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), foreign],
    })

    expect(await codeOf(h.service.setBlockedBy('foreign', []))).toBe('notFound')
    expect(await codeOf(h.service.setBlockedBy('a', ['foreign']))).toBe('notFound')
    expect(h.edges).toEqual([])
  })
})

describe('setBlockedBy: set semantics', () => {
  const make = (dependencies: { blockedId: string; blockerId: string }[] = []) =>
    harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('b'), item('c'), item('d')],
      dependencies,
    })

  it('collapses duplicates in the set to one link each', async () => {
    const h = make()

    await h.service.setBlockedBy('a', ['b', 'c', 'b', 'c', 'b'])

    expect(h.edges).toEqual([
      { blockedId: 'a', blockerId: 'b' },
      { blockedId: 'a', blockerId: 'c' },
    ])
  })

  it('clears every blocker with [] and audits the change', async () => {
    const h = make([
      { blockedId: 'a', blockerId: 'b' },
      { blockedId: 'a', blockerId: 'c' },
      { blockedId: 'd', blockerId: 'b' },
    ])

    const detail = await h.service.setBlockedBy('a', [])

    expect(h.edges).toEqual([{ blockedId: 'd', blockerId: 'b' }])
    expect(detail.blockedBy).toEqual([])
    expect(h.audit.events.map((e) => e.eventType)).toEqual(['IdeaBlockedByChanged'])
  })

  it('audits nothing when the set is unchanged, whatever its order', async () => {
    const h = make([
      { blockedId: 'a', blockerId: 'b' },
      { blockedId: 'a', blockerId: 'c' },
    ])

    await h.service.setBlockedBy('a', ['c', 'b'])

    expect(h.audit.events).toHaveLength(0)
  })

  it('refuses a self entry hidden among duplicates and leaves the set alone', async () => {
    const h = make([{ blockedId: 'a', blockerId: 'b' }])

    expect(await codeOf(h.service.setBlockedBy('a', ['b', 'a', 'a']))).toBe('blockerIsSelf')
    expect(h.edges).toEqual([{ blockedId: 'a', blockerId: 'b' }])
  })

  it('refuses a direct cycle and a longer one closed through a diamond', async () => {
    const direct = make([{ blockedId: 'b', blockerId: 'a' }])
    expect(await codeOf(direct.service.setBlockedBy('a', ['b']))).toBe('dependencyCycle')

    // a blocks b and c, which both block d. Making a wait on d closes the loop.
    const diamond = make([
      { blockedId: 'b', blockerId: 'a' },
      { blockedId: 'c', blockerId: 'a' },
      { blockedId: 'd', blockerId: 'b' },
      { blockedId: 'd', blockerId: 'c' },
    ])
    expect(await codeOf(diamond.service.setBlockedBy('a', ['d']))).toBe('dependencyCycle')
    expect(diamond.edges).toHaveLength(4)
  })

  it('allows a diamond that is not a cycle', async () => {
    const h = make([
      { blockedId: 'b', blockerId: 'a' },
      { blockedId: 'c', blockerId: 'a' },
    ])

    await h.service.setBlockedBy('d', ['b', 'c'])

    expect(h.edges).toHaveLength(4)
  })

  it('does not count the links being replaced when it looks for a cycle', async () => {
    // a waits on b today. Replacing that with c drops the b link, so b may then wait on a.
    const h = make([{ blockedId: 'a', blockerId: 'b' }])

    await h.service.setBlockedBy('a', ['c'])
    await h.service.setBlockedBy('b', ['a'])

    expect(h.edges).toEqual(
      expect.arrayContaining([
        { blockedId: 'a', blockerId: 'c' },
        { blockedId: 'b', blockerId: 'a' },
      ]),
    )
  })

  it('allows blockers for an item that already left its first lane', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a', { statusId: STATUS_2 }), item('b')],
    })

    await h.service.setBlockedBy('a', ['b'])

    expect(h.edges).toEqual([{ blockedId: 'a', blockerId: 'b' }])
  })
})

describe('setBlockedBy: board scope', () => {
  it('refuses a blocker with no board, and an item with no board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('pool-1', { boardId: null }), item('pool-2', { boardId: null })],
    })

    expect(await codeOf(h.service.setBlockedBy('a', ['pool-1']))).toBe('blockerOnOtherBoard')
    expect(await codeOf(h.service.setBlockedBy('pool-1', ['pool-2']))).toBe('blockerOnOtherBoard')
    expect(await codeOf(h.service.setBlockedBy('pool-1', ['a']))).toBe('blockerOnOtherBoard')
    expect(h.edges).toEqual([])
  })
})

describe('blockedBy on reads', () => {
  const make = (blocker: Parameters<typeof idea>[0]) =>
    harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a'), item('b', blocker)],
      dependencies: [{ blockedId: 'a', blockerId: 'b' }],
    })

  it('carries ideaId, itemKey and isFinal on the detail and on the list item', async () => {
    const h = make({ itemNumber: 7, statusId: FINAL })

    const detail = await h.service.getById('a')
    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)

    const expected = [{ ideaId: 'b', itemKey: 'CI-7', isFinal: true }]
    expect(detail.blockedBy).toEqual(expected)
    expect(page.items.find((i) => i.ideaId === 'a')?.blockedBy).toEqual(expected)
    expect(page.items.find((i) => i.ideaId === 'b')?.blockedBy).toEqual([])
  })

  it('reads isFinal false for a blocker in a non-final lane of the same board', async () => {
    const detail = await make({ itemNumber: 7, statusId: STATUS_2 }).service.getById('a')

    expect(detail.blockedBy).toEqual([{ ideaId: 'b', itemKey: 'CI-7', isFinal: false }])
  })

  it('reads itemKey null for a blocker with no item number', async () => {
    const detail = await make({ statusId: FINAL }).service.getById('a')

    expect(detail.blockedBy).toEqual([{ ideaId: 'b', itemKey: null, isFinal: true }])
  })

  it('reads isFinal false for a blocker detached from its board', async () => {
    const detail = await make({ boardId: null, statusId: FINAL }).service.getById('a')

    expect(detail.blockedBy).toEqual([{ ideaId: 'b', itemKey: null, isFinal: false }])
  })

  it('leaves out a soft-deleted blocker', async () => {
    const detail = await make({ isDeleted: true }).service.getById('a')

    expect(detail.blockedBy).toEqual([])
  })
})

describe('changeStatus: taskBlocked', () => {
  const FIRST_TO_SECOND = { statusId: STATUS_2 }
  const make = (blockers: Parameters<typeof idea>[0][], over: Parameters<typeof idea>[0] = {}) =>
    harness({
      currentUser: orgAdmin(),
      boards: [TASK_BOARD],
      ideas: [item('a', over), ...blockers.map((b, i) => item(`b${i}`, b))],
      dependencies: blockers.map((_b, i) => ({ blockedId: 'a', blockerId: `b${i}` })),
    })

  it('holds the item while any blocker sits in a non-final lane of the same board', async () => {
    const h = make([{ statusId: FINAL }, { statusId: STATUS_2 }])

    expect(await codeOf(h.service.changeStatus('a', FIRST_TO_SECOND))).toBe('taskBlocked')
    expect(h.saved).toHaveLength(0)
  })

  it('holds the item while the blocker is still in the first lane', async () => {
    const h = make([{ statusId: STATUS_1 }])

    expect(await codeOf(h.service.changeStatus('a', FIRST_TO_SECOND))).toBe('taskBlocked')
  })

  it('holds a jump from the first lane straight into a final lane', async () => {
    const h = make([{ statusId: STATUS_2 }])

    expect(await codeOf(h.service.changeStatus('a', { statusId: FINAL }))).toBe('taskBlocked')
  })

  it('lets the item go once every blocker is final', async () => {
    const h = make([{ statusId: FINAL }, { statusId: FINAL }])

    await h.service.changeStatus('a', FIRST_TO_SECOND)

    expect(h.saved).toHaveLength(1)
  })

  it('holds an item whose blocker was detached, because that blocker never reads as final', async () => {
    const h = make([{ boardId: null, statusId: FINAL }])

    expect(await codeOf(h.service.changeStatus('a', FIRST_TO_SECOND))).toBe('taskBlocked')
  })

  it('ignores a soft-deleted blocker', async () => {
    const h = make([{ isDeleted: true, statusId: STATUS_1 }])

    await h.service.changeStatus('a', FIRST_TO_SECOND)

    expect(h.saved).toHaveLength(1)
  })

  it('does not hold an item with no blockers, or a move back into the first lane', async () => {
    const none = make([])
    await none.service.changeStatus('a', FIRST_TO_SECOND)
    expect(none.saved).toHaveLength(1)

    const back = make([{ statusId: STATUS_1 }], { statusId: STATUS_2 })
    await back.service.changeStatus('a', { statusId: STATUS_1 })
    expect(back.saved).toHaveLength(1)
  })

  it('does not hold a move to the lane the item is already in', async () => {
    const h = make([{ statusId: STATUS_1 }])

    await h.service.changeStatus('a', { statusId: STATUS_1 })

    expect(h.saved).toHaveLength(0)
  })

  it('frees the item once its blockers are cleared', async () => {
    const h = make([{ statusId: STATUS_1 }])
    expect(await codeOf(h.service.changeStatus('a', FIRST_TO_SECOND))).toBe('taskBlocked')

    await h.service.setBlockedBy('a', [])
    await h.service.changeStatus('a', FIRST_TO_SECOND)

    expect(h.saved).toHaveLength(1)
  })
})

describe('changeStatus: Effort entry rule', () => {
  it.each([[EffortLevel.Low], [EffortLevel.Medium], [EffortLevel.High]])(
    'accepts Effort %s into a reference lane',
    async (effort) => {
      const h = harness({
        currentUser: orgAdmin(),
        boards: [PARENT_BOARD],
        ideas: [item('a', { boardId: BOARD_B, effort })],
      })

      await h.service.changeStatus('a', { statusId: STATUS_2 })

      expect(h.saved).toHaveLength(1)
    },
  )

  it('applies to a User on a board that lets users move items', async () => {
    const h = harness({
      currentUser: member(),
      boards: [{ ...PARENT_BOARD, allowUserStatusUpdate: true }],
      ideas: [item('a', { boardId: BOARD_B })],
    })

    expect(await codeOf(h.service.changeStatus('a', { statusId: STATUS_2 }))).toBe(
      'effortRequiredForReferenceLane',
    )
    expect(h.saved).toHaveLength(0)
  })

  it('does not apply to a move out of a reference lane', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [PARENT_BOARD],
      ideas: [item('a', { boardId: BOARD_B, statusId: STATUS_2 })],
    })

    await h.service.changeStatus('a', { statusId: STATUS_1 })

    expect(h.saved).toHaveLength(1)
  })
})
