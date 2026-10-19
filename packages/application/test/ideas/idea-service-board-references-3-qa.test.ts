// QA for SPEC/decisions.md 2026-10-19 "Board References UI: comp U answers" on IdeaService:
//  - answer 6 (contracts/ideas.md `PUT /ideas/{id}`): an update with `effort` null while the idea
//    sits in a reference lane is `422` `effortRequiredInReferenceLane`; changing the value is
//    allowed, null is allowed anywhere else, and effort is settable in any phase;
//  - answer 5 (contracts/boards.md `autoCreateTask`): entering an auto-create lane creates the
//    task only on the first entry, i.e. when the idea has no live task on the referenced board,
//    on a status move and on the staging that pull and `ideaMoves` use;
//  - the `GET /ideas/{id}/activity` read (contracts/ideas.md): paging, scope and 404s equal to the
//    idea read, and whatever the audit port answers passed through.
// In-memory ports, fixed clock and ids. The live-database halves are in
// packages/infrastructure/test/board-references-3.integration.test.ts.

import { EffortLevel, Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import type { Page, PageRequest } from '../../src/common/index.js'
import {
  NotFoundError,
  UnauthorizedError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { IdeaActivityEntry } from '../../src/ideas/models.js'
import type { BoardContext, IdeaActivityPort } from '../../src/ideas/ports.js'
import {
  anonymous,
  impersonating,
  member,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
} from '../support/fixtures.js'
import {
  BOARD_B,
  board,
  type Harness,
  harness,
  idea,
  promotedIdea,
  STATUS_1,
  STATUS_2,
  updateFrom,
} from './idea-service-harness.js'

const STATUS_3 = 'status-3'
const TASK_LANE_1 = 'task-lane-1'
const OTHER_BOARD = 'board-other'

type Lanes = BoardContext['swimlanes']

/** Lane 1 plain, lane 2 hands work to BOARD_B (optionally creating a task), lane 3 plain. */
function parentBoard(autoCreateTask = false) {
  const swimlanes: Lanes = [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    {
      statusId: STATUS_2,
      displayOrder: 1,
      isFinal: false,
      referencesBoardId: BOARD_B,
      autoCreateTask,
    },
    { statusId: STATUS_3, displayOrder: 2, isFinal: false, referencesBoardId: null },
  ]
  return board({ swimlanes, keyPrefix: 'CI' })
}

const childBoard = () =>
  board({
    boardId: BOARD_B,
    name: 'Delivery',
    keyPrefix: 'DL',
    ideaFeaturesEnabled: false,
    swimlanes: [
      { statusId: TASK_LANE_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
      { statusId: 'task-lane-2', displayOrder: 1, isFinal: true, referencesBoardId: null },
    ],
  })

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

function expectNothingChanged(h: Harness) {
  expect(h.saved).toHaveLength(0)
  expect(h.added).toHaveLength(0)
  expect(h.unitOfWork.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
}

describe('update: Effort cannot be cleared in a reference lane', () => {
  const inLane = (statusId: string, effort: EffortLevel | null = EffortLevel.Medium) =>
    idea({ statusId, effort })

  function setup(existing = inLane(STATUS_2)) {
    return {
      existing,
      h: harness({
        currentUser: orgAdmin(ORG_A),
        boards: [parentBoard(), childBoard()],
        ideas: [existing],
      }),
    }
  }

  it('refuses effort null in a reference lane with 422 effortRequiredInReferenceLane and saves nothing', async () => {
    const { existing, h } = setup()

    const error = await failure(
      h.service.update('idea-1', { ...updateFrom(existing), effort: null }),
    )

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({
      code: 'effortRequiredInReferenceLane',
      message: 'An idea in a lane that references a board needs an Effort.',
    })
    expectNothingChanged(h)
  })

  it('refuses effort null in a reference lane even when the idea has no Effort already', async () => {
    const { existing, h } = setup(inLane(STATUS_2, null))

    const error = await failure(
      h.service.update('idea-1', { ...updateFrom(existing), effort: null }),
    )

    expect(error).toMatchObject({ code: 'effortRequiredInReferenceLane' })
    expectNothingChanged(h)
  })

  it('refuses effort null in an auto-create reference lane too', async () => {
    const existing = inLane(STATUS_2)
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(true), childBoard()],
      ideas: [existing],
    })

    const error = await failure(
      h.service.update('idea-1', { ...updateFrom(existing), effort: null }),
    )

    expect(error).toMatchObject({ code: 'effortRequiredInReferenceLane' })
  })

  it('refuses it for a Delivery-phase idea in a reference lane', async () => {
    const existing = promotedIdea({ statusId: STATUS_2 })
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [existing],
    })

    const error = await failure(
      h.service.update('idea-1', { ...updateFrom(existing), effort: null }),
    )

    expect(error).toMatchObject({ code: 'effortRequiredInReferenceLane' })
  })

  it.each([EffortLevel.Low, EffortLevel.High])(
    'allows changing the Effort to %s in a reference lane',
    async (level) => {
      const { existing, h } = setup()

      await h.service.update('idea-1', { ...updateFrom(existing), effort: level })

      expect(h.saved[0]?.effort).toBe(level)
    },
  )

  it('allows an update that leaves the Effort key out, in a reference lane', async () => {
    const { existing, h } = setup()

    await h.service.update('idea-1', { ...updateFrom(existing), title: 'Renamed' })

    expect(h.saved[0]).toMatchObject({ title: 'Renamed', effort: EffortLevel.Medium })
  })

  it('allows effort null in a lane that does not reference a board', async () => {
    const { existing, h } = setup(inLane(STATUS_1))

    await h.service.update('idea-1', { ...updateFrom(existing), effort: null })

    expect(h.saved[0]?.effort).toBeNull()
  })

  it('allows effort null on an idea that sits in no board', async () => {
    const pool = idea({ boardId: null, effort: EffortLevel.Medium })
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [pool],
    })

    await h.service.update('idea-1', { ...updateFrom(pool), effort: null })

    expect(h.saved[0]?.effort).toBeNull()
  })

  it('allows the first Effort to be set on an idea that has none, in a reference lane', async () => {
    const { existing, h } = setup(inLane(STATUS_2, null))

    await h.service.update('idea-1', { ...updateFrom(existing), effort: EffortLevel.Low })

    expect(h.saved[0]?.effort).toBe(EffortLevel.Low)
  })

  it('no longer restricts Effort to the Discovery phase: a Delivery idea can change and clear it outside a reference lane', async () => {
    const existing = promotedIdea({ statusId: STATUS_1 })
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(), childBoard()],
      ideas: [existing],
    })

    await h.service.update('idea-1', { ...updateFrom(existing), effort: EffortLevel.High })
    await h.service.update('idea-1', { ...updateFrom(existing), effort: null })

    expect(h.saved.map((s) => s.effort)).toEqual([EffortLevel.High, null])
  })

  it('answers 400 for an unknown effort value, not the reference-lane error', async () => {
    const { existing, h } = setup()

    const error = await failure(
      h.service.update('idea-1', { ...updateFrom(existing), effort: 'Huge' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expectNothingChanged(h)
  })
})

describe('auto-create is skipped when the idea already has a task on the referenced board', () => {
  const parent = () => idea({ statusId: STATUS_1, effort: EffortLevel.Medium })
  const autoHarness = (options: Partial<Parameters<typeof harness>[0]> = {}) =>
    harness({
      currentUser: orgAdmin(ORG_A),
      boards: [parentBoard(true), childBoard()],
      ideas: [parent()],
      ...options,
    })

  describe('on a status move', () => {
    it('creates no task and no task audit, but moves the card and audits the move', async () => {
      const h = autoHarness({ parentsWithTasks: ['idea-1'] })

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.added).toHaveLength(0)
      expect(h.saved[0]).toMatchObject({ id: 'idea-1', statusId: STATUS_2 })
      expect(h.unitOfWork.saves).toBe(1)
      const types = h.audit.events.map((e) => e.eventType)
      expect(types).toContain('IdeaStatusChanged')
      expect(types).not.toContain('BoardTaskCreated')
      expect(types).not.toContain('IdeaCreated')
    })

    it('asks about the idea and the board the lane references, not the idea alone', async () => {
      const h = autoHarness()

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.taskLookups).toEqual([{ parentId: 'idea-1', boardId: BOARD_B }])
    })

    it('still creates the task on the first entry, when the idea has no task yet', async () => {
      const h = autoHarness({ parentsWithTasks: [] })

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.added).toHaveLength(1)
      expect(h.added[0]).toMatchObject({
        boardId: BOARD_B,
        statusId: TASK_LANE_1,
        parentIdeaId: 'idea-1',
      })
      expect(h.audit.events.map((e) => e.eventType)).toContain('BoardTaskCreated')
    })

    it('still creates the task when the only task the idea has is on another board', async () => {
      const h = autoHarness({ tasksOnBoards: { 'idea-1': [OTHER_BOARD] } })

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.added).toHaveLength(1)
    })

    it('skips when the existing task is on the referenced board, whichever lane it sits in', async () => {
      const h = autoHarness({ tasksOnBoards: { 'idea-1': [OTHER_BOARD, BOARD_B] } })

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.added).toHaveLength(0)
    })

    it('does not ask about tasks for a lane that does not auto-create', async () => {
      const h = harness({
        currentUser: orgAdmin(ORG_A),
        boards: [parentBoard(false), childBoard()],
        ideas: [parent()],
        parentsWithTasks: ['idea-1'],
      })

      await h.service.changeStatus('idea-1', { statusId: STATUS_2 })

      expect(h.taskLookups).toEqual([])
      expect(h.added).toHaveLength(0)
    })

    it('leaves the Effort and the lock rules in force when the task is skipped', async () => {
      const h = autoHarness({
        ideas: [idea({ statusId: STATUS_1, effort: null })],
        parentsWithTasks: ['idea-1'],
      })

      const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))

      expect(error).toMatchObject({ code: 'effortRequiredForReferenceLane' })
      expectNothingChanged(h)
    })

    it('still rolls the move back when creating the first task is refused', async () => {
      const h = autoHarness({
        boards: [parentBoard(true), { ...childBoard(), isArchived: true }],
      })

      const error = await failure(h.service.changeStatus('idea-1', { statusId: STATUS_2 }))

      expect(error).toMatchObject({ code: 'referencedBoardArchived' })
      expect(h.unitOfWork.saves).toBe(0)
      expect(h.added).toHaveLength(0)
      expect(h.audit.events).toHaveLength(0)
    })
  })

  describe('on the staging that a pull and ideaMoves use', () => {
    const parentArg = () => ({
      id: 'idea-1',
      organizationId: ORG_A,
      title: 'Reduce onboarding friction',
      parentIdeaId: null,
    })

    it('stages nothing and returns a finisher that does nothing when a task exists', async () => {
      const h = autoHarness({ parentsWithTasks: ['idea-1'] })

      const finish = await h.service.stageAutoCreatedTask(parentArg(), BOARD_B)
      await finish()

      expect(h.added).toHaveLength(0)
      expect(h.unitOfWork.saves).toBe(0)
      expect(h.audit.events).toHaveLength(0)
      expect(h.taskLookups).toEqual([{ parentId: 'idea-1', boardId: BOARD_B }])
    })

    it('stages the one task on a first entry, and its finisher audits it', async () => {
      const h = autoHarness()

      const finish = await h.service.stageAutoCreatedTask(parentArg(), BOARD_B)

      expect(h.added).toHaveLength(1)
      expect(h.added[0]).toMatchObject({
        title: 'Reduce onboarding friction',
        boardId: BOARD_B,
        statusId: TASK_LANE_1,
        parentIdeaId: 'idea-1',
      })
      expect(h.unitOfWork.saves).toBe(0)
      await finish()
      expect(h.audit.events.map((e) => e.eventType)).toContain('BoardTaskCreated')
    })

    it('stages a task when the only existing task is on a different board', async () => {
      const h = autoHarness({ tasksOnBoards: { 'idea-1': [OTHER_BOARD] } })

      await h.service.stageAutoCreatedTask(parentArg(), BOARD_B)

      expect(h.added).toHaveLength(1)
    })

    it('still refuses a first entry whose task the referenced board refuses', async () => {
      const h = autoHarness({
        boards: [parentBoard(true), { ...childBoard(), isArchived: true }],
      })

      const error = await failure(h.service.stageAutoCreatedTask(parentArg(), BOARD_B))

      expect(error).toMatchObject({ code: 'referencedBoardArchived' })
      expect(h.added).toHaveLength(0)
    })
  })
})

