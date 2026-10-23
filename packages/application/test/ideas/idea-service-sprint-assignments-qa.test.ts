// QA for `IdeaService.assignBoardSprints` (SPEC/contracts/sprints.md "Backlog and sprint planning",
// `PUT /boards/{boardId}/sprint-assignments`): roles, the keyed 400s, the 422s, all-or-nothing, the
// no-op rule, audit per changed item only, and that a status in the request goes through the one
// status-move path - the same outcome `changeStatus` gives.
//
// "Nothing written" is asserted as no commit (`unitOfWork.saves`) and no audit event: the harness
// records a staged `update` as it is staged, so `saved` alone cannot say whether it was committed.
// Real rollback is the Postgres suite's.

import { EffortLevel, SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import { member, ORG_A, ORG_B, orgAdmin, readOnly, siteAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  board,
  harness,
  idea,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const SPRINT = 'sprint-1'
const SPRINT_2 = 'sprint-2'
const FINAL = 'final-lane'
const REF_LANE = 'ref-lane'
const CHILD_BOARD = 'child-board'

function sprint(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    organizationId: ORG_A,
    name: id,
    startDate: '2026-09-21',
    endDate: '2026-10-04',
    state: SprintState.Planned,
    isDeleted: false,
    boardId: BOARD_A,
    ...over,
  }
}

const SPRINTS = [sprint(SPRINT), sprint(SPRINT_2, { state: SprintState.Active })]

const WORK_BOARD = board({
  keyPrefix: 'TK',
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: null },
    { statusId: FINAL, displayOrder: 2, isFinal: true, referencesBoardId: null },
  ],
})

const item = (id: string, over: Parameters<typeof idea>[0] = {}) => idea({ id, title: id, ...over })

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (thrown: unknown) => thrown,
  )
}

function make(
  ideas: ReturnType<typeof idea>[],
  extra: Partial<Parameters<typeof harness>[0]> = {},
  boards = [WORK_BOARD],
) {
  return harness({ currentUser: orgAdmin(), boards, ideas, sprints: SPRINTS, ...extra })
}

