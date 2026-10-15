// QA for board tasks (SPEC/contracts/ideas.md "Tasks and item keys"): who may add a task, the
// late-addition rule, the guard order, taskCounts scope, the delete guard and the idea-features-off
// hiding.

import { Role } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ForbiddenError, NotFoundError, type UnprocessableError } from '../../src/common/index.js'
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
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const STATUS_3 = 'status-3'
const TASK_LANE = 'task-lane-1'

const PARENT_BOARD = board({
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
    { statusId: STATUS_3, displayOrder: 2, isFinal: false, referencesBoardId: null },
  ],
})
const CHILD_BOARD = board({
  boardId: BOARD_B,
  name: 'Delivery',
  keyPrefix: 'DL',
  swimlanes: [{ statusId: TASK_LANE, displayOrder: 0, isFinal: false, referencesBoardId: null }],
})
const BOARDS = [PARENT_BOARD, CHILD_BOARD]
const BODY = { ...CREATE, ideaTypeId: '', businessImpactId: '' }

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('createBoardTask: who may add a task', () => {
  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    [
      'a User seen through View As',
      impersonating({ targetUserId: 'user-1', targetRole: Role.User, targetOrganizationId: ORG_A }),
    ],
  ])('lets %s add a task', async (_label, currentUser) => {
    const h = harness({ currentUser, boards: BOARDS, ideas: [idea({ statusId: STATUS_2 })] })

    const task = await h.service.createBoardTask('idea-1', BODY)

    expect(task.parentIdeaId).toBe('idea-1')
    expect(h.added).toHaveLength(1)
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
  ])('refuses %s with Forbidden and creates nothing', async (_label, currentUser) => {
    const h = harness({ currentUser, boards: BOARDS, ideas: [idea({ statusId: STATUS_2 })] })

    const error = await failure(h.service.createBoardTask('idea-1', BODY))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(h.added).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('answers 404 for a missing parent and for a parent in another organization', async () => {
    const foreign = idea({ id: 'idea-b', organizationId: ORG_B, statusId: STATUS_2 })
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS, ideas: [foreign] })

    expect(await failure(h.service.createBoardTask('nope', BODY))).toBeInstanceOf(NotFoundError)
    expect(await failure(h.service.createBoardTask('idea-b', BODY))).toBeInstanceOf(NotFoundError)
    expect(h.added).toHaveLength(0)
  })
})

describe('createBoardTask: late additions', () => {
  it('refuses a parent already moved past the reference lane, and works once it is moved back', async () => {
    const past = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_3 })],
    })
    const error = await failure(past.service.createBoardTask('idea-1', BODY))
    expect((error as UnprocessableError).code).toBe('parentNotInReferenceLane')
    expect(past.added).toHaveLength(0)

    const movedBack = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })
    const task = await movedBack.service.createBoardTask('idea-1', BODY)
    expect(task.boardId).toBe(BOARD_B)
  })

  it('refuses a parent with no board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ boardId: null, statusId: STATUS_2 })],
    })

    const error = await failure(h.service.createBoardTask('idea-1', BODY))

    expect((error as UnprocessableError).code).toBe('parentNotInReferenceLane')
  })
})

describe('createBoardTask: missing defaults', () => {
  it('refuses with noDefaultIdeaType when the organization has no active type', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      classification: { listIdeaTypesByOrganization: async () => [] },
    })

    const error = await failure(h.service.createBoardTask('idea-1', BODY))

    expect((error as UnprocessableError).code).toBe('noDefaultIdeaType')
    expect(h.added).toHaveLength(0)
  })

  it('refuses with noDefaultBusinessImpact when the organization has no active impact', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      classification: { listBusinessImpactsByOrganization: async () => [] },
    })

    const error = await failure(h.service.createBoardTask('idea-1', BODY))

    expect((error as UnprocessableError).code).toBe('noDefaultBusinessImpact')
    expect(h.added).toHaveLength(0)
  })

  it('asks for active options only', async () => {
    const asked: boolean[] = []
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      classification: {
        listIdeaTypesByOrganization: async (_org, includeDeleted) => {
          asked.push(includeDeleted)
          return [
            {
              id: 'type-a',
              organizationId: ORG_A,
              name: 'x',
              colorHex: null,
              icon: null,
              isDeleted: false,
            },
          ]
        },
      },
    })

    await h.service.createBoardTask('idea-1', BODY)

    expect(asked).toEqual([false])
  })
})

