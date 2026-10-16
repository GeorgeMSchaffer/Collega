// QA for the reference-lane lock (SPEC/decisions.md 2026-10-16 "A reference lane locks its card
// until its tasks are final", SPEC/20-feature-board-references.md Behavior 4, contracts/ideas.md
// status route and `DELETE /ideas/{id}/board`): the lock on a move and on a detach, the Org Admin
// override and its audit, and the auto-create on entering a lane. The pull path is BoardService's,
// in test/boards/board-reference-lock-qa.test.ts. In-memory ports, fixed clock and ids.
//
// Deliberately not pinned (open owner questions): a pull or `ideaMoves` into an `autoCreateTask`
// lane, and whether a missing idea answers 403 or 404 when `forceReason` is sent.

import { EffortLevel, Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { AuditEventInput } from '../../src/common/index.js'
import {
  ConflictError,
  ForbiddenError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { BoardContext } from '../../src/ideas/ports.js'
import {
  anonymous,
  impersonating,
  member,
  ORG_A,
  orgAdmin,
  type RecordingAudit,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_B,
  board,
  type Harness,
  harness,
  idea,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const STATUS_3 = 'status-3'
const TASK_LANE_1 = 'task-lane-1'
const TASK_LANE_2 = 'task-lane-2'
const TITLE = 'Reduce onboarding friction'

type Lanes = BoardContext['swimlanes']

/** Lane 1 plain, lane 2 hands work to BOARD_B (optionally creating a task on entry), lane 3 plain. */
function parentBoard(
  overrides: { autoCreateTask?: boolean; allowUserStatusUpdate?: boolean } = {},
) {
  const swimlanes: Lanes = [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    {
      statusId: STATUS_2,
      displayOrder: 1,
      isFinal: false,
      referencesBoardId: BOARD_B,
      autoCreateTask: overrides.autoCreateTask ?? false,
    },
    { statusId: STATUS_3, displayOrder: 2, isFinal: false, referencesBoardId: null },
  ]
  return board({
    swimlanes,
    keyPrefix: 'CI',
    allowUserStatusUpdate: overrides.allowUserStatusUpdate ?? false,
  })
}

// Listed out of order on purpose: the first lane is the one with the lowest displayOrder.
function childBoard(overrides: Partial<BoardContext> = {}) {
  return board({
    boardId: BOARD_B,
    name: 'Delivery',
    keyPrefix: 'DL',
    ideaFeaturesEnabled: false,
    swimlanes: [
      { statusId: TASK_LANE_2, displayOrder: 1, isFinal: true, referencesBoardId: null },
      { statusId: TASK_LANE_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    ],
    ...overrides,
  })
}

/** The parent sits in the reference lane (STATUS_2) with an Effort, as entry required. */
const parentInReferenceLane = (overrides = {}) =>
  idea({ statusId: STATUS_2, effort: EffortLevel.Medium, ...overrides })

const meta = (e: AuditEventInput | undefined) =>
  JSON.parse(e?.metadataJson ?? 'null') as Record<string, unknown> | null
const types = (h: Harness) => h.audit.events.map((e) => e.eventType)
const OPEN_2 = { 'idea-1': { total: 3, done: 1 } }

function lockedHarness(
  currentUser = orgAdmin(ORG_A),
  childCounts: Record<string, { total: number; done: number }> = OPEN_2,
  parent = parentInReferenceLane(),
) {
  return harness({
    currentUser,
    boards: [parentBoard(), childBoard()],
    ideas: [parent],
    childCounts,
  })
}

function expectNothingChanged(h: Harness) {
  expect(h.saved).toHaveLength(0)
  expect(h.added).toHaveLength(0)
  expect(h.unitOfWork.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
  expect(h.notifications).toHaveLength(0)
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('changeStatus: the lock on leaving a reference lane', () => {
  it('refuses with 422 parentHasOpenTasks, naming the open count (total minus done), and saves nothing', async () => {
    const h = lockedHarness()

    const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({
      code: 'parentHasOpenTasks',
      message: `'${TITLE}' is waiting on 2 open tasks, so it cannot leave its lane.`,
    })
    expectNothingChanged(h)
  })

  it('holds the card back out of the reference lane in either direction', async () => {
    const forward = lockedHarness()
    const back = lockedHarness()

    expect(
      await failure(forward.service.changeStatus('idea-1', { statusId: STATUS_3 })),
    ).toMatchObject({ code: 'parentHasOpenTasks' })
    expect(
      await failure(back.service.changeStatus('idea-1', { statusId: STATUS_1 })),
    ).toMatchObject({ code: 'parentHasOpenTasks' })
  })

  it('counts a single open task and uses the same wording', async () => {
    const h = lockedHarness(orgAdmin(ORG_A), { 'idea-1': { total: 1, done: 0 } })

    const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))

    expect(error).toMatchObject({
      message: `'${TITLE}' is waiting on 1 open tasks, so it cannot leave its lane.`,
    })
  })

  it('locks a User who may move cards on the board just the same', async () => {
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [parentBoard({ allowUserStatusUpdate: true }), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))).toMatchObject({
      code: 'parentHasOpenTasks',
    })
    expectNothingChanged(h)
  })

  it('locks a Site Admin viewing as an Org Admin, by the effective role', async () => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const h = lockedHarness(viewAs)

    expect(await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))).toMatchObject({
      code: 'parentHasOpenTasks',
    })
  })

  it.each([
    ['has no tasks at all', {}],
    ['has tasks that are all in a final lane', { 'idea-1': { total: 2, done: 2 } }],
    ['has a total of zero', { 'idea-1': { total: 0, done: 0 } }],
  ])('lets the card leave when it %s', async (_label, childCounts) => {
    const h = lockedHarness(orgAdmin(ORG_A), childCounts)

    await h.service.changeStatus('idea-1', { statusId: STATUS_3 })

    expect(h.saved[0]?.statusId).toBe(STATUS_3)
    expect(types(h)).toEqual(['IdeaStatusChanged'])
  })

  it('does not lock a card outside a reference lane, whatever the repository counts', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ statusId: STATUS_1 })],
      childCounts: OPEN_2,
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_3 })

    expect(h.saved[0]?.statusId).toBe(STATUS_3)
  })

  it('does not lock a move into the reference lane from a plain one', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ statusId: STATUS_1, effort: EffortLevel.Low })],
      childCounts: OPEN_2,
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.saved[0]?.statusId).toBe(STATUS_2)
  })

  it('does not lock a drop on the lane the card already sits in', async () => {
    const h = lockedHarness()

    await expect(h.service.changeStatus('idea-1', { statusId: STATUS_2 })).resolves.toBeUndefined()
    expectNothingChanged(h)
  })
})