function expectNothingCommitted(h: ReturnType<typeof make>): void {
  expect(h.unitOfWork.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
  expect(h.notifications).toHaveLength(0)
}

const sprintEvents = (h: ReturnType<typeof make>) =>
  h.audit.events.filter((e) => e.eventType === 'IssueSprintAssignmentChanged')
const statusEvents = (h: ReturnType<typeof make>) =>
  h.audit.events.filter((e) => e.eventType === 'IdeaStatusChanged')

describe('assignBoardSprints: who may plan', () => {
  it('lets an Org Admin add items to a sprint in one commit', async () => {
    const h = make([item('a'), item('b')])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a', 'b'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.unitOfWork.saves).toBe(1)
    expect(h.saved.map((i) => [i.id, i.sprintId])).toEqual([
      ['a', SPRINT],
      ['b', SPRINT],
    ])
  })

  it('lets a User schedule the items they authored', async () => {
    const h = make([item('a', { authorUserId: 'user-1' })], { currentUser: member() })

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.saved.map((i) => [i.id, i.sprintId])).toEqual([['a', SPRINT]])
  })

  it('refuses the whole request, keyed ideaIds, when a User did not author every item', async () => {
    const h = make([item('a', { authorUserId: 'user-1' }), item('b', { authorUserId: 'other' })], {
      currentUser: member(),
    })

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a', 'b'],
        sprintId: SPRINT,
        statusId: null,
      }),
    )

    expect(error).toBeInstanceOf(ForbiddenError)
    const failures = (error as ForbiddenError).failures ?? {}
    expect(Object.keys(failures)).toEqual(['ideaIds'])
    expect(failures.ideaIds?.[0]).toMatch(/^Only the author or an Org Admin can schedule /)
    expect(h.saved).toHaveLength(0)
    expectNothingCommitted(h)
  })

  it.each([
    ['a Read Only user', readOnly()],
    ['a Site Admin acting directly', siteAdmin()],
  ])('refuses %s with Forbidden and writes nothing', async (_label, currentUser) => {
    const h = make([item('a')], { currentUser })

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
    )

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(h.saved).toHaveLength(0)
    expectNothingCommitted(h)
  })

  it('answers 404 for an unknown board and for an admin of another organization', async () => {
    const unknown = make([item('a')])
    expect(
      await failure(
        unknown.service.assignBoardSprints('nope', {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: null,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)

    const foreign = make([item('a')], { currentUser: orgAdmin(ORG_B) })
    expect(
      await failure(
        foreign.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: null,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
    expectNothingCommitted(foreign)
  })
})

describe('assignBoardSprints: request validation is keyed', () => {
  async function failures(
    command: Parameters<ReturnType<typeof make>['service']['assignBoardSprints']>[1],
    ideas = [item('a')],
    boards?: Parameters<typeof make>[2],
  ) {
    const h = make(ideas, {}, boards)
    const error = await failure(h.service.assignBoardSprints(BOARD_A, command))
    expect(error).toBeInstanceOf(ValidationError)
    expectNothingCommitted(h)
    return (error as ValidationError).failures
  }

  it('refuses an empty ideaIds', async () => {
    expect(await failures({ ideaIds: [], sprintId: SPRINT, statusId: null })).toHaveProperty(
      'ideaIds',
    )
  })

  it('refuses more than 200 ideaIds, and accepts exactly 200', async () => {
    const ids = Array.from({ length: 201 }, (_, i) => `i${i}`)
    expect(await failures({ ideaIds: ids, sprintId: SPRINT, statusId: null })).toHaveProperty(
      'ideaIds',
    )

    const items = ids.slice(0, 200).map((id) => item(id))
    const h = make(items)
    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ids.slice(0, 200),
      sprintId: SPRINT,
      statusId: null,
    })
    expect(h.saved).toHaveLength(200)
  })

  it('refuses a duplicate id', async () => {
    expect(
      await failures({ ideaIds: ['a', 'a'], sprintId: SPRINT, statusId: null }),
    ).toHaveProperty('ideaIds')
  })

  it('refuses an id that names no item, leaving the valid ones untouched', async () => {
    expect(
      await failures({ ideaIds: ['a', 'ghost'], sprintId: SPRINT, statusId: null }),
    ).toHaveProperty('ideaIds')
  })

  it('refuses a soft-deleted item as one that names no live item', async () => {
    expect(
      await failures({ ideaIds: ['a', 'gone'], sprintId: SPRINT, statusId: null }, [
        item('a'),
        item('gone', { isDeleted: true }),
      ]),
    ).toHaveProperty('ideaIds')
  })

  it('refuses an item of another organization as one that names no item', async () => {
    expect(
      await failures({ ideaIds: ['a', 'foreign'], sprintId: SPRINT, statusId: null }, [
        item('a'),
        item('foreign', { organizationId: ORG_B }),
      ]),
    ).toHaveProperty('ideaIds')
  })

  it('refuses a statusId with a null sprintId, keyed statusId', async () => {
    expect(await failures({ ideaIds: ['a'], sprintId: null, statusId: STATUS_2 })).toHaveProperty(
      'statusId',
    )
  })

  it('refuses a statusId that is not a lane of this board, keyed statusId', async () => {
    expect(
      await failures({ ideaIds: ['a'], sprintId: SPRINT, statusId: 'not-a-lane' }),
    ).toHaveProperty('statusId')
  })

  it('refuses an unknown sprint, keyed sprintId', async () => {
    expect(await failures({ ideaIds: ['a'], sprintId: 'ghost', statusId: null })).toHaveProperty(
      'sprintId',
    )
  })

  it('refuses a deleted sprint and a sprint of another organization, keyed sprintId', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [WORK_BOARD],
      ideas: [item('a')],
      sprints: [
        sprint('deleted', { isDeleted: true }),
        sprint('foreign', { organizationId: ORG_B }),
      ],
    })

    for (const sprintId of ['deleted', 'foreign']) {
      const error = await failure(
        h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId, statusId: null }),
      )
      expect((error as ValidationError).failures).toHaveProperty('sprintId')
    }
    expect(h.unitOfWork.saves).toBe(0)
  })

  it('refuses a sprint of another board, keyed sprintId (not the 422)', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [WORK_BOARD],
      ideas: [item('a')],
      sprints: [sprint('other', { boardId: BOARD_B })],
    })

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: 'other', statusId: null }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).failures).toHaveProperty('sprintId')
    expect(h.unitOfWork.saves).toBe(0)
  })

  it('refuses a legacy (org-wide) sprint, which is not a sprint of this board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [WORK_BOARD],
      ideas: [item('a')],
      sprints: [sprint('legacy', { boardId: null })],
    })

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: 'legacy', statusId: null }),
    )

    expect((error as ValidationError).failures).toHaveProperty('sprintId')
  })

  it('refuses a completed sprint with the contract message, writing nothing', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [WORK_BOARD],
      ideas: [item('a')],
      sprints: [sprint('done', { state: SprintState.Completed })],
    })

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: 'done', statusId: null }),
    )

    expect((error as ValidationError).failures).toEqual({
      sprintId: ['A completed sprint cannot take new issues.'],
    })
    expectNothingCommitted(h)
  })

  it('still lets items leave a completed sprint for the backlog', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: [WORK_BOARD],
      ideas: [item('a', { sprintId: 'done' })],
      sprints: [sprint('done', { state: SprintState.Completed })],
    })

    await h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: null, statusId: null })

    expect(h.saved[0]?.sprintId).toBeNull()
  })
})