describe('listActivity', () => {
  const entry = (n: number): IdeaActivityEntry => ({
    eventType: 'IdeaStatusChanged',
    message: `Event ${n}`,
    occurredAtUtc: new Date(Date.UTC(2026, 9, 19, 12, 0, n)),
    actorUserId: 'actor-1',
    onBehalfOfUserId: null,
    metadata: null,
  })

  function setup(
    currentUser = member(ORG_A),
    ideas = [idea()],
    entries: readonly IdeaActivityEntry[] = [entry(2), entry(1)],
  ) {
    const asked: { ideaId: string; request: PageRequest }[] = []
    const activity: IdeaActivityPort = {
      async listForIdea(ideaId, request): Promise<Page<IdeaActivityEntry>> {
        asked.push({ ideaId, request })
        return { items: entries, page: request.page, pageSize: request.pageSize, totalCount: 42 }
      },
    }
    return { h: harness({ currentUser, ideas, activity }), asked }
  }
  const none = { page: null, pageSize: null }

  it('answers what the port answers: the entries in its order and its total', async () => {
    const { h, asked } = setup()

    const page = await h.service.listActivity('idea-1', none)

    expect(page.items.map((i) => i.message)).toEqual(['Event 2', 'Event 1'])
    expect(page.totalCount).toBe(42)
    expect(asked.map((a) => a.ideaId)).toEqual(['idea-1'])
  })

  it('defaults to the first page of 20', async () => {
    const { h, asked } = setup()

    const page = await h.service.listActivity('idea-1', none)

    expect(asked[0]?.request).toEqual({ page: 1, pageSize: 20 })
    expect(page).toMatchObject({ page: 1, pageSize: 20 })
  })

  it('passes the requested page and size through', async () => {
    const { h, asked } = setup()

    await h.service.listActivity('idea-1', { page: 3, pageSize: 5 })

    expect(asked[0]?.request).toEqual({ page: 3, pageSize: 5 })
  })

  it.each([
    [
      { page: 0, pageSize: 0 },
      { page: 1, pageSize: 1 },
    ],
    [
      { page: -4, pageSize: -1 },
      { page: 1, pageSize: 1 },
    ],
    [
      { page: 2, pageSize: 100 },
      { page: 2, pageSize: 100 },
    ],
    [
      { page: 2, pageSize: 101 },
      { page: 2, pageSize: 100 },
    ],
    [
      { page: 1, pageSize: 100000 },
      { page: 1, pageSize: 100 },
    ],
  ])('clamps %j to %j', async (query, expected) => {
    const { h, asked } = setup()

    await h.service.listActivity('idea-1', query)

    expect(asked[0]?.request).toEqual(expected)
  })

  it('answers an empty page, not an error, for a host with no audit reader', async () => {
    const h = harness({ currentUser: member(ORG_A), ideas: [idea()] })

    const page = await h.service.listActivity('idea-1', { page: 2, pageSize: 5 })

    expect(page).toEqual({ items: [], page: 2, pageSize: 5, totalCount: 0 })
  })

  describe('scope and 404s, equal to the idea read', () => {
    const ideas = [
      idea(),
      idea({ id: 'deleted', isDeleted: true }),
      idea({ id: 'beta', organizationId: ORG_B, boardId: null }),
    ]

    it.each([
      ['an Org Admin', orgAdmin(ORG_A)],
      ['a User', member(ORG_A)],
      ['a Read Only user', readOnly(ORG_A)],
      ['a Site Admin', siteAdmin()],
      [
        'a Site Admin viewing as a User of the idea organization',
        impersonating({
          targetUserId: 'user-1',
          targetRole: Role.User,
          targetOrganizationId: ORG_A,
        }),
      ],
    ])('lets %s read an idea they can read', async (_label, user) => {
      const { h } = setup(user, ideas)

      await expect(h.service.getById('idea-1')).resolves.toBeDefined()
      await expect(h.service.listActivity('idea-1', none)).resolves.toMatchObject({
        totalCount: 42,
      })
    })

    it.each([
      ['an Org Admin', orgAdmin(ORG_A)],
      ['a User', member(ORG_A)],
      ['a Read Only user', readOnly(ORG_A)],
    ])(
      'answers %s 404 for an idea of another organization, and never asks the port',
      async (_label, user) => {
        const { h, asked } = setup(user, ideas)

        expect(await failure(h.service.listActivity('beta', none))).toBeInstanceOf(NotFoundError)
        expect(await failure(h.service.getById('beta'))).toBeInstanceOf(NotFoundError)
        expect(asked).toHaveLength(0)
      },
    )

    it('answers 404 for a missing idea and never asks the port', async () => {
      const { h, asked } = setup(orgAdmin(ORG_A), ideas)

      const error = await failure(h.service.listActivity('nope', none))

      expect(error).toBeInstanceOf(NotFoundError)
      expect(error).toMatchObject({ message: 'Idea not found.' })
      expect(asked).toHaveLength(0)
    })

    it('answers 404 for a soft-deleted idea, as the idea read does', async () => {
      const { h, asked } = setup(orgAdmin(ORG_A), ideas)

      expect(await failure(h.service.listActivity('deleted', none))).toBeInstanceOf(NotFoundError)
      expect(await failure(h.service.getById('deleted'))).toBeInstanceOf(NotFoundError)
      expect(asked).toHaveLength(0)
    })

    it('answers an unauthenticated caller 401 before it looks the idea up', async () => {
      const { h, asked } = setup(anonymous, ideas)

      expect(await failure(h.service.listActivity('idea-1', none))).toBeInstanceOf(
        UnauthorizedError,
      )
      expect(await failure(h.service.listActivity('nope', none))).toBeInstanceOf(UnauthorizedError)
      expect(asked).toHaveLength(0)
    })
  })

  it('passes a metadata object through untouched, as the IdeaMovedPastOpenTasks entry carries it', async () => {
    const moved: IdeaActivityEntry = {
      ...entry(3),
      eventType: 'IdeaMovedPastOpenTasks',
      metadata: { reason: 'Customer escalation', openTaskCount: 3 },
    }
    const { h } = setup(orgAdmin(ORG_A), [idea()], [moved])

    const page = await h.service.listActivity('idea-1', none)

    expect(page.items[0]).toEqual(moved)
  })
})