describe('changeStatus: the Org Admin override', () => {
  it('moves the card past its open tasks and writes IdeaMovedPastOpenTasks with the reason and count', async () => {
    const h = lockedHarness()

    await h.service.changeStatus('idea-1', {
      statusId: STATUS_3,
      forceReason: 'Customer escalation',
    })

    expect(h.saved[0]?.statusId).toBe(STATUS_3)
    const forced = h.audit.events.find((e) => e.eventType === 'IdeaMovedPastOpenTasks')
    expect(forced).toMatchObject({
      entityType: 'Idea',
      entityId: 'idea-1',
      message: `Idea '${TITLE}' moved past 2 open tasks.`,
    })
    expect(meta(forced)).toEqual({ reason: 'Customer escalation', openTaskCount: 2 })
  })

  it('writes the usual move event first, then the override event', async () => {
    const h = lockedHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Because' })

    expect(types(h)).toEqual(['IdeaStatusChanged', 'IdeaMovedPastOpenTasks'])
  })

  it('writes the override event only after the move is committed', async () => {
    const savesAtWrite: Record<string, number> = {}
    const audit: RecordingAudit = {
      events: [],
      async write(event) {
        savesAtWrite[event.eventType] = h.unitOfWork.saves
        this.events.push(event)
      },
    }
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
      audit,
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Because' })

    expect(savesAtWrite.IdeaMovedPastOpenTasks).toBe(1)
  })

  it('does not touch the tasks: it saves exactly the parent', async () => {
    const h = lockedHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Because' })

    expect(h.saved.map((i) => i.id)).toEqual(['idea-1'])
    expect(h.added).toHaveLength(0)
  })

  it('stores the reason trimmed', async () => {
    const h = lockedHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: '  padded reason  ' })

    const forced = h.audit.events.find((e) => e.eventType === 'IdeaMovedPastOpenTasks')
    expect(meta(forced)?.reason).toBe('padded reason')
  })

  it.each([
    ['has no tasks', {}],
    ['has only final tasks', { 'idea-1': { total: 2, done: 2 } }],
  ])('writes no override event when the card %s, though a reason was sent', async (_l, counts) => {
    const h = lockedHarness(orgAdmin(ORG_A), counts)

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Just in case' })

    expect(h.saved[0]?.statusId).toBe(STATUS_3)
    expect(types(h)).toEqual(['IdeaStatusChanged'])
  })

  it('writes no override event when the card is not in a reference lane', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ statusId: STATUS_1 })],
      childCounts: OPEN_2,
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Just in case' })

    expect(types(h)).toEqual(['IdeaStatusChanged'])
  })

  it.each([
    ['an empty string', ''],
    ['spaces only', '   '],
    ['a tab and a newline', '\t\n'],
    ['null', null],
    ['absent', undefined],
  ])('treats %s as no reason: a locked card still refuses', async (_label, forceReason) => {
    const h = lockedHarness()

    const error = await failure(
      h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason }),
    )

    expect(error).toMatchObject({ code: 'parentHasOpenTasks' })
    expectNothingChanged(h)
  })

  it('treats a blank reason on an unlocked card as nothing sent: moves, no override event', async () => {
    const h = lockedHarness(orgAdmin(ORG_A), {})

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: '   ' })

    expect(types(h)).toEqual(['IdeaStatusChanged'])
  })

  it('lets a Site Admin viewing as an Org Admin override, auditing the administrator as the actor', async () => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const h = lockedHarness(viewAs)

    await h.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Support request' })

    const forced = h.audit.events.find((e) => e.eventType === 'IdeaMovedPastOpenTasks')
    expect(forced?.attribution).toMatchObject({
      actorUserId: 'site-admin-9',
      onBehalfOfUserId: 'org-admin-1',
    })
  })
})