describe('assignBoardSprints: other board and all-or-nothing', () => {
  it('refuses an item of another board with sprintItemOnOtherBoard', async () => {
    const h = make([item('a', { boardId: BOARD_B })])

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
    )

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expectNothingCommitted(h)
  })

  it('refuses an item with no board the same way', async () => {
    const h = make([item('a', { boardId: null })])

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
    )

    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
  })

  it('commits nothing when the last of several items is on another board', async () => {
    const h = make([item('a'), item('b'), item('c', { boardId: BOARD_B })])

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a', 'b', 'c'],
        sprintId: SPRINT,
        statusId: null,
      }),
    )

    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
    expectNothingCommitted(h)
  })

  it('also refuses returning another board’s item to the backlog', async () => {
    const h = make([item('a', { boardId: BOARD_B, sprintId: 'x' })])

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: null, statusId: null }),
    )

    expect(error).toMatchObject({ code: 'sprintItemOnOtherBoard' })
  })
})

describe('assignBoardSprints: move, return and no-op', () => {
  it('moves an item from another sprint of the board (create would refuse it)', async () => {
    const h = make([item('a', { sprintId: SPRINT_2 })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.saved[0]?.sprintId).toBe(SPRINT)
    expect(sprintEvents(h)).toHaveLength(1)
    expect(JSON.parse(sprintEvents(h)[0]?.metadataJson ?? '{}')).toEqual({
      fromSprintId: SPRINT_2,
      toSprintId: SPRINT,
    })
  })

  it('returns items to the backlog with sprintId null', async () => {
    const h = make([item('a', { sprintId: SPRINT }), item('b', { sprintId: SPRINT_2 })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a', 'b'],
      sprintId: null,
      statusId: null,
    })

    expect(h.saved.map((i) => i.sprintId)).toEqual([null, null])
    expect(sprintEvents(h).map((e) => JSON.parse(e.metadataJson ?? '{}'))).toEqual([
      { fromSprintId: SPRINT, toSprintId: null },
      { fromSprintId: SPRINT_2, toSprintId: null },
    ])
  })

  it('writes one event per changed item and none for items already in the sprint', async () => {
    const h = make([item('in', { sprintId: SPRINT }), item('new')])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['in', 'new'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.audit.events).toHaveLength(1)
    expect(h.audit.events[0]).toMatchObject({
      eventType: 'IssueSprintAssignmentChanged',
      entityId: 'new',
    })
    expect(h.saved.map((i) => i.id)).toEqual(['new'])
  })

  it('writes nothing at all when every item is already in the sprint', async () => {
    const h = make([item('a', { sprintId: SPRINT }), item('b', { sprintId: SPRINT })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a', 'b'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('writes nothing when returning items that are already in the backlog', async () => {
    const h = make([item('a')])

    await h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: null, statusId: null })

    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('does not touch status or notify when no statusId is sent', async () => {
    const h = make([item('a', { statusId: STATUS_2 })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.saved[0]?.statusId).toBe(STATUS_2)
    expect(statusEvents(h)).toHaveLength(0)
    expect(h.notifications).toHaveLength(0)
  })

  it('stamps the actor and the clock on a changed item', async () => {
    const h = make([item('a')])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: null,
    })

    expect(h.saved[0]?.updatedByUserId).toBe('org-admin-1')
  })
})

describe('assignBoardSprints: statusId is a lane drop through the status-move path', () => {
  it('sets sprint and status together and audits each change once per item', async () => {
    const h = make([item('a'), item('b')])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a', 'b'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })

    expect(h.unitOfWork.saves).toBe(1)
    expect(h.saved.map((i) => [i.id, i.sprintId, i.statusId])).toEqual([
      ['a', SPRINT, STATUS_2],
      ['b', SPRINT, STATUS_2],
    ])
    expect(sprintEvents(h)).toHaveLength(2)
    expect(statusEvents(h)).toHaveLength(2)
  })

  it('stages a single update per item that changes both sprint and status', async () => {
    const h = make([item('a')])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })

    expect(h.saved).toHaveLength(1)
  })

  it('moves only the status of an item already in the sprint, with no sprint event', async () => {
    const h = make([item('a', { sprintId: SPRINT })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })

    expect(h.saved[0]?.statusId).toBe(STATUS_2)
    expect(sprintEvents(h)).toHaveLength(0)
    expect(statusEvents(h)).toHaveLength(1)
  })

  it('moves only the sprint of an item already in the status, with no status event', async () => {
    const h = make([item('a', { statusId: STATUS_2 })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })

    expect(h.saved[0]?.sprintId).toBe(SPRINT)
    expect(sprintEvents(h)).toHaveLength(1)
    expect(statusEvents(h)).toHaveLength(0)
  })

  it('writes nothing for an item already in both the sprint and the status', async () => {
    const h = make([item('a', { sprintId: SPRINT, statusId: STATUS_2 })])

    await h.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })

    expect(h.saved).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
    expect(h.notifications).toHaveLength(0)
  })

  it('writes the same status event changeStatus writes', async () => {
    const viaAssign = make([item('a')])
    await viaAssign.service.assignBoardSprints(BOARD_A, {
      ideaIds: ['a'],
      sprintId: SPRINT,
      statusId: STATUS_2,
    })
    const viaMove = make([item('a')])
    await viaMove.service.changeStatus('a', { statusId: STATUS_2 })

    expect(statusEvents(viaAssign)).toEqual(statusEvents(viaMove))
    expect(viaAssign.notifications).toEqual(viaMove.notifications)
  })

  describe('a blocked task', () => {
    const blocked = (blockerStatus: string) =>
      make([item('a'), item('blocker', { statusId: blockerStatus }), item('ok')], {
        dependencies: [{ blockedId: 'a', blockerId: 'blocker' }],
      })

    it.each([
      ['dropped on the second lane', STATUS_2],
      ['dropped straight into a final lane', FINAL],
    ])(
      'is refused with taskBlocked when %s, and the whole request is rolled back',
      async (_l, lane) => {
        const h = blocked(STATUS_1)

        const error = await failure(
          // 'ok' goes first so it is staged before the blocked one is met.
          h.service.assignBoardSprints(BOARD_A, {
            ideaIds: ['ok', 'a'],
            sprintId: SPRINT,
            statusId: lane,
          }),
        )

        expect(error).toBeInstanceOf(UnprocessableError)
        expect(error).toMatchObject({ code: 'taskBlocked' })
        expectNothingCommitted(h)
      },
    )

    it('is refused the same way changeStatus refuses it', async () => {
      const viaMove = await failure(
        blocked(STATUS_1).service.changeStatus('a', { statusId: STATUS_2 }),
      )
      const viaAssign = await failure(
        blocked(STATUS_1).service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: STATUS_2,
        }),
      )

      expect((viaAssign as UnprocessableError).code).toBe((viaMove as UnprocessableError).code)
    })

    it('can still be added to the sprint without a statusId', async () => {
      const h = blocked(STATUS_1)

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: null,
      })

      expect(h.saved[0]?.sprintId).toBe(SPRINT)
    })

    it('can be dropped on the first lane it already sits in', async () => {
      const h = blocked(STATUS_1)

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: STATUS_1,
      })

      expect(h.saved[0]?.sprintId).toBe(SPRINT)
      expect(statusEvents(h)).toHaveLength(0)
    })

    it('moves once every blocker is final', async () => {
      const h = blocked(FINAL)

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: STATUS_2,
      })

      expect(h.saved[0]?.statusId).toBe(STATUS_2)
    })
  })

  describe('the reference-lane rules', () => {
    const REF_BOARD = board({
      keyPrefix: 'RB',
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
        { statusId: REF_LANE, displayOrder: 1, isFinal: false, referencesBoardId: CHILD_BOARD },
        { statusId: STATUS_2, displayOrder: 2, isFinal: false, referencesBoardId: null },
      ],
    })
    const CHILD = board({
      boardId: CHILD_BOARD,
      keyPrefix: 'CH',
      swimlanes: [{ statusId: 'c1', displayOrder: 0, isFinal: false, referencesBoardId: null }],
    })

    function onRefBoard(
      ideas: ReturnType<typeof idea>[],
      extra: Partial<Parameters<typeof harness>[0]> = {},
    ) {
      return make(ideas, extra, [REF_BOARD, CHILD])
    }

    it('refuses a drop into a reference lane for an item with no Effort, as changeStatus does', async () => {
      const viaMove = await failure(
        onRefBoard([item('a')]).service.changeStatus('a', { statusId: REF_LANE }),
      )
      const h = onRefBoard([item('ok', { effort: EffortLevel.Low }), item('a')])
      const viaAssign = await failure(
        h.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['ok', 'a'],
          sprintId: SPRINT,
          statusId: REF_LANE,
        }),
      )

      expect((viaMove as UnprocessableError).code).toBe('effortRequiredForReferenceLane')
      expect((viaAssign as UnprocessableError).code).toBe('effortRequiredForReferenceLane')
      expectNothingCommitted(h)
    })

    it('accepts a drop into a reference lane once the item has an Effort', async () => {
      const h = onRefBoard([item('a', { effort: EffortLevel.Medium })])

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: REF_LANE,
      })

      expect(h.saved[0]?.statusId).toBe(REF_LANE)
    })

    it('refuses to drag a card with open tasks out of its reference lane, with the changeStatus code', async () => {
      const open = { childCounts: { a: { total: 3, done: 1 } } }
      const viaMove = await failure(
        onRefBoard([item('a', { statusId: REF_LANE })], open).service.changeStatus('a', {
          statusId: STATUS_2,
        }),
      )
      const h = onRefBoard([item('a', { statusId: REF_LANE })], open)
      const viaAssign = await failure(
        h.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: STATUS_2,
        }),
      )

      expect((viaMove as UnprocessableError).code).toBe('parentHasOpenTasks')
      expect((viaAssign as UnprocessableError).code).toBe('parentHasOpenTasks')
      expectNothingCommitted(h)
    })

    it('lets a card go once its tasks are all final', async () => {
      const h = onRefBoard([item('a', { statusId: REF_LANE })], {
        childCounts: { a: { total: 2, done: 2 } },
      })

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: STATUS_2,
      })

      expect(h.saved[0]?.statusId).toBe(STATUS_2)
    })

    it('never overrides the lock: a sprint-only add of a locked card is fine, a move is not', async () => {
      const open = { childCounts: { a: { total: 1, done: 0 } } }
      const add = onRefBoard([item('a', { statusId: REF_LANE })], open)
      await add.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a'],
        sprintId: SPRINT,
        statusId: null,
      })
      expect(add.saved[0]?.sprintId).toBe(SPRINT)

      const move = onRefBoard([item('a', { statusId: REF_LANE })], open)
      const error = await failure(
        move.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: STATUS_2,
        }),
      )
      expect(error).toMatchObject({ code: 'parentHasOpenTasks' })
    })
  })

  describe('an autoCreateTask reference lane receiving several items in one request', () => {
    const AUTO_BOARD = board({
      keyPrefix: 'AB',
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
        {
          statusId: REF_LANE,
          displayOrder: 1,
          isFinal: false,
          referencesBoardId: CHILD_BOARD,
          autoCreateTask: true,
        },
      ],
    })
    const CHILD = board({
      boardId: CHILD_BOARD,
      keyPrefix: 'CH',
      swimlanes: [{ statusId: 'c1', displayOrder: 0, isFinal: false, referencesBoardId: null }],
    })

    it('creates one task per moved item, on the referenced board, with distinct item numbers', async () => {
      const ideas = ['a', 'b', 'c'].map((id) => item(id, { effort: EffortLevel.Low }))
      const h = make(ideas, {}, [AUTO_BOARD, CHILD])

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a', 'b', 'c'],
        sprintId: SPRINT,
        statusId: REF_LANE,
      })

      expect(h.unitOfWork.saves).toBe(1)
      expect(h.added).toHaveLength(3)
      expect(h.added.every((t) => t.boardId === CHILD_BOARD)).toBe(true)
      expect(h.added.map((t) => t.parentIdeaId).sort()).toEqual(['a', 'b', 'c'])
      const numbers = h.added.map((t) => t.itemNumber)
      expect(numbers.every((n) => n !== null)).toBe(true)
      expect(new Set(numbers).size).toBe(3)
    })

    it('creates no task for a card that already has one on the referenced board', async () => {
      const h = make(
        [item('a', { effort: EffortLevel.Low }), item('b', { effort: EffortLevel.Low })],
        { parentsWithTasks: ['a'] },
        [AUTO_BOARD, CHILD],
      )

      await h.service.assignBoardSprints(BOARD_A, {
        ideaIds: ['a', 'b'],
        sprintId: SPRINT,
        statusId: REF_LANE,
      })

      expect(h.added.map((t) => t.parentIdeaId)).toEqual(['b'])
    })
  })
})