describe('createBoardTask: audit', () => {
  it('writes BoardTaskCreated against the new task with the parent and board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const task = await h.service.createBoardTask('idea-1', BODY)

    const event = h.audit.events.find((e) => e.eventType === 'BoardTaskCreated')
    expect(event).toMatchObject({
      entityType: 'Idea',
      entityId: task.ideaId,
      organizationId: ORG_A,
      attribution: { actorUserId: 'org-admin-1', onBehalfOfUserId: null },
    })
    expect(JSON.parse(event?.metadataJson ?? 'null')).toEqual({
      parentIdeaId: 'idea-1',
      boardId: BOARD_B,
    })
  })

  it('attributes a task added during View As to the administrator, on behalf of the target', async () => {
    const h = harness({
      currentUser: impersonating({
        targetUserId: 'user-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    await h.service.createBoardTask('idea-1', BODY)

    const event = h.audit.events.find((e) => e.eventType === 'BoardTaskCreated')
    expect(event?.attribution).toMatchObject({
      actorUserId: 'site-admin-1',
      onBehalfOfUserId: 'user-1',
    })
  })

  it('writes no BoardTaskCreated when the create is refused', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_1 })],
    })

    await failure(h.service.createBoardTask('idea-1', BODY))

    expect(h.audit.events.map((e) => e.eventType)).not.toContain('BoardTaskCreated')
  })
})

describe('taskCounts', () => {
  it('is set only on an item whose lane references a board, and zero without children', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [
        idea({ id: 'with-kids', statusId: STATUS_2 }),
        idea({ id: 'no-kids', statusId: STATUS_2 }),
        idea({ id: 'plain', statusId: STATUS_1 }),
        idea({ id: 'past', statusId: STATUS_3 }),
      ],
      childCounts: {
        'with-kids': { total: 4, done: 3 },
        plain: { total: 9, done: 9 },
        past: { total: 2, done: 1 },
      },
    })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)
    const countsOf = (id: string) => page.items.find((i) => i.ideaId === id)?.taskCounts

    expect(countsOf('with-kids')).toEqual({ total: 4, done: 3 })
    expect(countsOf('no-kids')).toEqual({ total: 0, done: 0 })
    expect(countsOf('plain')).toBeNull()
    expect(countsOf('past')).toBeNull()
  })
})

describe('delete guard', () => {
  it('lets an idea go when the repository reports zero live children', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      childCounts: { 'idea-1': { total: 0, done: 0 } },
    })

    await h.service.delete('idea-1')

    expect(h.saved[0]?.isDeleted).toBe(true)
  })

  it('refuses at one live child, whether or not it is done', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      childCounts: { 'idea-1': { total: 1, done: 1 } },
    })

    const error = await failure(h.service.delete('idea-1'))

    expect((error as UnprocessableError).code).toBe('hasOpenTasks')
    expect(h.saved).toHaveLength(0)
  })
})

describe('idea features off', () => {
  const OFF_BOARD = board({ ideaFeaturesEnabled: false })

  it('hides type, impact, field values and upvotes on a detail read, and shows them with the flag on', async () => {
    const off = harness({ currentUser: orgAdmin(), boards: [OFF_BOARD], ideas: [idea()] })
    const on = harness({ currentUser: orgAdmin(), boards: [board()], ideas: [idea()] })

    const hidden = await off.service.getById('idea-1')
    const shown = await on.service.getById('idea-1')

    expect(hidden).toMatchObject({
      ideaTypeId: null,
      ideaTypeName: null,
      ideaTypeColorHex: null,
      ideaTypeIcon: null,
      businessImpactId: null,
      fieldValues: [],
      formFields: [],
      upvoteCount: 0,
      hasUpvoted: false,
    })
    expect(shown.ideaTypeId).toBe('type-a')
    expect(shown.businessImpactId).toBe('impact-a')
    expect(shown.upvoteCount).toBe(7)
  })

  it('hides them on list items too', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [OFF_BOARD], ideas: [idea()] })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)

    expect(page.items[0]).toMatchObject({
      ideaTypeId: null,
      ideaTypeName: null,
      businessImpactId: null,
      upvoteCount: 0,
      hasUpvoted: false,
    })
  })

  it('keeps the create result of a task free of its stored default type', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const task = await h.service.createBoardTask('idea-1', BODY)

    expect(task.ideaTypeId).toBeNull()
    expect(task.businessImpactId).toBeNull()
    expect(h.added[0]?.ideaTypeId).toBe('type-a')
  })
})