describe('changeStatus: forceReason from anyone but an Org Admin', () => {
  const sends = { statusId: STATUS_3, forceReason: 'Let me through' }

  it('is 403 for a User, on a locked card, and saves nothing', async () => {
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [parentBoard({ allowUserStatusUpdate: true }), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    const error = await failure(h.service.changeStatus('idea-1', sends))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect((error as Error).message).toBe('Only an Org Admin can move an item past its open tasks.')
    expectNothingChanged(h)
  })

  it('is 403 for a User even when the card is unlocked, and the card does not move', async () => {
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [parentBoard({ allowUserStatusUpdate: true }), childBoard()],
      ideas: [idea({ statusId: STATUS_1 })],
    })

    expect(await failure(h.service.changeStatus('idea-1', sends))).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('is 403 for a Read Only member', async () => {
    const h = harness({
      currentUser: readOnly(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.changeStatus('idea-1', sends))).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('is 403 for a Site Admin viewing as a User, by the effective role', async () => {
    const viewAs = impersonating({
      targetUserId: AUTHOR,
      targetRole: Role.User,
      targetOrganizationId: ORG_A,
    })
    const h = harness({
      currentUser: viewAs,
      boards: [parentBoard({ allowUserStatusUpdate: true }), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.changeStatus('idea-1', sends))).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('leaves a User with no reason answered by the lock itself, not by 403', async () => {
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [parentBoard({ allowUserStatusUpdate: true }), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))).toBeInstanceOf(
      UnprocessableError,
    )
  })
})

describe('changeStatus: a direct Site Admin and an anonymous caller (unchanged)', () => {
  it.each([
    ['without a reason', { statusId: STATUS_3 }],
    ['with a reason', { statusId: STATUS_3, forceReason: 'Because' }],
  ])('refuses a Site Admin acting as themselves %s', async (_label, command) => {
    const h = lockedHarness(siteAdmin())

    expect(await failure(h.service.changeStatus('idea-1', command))).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('rejects an unauthenticated caller', async () => {
    const h = lockedHarness(anonymous)

    expect(await failure(h.service.changeStatus('idea-1', { statusId: STATUS_3 }))).not.toBeNull()
    expectNothingChanged(h)
  })
})

describe('detachFromBoard: the lock', () => {
  it('refuses with 422 parentHasOpenTasks and the removal wording, and saves nothing', async () => {
    const h = lockedHarness()

    const error = await failure(h.service.detachFromBoard('idea-1'))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({
      code: 'parentHasOpenTasks',
      message: `'${TITLE}' is waiting on 2 open tasks, so it cannot be removed from its board.`,
    })
    expectNothingChanged(h)
  })

  it('locks the author, who is a User, the same way', async () => {
    const h = lockedHarness(member(ORG_A, AUTHOR))

    expect(await failure(h.service.detachFromBoard('idea-1'))).toMatchObject({
      code: 'parentHasOpenTasks',
    })
    expectNothingChanged(h)
  })

  it.each([
    ['has no tasks', {}],
    ['has only final tasks', { 'idea-1': { total: 3, done: 3 } }],
  ])('lets the card go when it %s', async (_label, childCounts) => {
    const h = lockedHarness(orgAdmin(ORG_A), childCounts)

    await h.service.detachFromBoard('idea-1')

    expect(h.saved[0]?.boardId).toBeNull()
    expect(types(h)).toEqual(['IdeaBoardChanged'])
  })

  it('does not lock a card outside a reference lane', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ statusId: STATUS_1 })],
      childCounts: OPEN_2,
    })

    await h.service.detachFromBoard('idea-1')

    expect(h.saved[0]?.boardId).toBeNull()
  })

  it('stays idempotent for a card already in the pool, even with a reason sent', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ boardId: null })],
    })

    await h.service.detachFromBoard('idea-1', 'Because')

    expectNothingChanged(h)
  })
})