describe('assignBoardSprints: a per-item 422 names the item on ideaIds', () => {
  const OTHER = board({ boardId: BOARD_B, name: 'Other', keyPrefix: 'OT' })
  const keyed = (error: unknown) => {
    expect(error).toBeInstanceOf(UnprocessableError)
    return error as UnprocessableError
  }

  it('leads with the item key when its board has a prefix, and the code stays the rule', async () => {
    const h = make([item('a', { boardId: BOARD_B, itemNumber: 12 })], {}, [WORK_BOARD, OTHER])

    const error = keyed(
      await failure(
        h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
      ),
    )

    expect(error.code).toBe('sprintItemOnOtherBoard')
    expect(error.failures).toEqual({ ideaIds: [error.message] })
    expect(error.message.startsWith('OT-12: ')).toBe(true)
  })

  it('falls back to the quoted title when the board has no prefix', async () => {
    const noPrefix = board({ boardId: BOARD_B, name: 'Other', keyPrefix: null })
    const h = make([item('a', { boardId: BOARD_B, title: 'Fix login' })], {}, [
      WORK_BOARD,
      noPrefix,
    ])

    const error = keyed(
      await failure(
        h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
      ),
    )

    expect(error.message.startsWith("'Fix login': ")).toBe(true)
    expect(error.failures).toEqual({ ideaIds: [error.message] })
  })

  it('falls back to the title when the item has a prefix but no number', async () => {
    const h = make([item('a', { boardId: BOARD_B, title: 'No number', itemNumber: null })], {}, [
      WORK_BOARD,
      OTHER,
    ])

    const error = keyed(
      await failure(
        h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
      ),
    )

    expect(error.message.startsWith("'No number': ")).toBe(true)
  })

  it('names an item with no board by its title', async () => {
    const h = make([item('a', { boardId: null, title: 'Loose', itemNumber: 4 })])

    const error = keyed(
      await failure(
        h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: SPRINT, statusId: null }),
      ),
    )

    expect(error.message.startsWith("'Loose': ")).toBe(true)
  })

  it('names the refused item, not a neighbour, on a status-move 422 (taskBlocked)', async () => {
    const h = make(
      [
        item('ok', { itemNumber: 1 }),
        item('a', { itemNumber: 2 }),
        item('blocker', { itemNumber: 3 }),
      ],
      { dependencies: [{ blockedId: 'a', blockerId: 'blocker' }] },
    )

    const error = keyed(
      await failure(
        h.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['ok', 'a'],
          sprintId: SPRINT,
          statusId: STATUS_2,
        }),
      ),
    )

    expect(error.code).toBe('taskBlocked')
    expect(error.message.startsWith('TK-2: ')).toBe(true)
    expect(error.failures).toEqual({ ideaIds: [error.message] })
    expectNothingCommitted(h)
  })

  it('keys the effort and open-task refusals the same way', async () => {
    const REF = board({
      keyPrefix: 'TK',
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
        { statusId: REF_LANE, displayOrder: 1, isFinal: false, referencesBoardId: CHILD_BOARD },
      ],
    })
    const child = board({ boardId: CHILD_BOARD, keyPrefix: 'CH' })

    const effort = make([item('a', { itemNumber: 9 })], {}, [REF, child])
    const e1 = keyed(
      await failure(
        effort.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: REF_LANE,
        }),
      ),
    )
    expect(e1.code).toBe('effortRequiredForReferenceLane')
    expect(e1.failures).toEqual({ ideaIds: [e1.message] })
    expect(e1.message.startsWith('TK-9: ')).toBe(true)

    const lock = make(
      [item('a', { itemNumber: 9, statusId: REF_LANE })],
      {
        childCounts: { a: { total: 2, done: 0 } },
      },
      [REF, child],
    )
    const e2 = keyed(
      await failure(
        lock.service.assignBoardSprints(BOARD_A, {
          ideaIds: ['a'],
          sprintId: SPRINT,
          statusId: STATUS_1,
        }),
      ),
    )
    expect(e2.code).toBe('parentHasOpenTasks')
    expect(e2.message.startsWith('TK-9: ')).toBe(true)
  })

  it('does not key a 400 as a 422: validation failures keep their own shape', async () => {
    const h = make([item('a')])

    const error = await failure(
      h.service.assignBoardSprints(BOARD_A, { ideaIds: ['a'], sprintId: null, statusId: STATUS_2 }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).not.toBeInstanceOf(UnprocessableError)
  })
})