describe('detachFromBoard: the Org Admin override', () => {
  it('detaches past the open tasks and writes IdeaMovedPastOpenTasks after IdeaBoardChanged', async () => {
    const h = lockedHarness()

    await h.service.detachFromBoard('idea-1', 'Board is being retired')

    expect(h.saved[0]?.boardId).toBeNull()
    expect(types(h)).toEqual(['IdeaBoardChanged', 'IdeaMovedPastOpenTasks'])
    const forced = h.audit.events[1]
    expect(forced).toMatchObject({
      entityType: 'Idea',
      entityId: 'idea-1',
      message: `Idea '${TITLE}' moved past 2 open tasks.`,
    })
    expect(meta(forced)).toEqual({ reason: 'Board is being retired', openTaskCount: 2 })
  })

  it('writes the override event only after the detach is committed', async () => {
    let savesAtWrite = -1
    const audit: RecordingAudit = {
      events: [],
      async write(event) {
        if (event.eventType === 'IdeaMovedPastOpenTasks') {
          savesAtWrite = h.unitOfWork.saves
        }
        this.events.push(event)
      },
    }
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
      audit,
    })

    await h.service.detachFromBoard('idea-1', 'Because')

    expect(savesAtWrite).toBe(1)
  })

  it('writes no override event when nothing held the card, though a reason was sent', async () => {
    const h = lockedHarness(orgAdmin(ORG_A), {})

    await h.service.detachFromBoard('idea-1', 'Just in case')

    expect(types(h)).toEqual(['IdeaBoardChanged'])
  })

  it.each([
    ['an empty string', ''],
    ['spaces only', '   '],
    ['null', null],
  ])('treats %s as no reason: a locked card still refuses', async (_label, forceReason) => {
    const h = lockedHarness()

    expect(await failure(h.service.detachFromBoard('idea-1', forceReason))).toMatchObject({
      code: 'parentHasOpenTasks',
    })
    expectNothingChanged(h)
  })

  it('lets an Org Admin override on an archived board', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [{ ...parentBoard(), isArchived: true }, childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    await h.service.detachFromBoard('idea-1', 'Because')

    expect(h.saved[0]?.boardId).toBeNull()
    expect(types(h)).toEqual(['IdeaBoardChanged', 'IdeaMovedPastOpenTasks'])
  })

  it('attributes a View As override to the administrator', async () => {
    const viewAs = impersonating({
      targetUserId: 'org-admin-1',
      targetRole: Role.OrgAdmin,
      targetOrganizationId: ORG_A,
      realUserId: 'site-admin-9',
    })
    const h = lockedHarness(viewAs)

    await h.service.detachFromBoard('idea-1', 'Support request')

    const forced = h.audit.events.find((e) => e.eventType === 'IdeaMovedPastOpenTasks')
    expect(forced?.attribution).toMatchObject({ actorUserId: 'site-admin-9' })
  })
})

describe('detachFromBoard: forceReason from anyone but an Org Admin', () => {
  it.each([
    ['the author, a User, on a locked card', member(ORG_A, AUTHOR), parentInReferenceLane()],
    [
      'the author, a User, on an unlocked card',
      member(ORG_A, AUTHOR),
      idea({ statusId: STATUS_1 }),
    ],
  ])('is 403 for %s, and the card stays on its board', async (_label, currentUser, parent) => {
    const h = harness({
      currentUser,
      boards: [parentBoard(), childBoard()],
      ideas: [parent],
      childCounts: OPEN_2,
    })

    const error = await failure(h.service.detachFromBoard('idea-1', 'Let me through'))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect((error as Error).message).toBe('Only an Org Admin can move an item past its open tasks.')
    expectNothingChanged(h)
  })

  it('is 403 for a Read Only author, who could not detach in any case', async () => {
    const h = harness({
      currentUser: readOnly(ORG_A, AUTHOR),
      boards: [parentBoard(), childBoard()],
      ideas: [idea({ statusId: STATUS_1 })],
    })

    expect(await failure(h.service.detachFromBoard('idea-1', 'Let me through'))).toBeInstanceOf(
      ForbiddenError,
    )
    expectNothingChanged(h)
  })

  it('is 403 for a Site Admin viewing as a User', async () => {
    const viewAs = impersonating({
      targetUserId: AUTHOR,
      targetRole: Role.User,
      targetOrganizationId: ORG_A,
    })
    const h = harness({
      currentUser: viewAs,
      boards: [parentBoard(), childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.detachFromBoard('idea-1', 'Because'))).toBeInstanceOf(
      ForbiddenError,
    )
    expectNothingChanged(h)
  })

  it('refuses a direct Site Admin whether or not a reason is sent (unchanged)', async () => {
    for (const reason of [undefined, 'Because']) {
      const h = lockedHarness(siteAdmin())
      expect(await failure(h.service.detachFromBoard('idea-1', reason))).toBeInstanceOf(
        ForbiddenError,
      )
      expectNothingChanged(h)
    }
  })

  it('keeps the archived-board conflict for a User with no reason (unchanged)', async () => {
    const h = harness({
      currentUser: member(ORG_A, AUTHOR),
      boards: [{ ...parentBoard(), isArchived: true }, childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })

    expect(await failure(h.service.detachFromBoard('idea-1'))).toBeInstanceOf(ConflictError)
  })
})

describe('changeStatus: auto-create on entering a lane (the hand-off)', () => {
  function autoHarness(overrides: Partial<Parameters<typeof harness>[0]> = {}) {
    return harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard({ autoCreateTask: true }), childBoard()],
      ideas: [idea({ statusId: STATUS_1, effort: EffortLevel.Medium })],
      ...overrides,
    })
  }

  it('creates exactly one task: the parent title, the child board first lane, linked to the parent', async () => {
    const h = autoHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({
      title: TITLE,
      boardId: BOARD_B,
      statusId: TASK_LANE_1,
      parentIdeaId: 'idea-1',
      itemNumber: 1,
      description: null,
      assigneeUserIds: [],
      tagIds: [],
    })
  })

  it('commits the move and the task together in one save', async () => {
    const h = autoHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.saved[0]).toMatchObject({ id: 'idea-1', statusId: STATUS_2 })
    expect(h.unitOfWork.saves).toBe(1)
  })

  it('audits the move and the task', async () => {
    const h = autoHarness()

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(types(h)).toEqual(
      expect.arrayContaining(['IdeaCreated', 'BoardTaskCreated', 'IdeaStatusChanged']),
    )
    const created = h.audit.events.find((e) => e.eventType === 'BoardTaskCreated')
    expect(meta(created)).toEqual({ parentIdeaId: 'idea-1', boardId: BOARD_B })
  })

  it('reads back as a task: the idea-only fields are null and the type is not exposed', async () => {
    const h = autoHarness()
    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })
    const task = h.added[0]
    if (!task) throw new Error('no task was created')

    const reader = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard({ autoCreateTask: true }), childBoard()],
      ideas: [task],
    })
    const detail = await reader.service.getById(task.id)

    expect(detail).toMatchObject({
      title: TITLE,
      parentIdeaId: 'idea-1',
      itemKey: 'DL-1',
      problem: null,
      impactRationale: null,
      priority: null,
      ideaTypeId: null,
      businessImpactId: null,
      proposedSolutions: [],
    })
  })

  it('does nothing extra when the lane does not auto-create', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard({ autoCreateTask: false }), childBoard()],
      ideas: [idea({ statusId: STATUS_1, effort: EffortLevel.Medium })],
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.added).toHaveLength(0)
    expect(h.saved[0]?.statusId).toBe(STATUS_2)
    expect(h.unitOfWork.saves).toBe(1)
  })

  it('creates no task when the card is dropped on the lane it already sits in', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard({ autoCreateTask: true }), childBoard()],
      ideas: [parentInReferenceLane()],
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

    expect(h.added).toHaveLength(0)
    expect(h.unitOfWork.saves).toBe(0)
  })

  it('creates no task on a move out of the lane', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard({ autoCreateTask: true }), childBoard()],
      ideas: [parentInReferenceLane()],
    })

    await h.service.changeStatus('idea-1', { statusId: STATUS_3 })

    expect(h.added).toHaveLength(0)
  })

  it('still asks for an Effort first: no task, nothing committed', async () => {
    const h = autoHarness({ ideas: [idea({ statusId: STATUS_1, effort: null })] })

    const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))

    expect(error).toMatchObject({ code: 'effortRequiredForReferenceLane' })
    expectNothingChanged(h)
  })

  it.each([
    [
      'the referenced board is archived',
      { boards: [parentBoard({ autoCreateTask: true }), childBoard({ isArchived: true })] },
      'referencedBoardArchived',
    ],
    [
      'the organization has no active idea type',
      { classification: { listIdeaTypesByOrganization: async () => [] } },
      'noDefaultIdeaType',
    ],
    [
      'the organization has no active business impact',
      { classification: { listBusinessImpactsByOrganization: async () => [] } },
      'noDefaultBusinessImpact',
    ],
  ])(
    'rolls the move back when task creation is refused because %s',
    async (_label, setup, code) => {
      const h = autoHarness(setup)

      const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))

      expect(error).toBeInstanceOf(UnprocessableError)
      expect(error).toMatchObject({ code })
      // The move was staged but never committed: no save, no task, nothing audited or notified.
      expect(h.unitOfWork.saves).toBe(0)
      expect(h.added).toHaveLength(0)
      expect(h.audit.events).toHaveLength(0)
      expect(h.notifications).toHaveLength(0)
    },
  )

  it('rolls the move back when the referenced board has no lanes to put the task in', async () => {
    const h = autoHarness({
      boards: [parentBoard({ autoCreateTask: true }), childBoard({ swimlanes: [] })],
    })

    const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))

    expect(error).toBeInstanceOf(ValidationError)
    expect(h.unitOfWork.saves).toBe(0)
    expect(h.added).toHaveLength(0)
  })

  it('moves from a locked lane into an auto-create lane only by override, and then creates the task', async () => {
    const twoRefs = board({
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
        { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
        {
          statusId: STATUS_3,
          displayOrder: 2,
          isFinal: false,
          referencesBoardId: BOARD_B,
          autoCreateTask: true,
        },
      ],
      keyPrefix: 'CI',
    })
    const refused = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [twoRefs, childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })
    expect(
      await failure(refused.service.changeStatus('idea-1', { statusId: STATUS_3 })),
    ).toMatchObject({ code: 'parentHasOpenTasks' })
    expect(refused.added).toHaveLength(0)

    const forced = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [twoRefs, childBoard()],
      ideas: [parentInReferenceLane()],
      childCounts: OPEN_2,
    })
    await forced.service.changeStatus('idea-1', { statusId: STATUS_3, forceReason: 'Re-plan' })
    expect(forced.added).toHaveLength(1)
    expect(types(forced)).toContain('IdeaMovedPastOpenTasks')
  })
})
