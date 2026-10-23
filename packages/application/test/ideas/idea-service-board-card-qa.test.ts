// QA for `POST /boards/{boardId}/tasks` (SPEC/contracts/ideas.md "Tasks and item keys", TB-2):
// the standalone card, the parented path being exactly `board-tasks`, the work-board rule, roles,
// the admin-only sprint, and the audit event on both create paths. Plus the service's hand-off of
// `sprintId` / `hideFinal` on the board and organization lists (TB-1, TB-8).

import { Role, SprintState } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { CreateBoardCardCommand } from '../../src/ideas/index.js'
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
  ORG_LIST_QUERY,
  STATUS_1,
  STATUS_2,
} from './idea-service-harness.js'

const LEFT_LANE = 'work-lane-1'
const RIGHT_LANE = 'work-lane-2'

// The planning board: its STATUS_2 lane references the work board.
const PLANNING = board({
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
  ],
})
// Lanes deliberately listed right-to-left: the card must still land in the leftmost by displayOrder.
const WORK = board({
  boardId: BOARD_B,
  name: 'Delivery',
  keyPrefix: 'DL',
  swimlanes: [
    { statusId: RIGHT_LANE, displayOrder: 1, isFinal: true, referencesBoardId: null },
    { statusId: LEFT_LANE, displayOrder: 0, isFinal: false, referencesBoardId: null },
  ],
})
const OTHER_WORK = board({
  boardId: 'board-c',
  name: 'Other work',
  swimlanes: [{ statusId: 'c-lane', displayOrder: 0, isFinal: false, referencesBoardId: null }],
})
const BOARDS = [PLANNING, WORK]

const CARD: CreateBoardCardCommand = {
  title: 'Wire the form',
  description: 'Details',
  assigneeUserIds: null,
  tagNames: null,
  parentIdeaId: null,
  sprintId: null,
}
/** The same four fields `board-tasks` takes. */
const TASK_FIELDS = {
  title: CARD.title,
  description: CARD.description,
  assigneeUserIds: null,
  tagNames: null,
}

function sprintOf(boardId: string, state: SprintState = SprintState.Planned, id = 'sprint-1') {
  return {
    id,
    organizationId: ORG_A,
    name: 'Sprint',
    startDate: '2026-09-21',
    endDate: '2026-10-04',
    state,
    isDeleted: false,
    boardId,
  }
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

describe('createTaskOnBoard: a standalone card', () => {
  it('creates a card in the leftmost lane of the work board with no parent', async () => {
    const h = harness({ currentUser: member(), boards: BOARDS })

    const result = await h.service.createTaskOnBoard(BOARD_B, CARD)

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({
      organizationId: ORG_A,
      boardId: BOARD_B,
      statusId: LEFT_LANE,
      parentIdeaId: null,
      title: 'Wire the form',
      sprintId: null,
      effort: null,
    })
    expect(result).toMatchObject({ boardId: BOARD_B, parentIdeaId: null })
  })

  it('answers as a task is answered, without the stand-in priority, type and impact', async () => {
    const h = harness({ currentUser: member(), boards: BOARDS })

    const result = await h.service.createTaskOnBoard(BOARD_B, CARD)

    expect(result).toMatchObject({ priority: null, ideaTypeId: null, businessImpactId: null })
  })

  it('stores the same stand-in shape as a parented task', async () => {
    const standalone = harness({ currentUser: member(), boards: BOARDS })
    await standalone.service.createTaskOnBoard(BOARD_B, CARD)
    const parented = harness({
      currentUser: member(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })
    await parented.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' })

    const pick = (i: (typeof standalone.added)[number] | undefined) => ({
      ideaTypeId: i?.ideaTypeId,
      businessImpactId: i?.businessImpactId,
      priority: i?.priority,
      problem: i?.problem,
      proposedSolutions: i?.proposedSolutions,
      impactRationale: i?.impactRationale,
      dueDate: i?.dueDate,
    })
    expect(pick(standalone.added[0])).toEqual(pick(parented.added[0]))
    expect(pick(standalone.added[0]).ideaTypeId).toBeTruthy()
  })

  it('numbers the card from the work board and gives the board its item key', async () => {
    const h = harness({ currentUser: member(), boards: BOARDS })

    const first = await h.service.createTaskOnBoard(BOARD_B, CARD)
    const second = await h.service.createTaskOnBoard(BOARD_B, CARD)

    expect(first.itemKey).toBe('DL-1')
    expect(second.itemKey).toBe('DL-2')
  })

  it('takes the fields the task rules allow: assignees and tags', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      users: [
        {
          id: 'u-2',
          firstName: 'Bo',
          lastName: 'Two',
          email: 'bo@acme.test',
          role: Role.User,
          status: 'Active' as never,
          organizationId: ORG_A,
          portraitPng: null,
        },
      ],
    })

    await h.service.createTaskOnBoard(BOARD_B, {
      ...CARD,
      assigneeUserIds: ['u-2'],
      tagNames: ['Urgent'],
    })

    expect(h.added[0]?.assigneeUserIds).toEqual(['u-2'])
    expect(h.createdTags.map((t) => t.name)).toEqual(['Urgent'])
  })

  it('refuses with referencedBoardArchived when the work board is archived', async () => {
    const archived = board({ ...WORK, isArchived: true })
    // An archived board does not count as referenced by the planning board's lane either, but the
    // referencing board here is live; the archived flag on the target is what is asserted.
    const h = harness({ currentUser: member(), boards: [PLANNING, archived] })

    const error = await failure(h.service.createTaskOnBoard(BOARD_B, CARD))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(h.added).toHaveLength(0)
  })

  it('refuses a work board with no swimlanes', async () => {
    const empty = board({ boardId: BOARD_B, swimlanes: [] })
    const h = harness({
      currentUser: member(),
      boards: [PLANNING, empty],
    })

    const error = await failure(h.service.createTaskOnBoard(BOARD_B, CARD))

    expect(error).toBeInstanceOf(ValidationError)
    expect(h.added).toHaveLength(0)
  })
})

describe('createTaskOnBoard: a work board only', () => {
  it('refuses a board no lane references with 422 boardIsNotAWorkBoard and creates nothing', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: [PLANNING, WORK, OTHER_WORK] })

    const error = await failure(h.service.createTaskOnBoard('board-c', CARD))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect((error as UnprocessableError).code).toBe('boardIsNotAWorkBoard')
    expect(h.added).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('does not count a lane of an archived board as a reference', async () => {
    const archivedPlanning = board({ ...PLANNING, isArchived: true })
    const h = harness({ currentUser: orgAdmin(), boards: [archivedPlanning, WORK] })

    const error = await failure(h.service.createTaskOnBoard(BOARD_B, CARD))

    expect((error as UnprocessableError).code).toBe('boardIsNotAWorkBoard')
  })

  it('answers 404 for a missing board and for a board of another organization', async () => {
    const foreign = board({ boardId: 'board-x', organizationId: ORG_B })
    const h = harness({ currentUser: orgAdmin(), boards: [...BOARDS, foreign] })

    expect(await failure(h.service.createTaskOnBoard('nope', CARD))).toBeInstanceOf(NotFoundError)
    expect(await failure(h.service.createTaskOnBoard('board-x', CARD))).toBeInstanceOf(
      NotFoundError,
    )
    expect(h.added).toHaveLength(0)
  })
})

describe('createTaskOnBoard: who may create', () => {
  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    [
      'a User seen through View As',
      impersonating({ targetUserId: 'user-1', targetRole: Role.User, targetOrganizationId: ORG_A }),
    ],
  ])('lets %s create a standalone card', async (_label, currentUser) => {
    const h = harness({ currentUser, boards: BOARDS })

    await h.service.createTaskOnBoard(BOARD_B, CARD)

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
  ])(
    'refuses %s with 403, with or without a parent, and creates nothing',
    async (_l, currentUser) => {
      const h = harness({
        currentUser,
        boards: BOARDS,
        ideas: [idea({ statusId: STATUS_2 })],
      })

      const standalone = await failure(h.service.createTaskOnBoard(BOARD_B, CARD))
      const parented = await failure(
        h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' }),
      )

      expect(standalone).toBeInstanceOf(ForbiddenError)
      expect(parented).toBeInstanceOf(ForbiddenError)
      expect(h.added).toHaveLength(0)
      expect(h.audit.events).toHaveLength(0)
    },
  )
})

describe('createTaskOnBoard: sprintId', () => {
  it.each([
    ['an Org Admin', orgAdmin()],
    ['a User', member()],
    [
      'a User seen through View As',
      impersonating({ targetUserId: 'user-1', targetRole: Role.User, targetOrganizationId: ORG_A }),
    ],
  ])('lets %s put the card in a sprint of this board', async (_label, currentUser) => {
    const h = harness({ currentUser, boards: BOARDS, sprints: [sprintOf(BOARD_B)] })

    await h.service.createTaskOnBoard(BOARD_B, { ...CARD, sprintId: 'sprint-1' })

    expect(h.added[0]?.sprintId).toBe('sprint-1')
  })

  it('lets a User create without a sprintId, and treats a blank one as none', async () => {
    const h = harness({ currentUser: member(), boards: BOARDS })

    await h.service.createTaskOnBoard(BOARD_B, { ...CARD, sprintId: '  ' })

    expect(h.added[0]?.sprintId).toBeNull()
  })

  it('answers 400 keyed sprintId for a sprint of another board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      sprints: [sprintOf(BOARD_A)],
    })

    const error = await failure(
      h.service.createTaskOnBoard(BOARD_B, { ...CARD, sprintId: 'sprint-1' }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['sprintId'])
    expect(h.added).toHaveLength(0)
  })

  it('answers 400 keyed sprintId for a Completed sprint and for an unknown one', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      sprints: [sprintOf(BOARD_B, SprintState.Completed, 'done-sprint')],
    })

    for (const sprintId of ['done-sprint', 'no-such-sprint']) {
      const error = await failure(h.service.createTaskOnBoard(BOARD_B, { ...CARD, sprintId }))
      expect(error).toBeInstanceOf(ValidationError)
      expect(Object.keys((error as ValidationError).failures)).toEqual(['sprintId'])
    }
    expect(h.added).toHaveLength(0)
  })
})

describe('createTaskOnBoard: with a parent it is board-tasks', () => {
  it('creates the same stored task as POST /ideas/{id}/board-tasks', async () => {
    const viaBoard = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })
    const viaIdea = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const a = await viaBoard.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' })
    const b = await viaIdea.service.createBoardTask('idea-1', TASK_FIELDS)

    expect(viaBoard.added).toHaveLength(1)
    // Ids are minted per call; every other stored and returned field is equal.
    const strip = <T extends { id?: string; ideaId?: string }>(x: T) => {
      const { id: _id, ideaId: _ideaId, ...rest } = x
      return rest
    }
    expect(strip(viaBoard.added[0] as never)).toEqual(strip(viaIdea.added[0] as never))
    expect(strip(a as never)).toEqual(strip(b as never))
    expect(a).toMatchObject({ parentIdeaId: 'idea-1', boardId: BOARD_B })
    expect(viaBoard.audit.events.map((e) => e.eventType)).toEqual(
      viaIdea.audit.events.map((e) => e.eventType),
    )
  })

  it('refuses a parent whose lane references a different board with parentNotInReferenceLane', async () => {
    const referenced = board({
      boardId: 'board-c',
      swimlanes: [{ statusId: 'c-lane', displayOrder: 0, isFinal: false, referencesBoardId: null }],
    })
    const planning = board({
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
        { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
        { statusId: 'lane-c', displayOrder: 2, isFinal: false, referencesBoardId: 'board-c' },
      ],
    })
    const h2 = harness({
      currentUser: orgAdmin(),
      boards: [planning, WORK, referenced],
      ideas: [idea({ statusId: STATUS_2 })],
    })

    // The parent sits in the lane that references the work board, but the request names board-c.
    const error = await failure(
      h2.service.createTaskOnBoard('board-c', { ...CARD, parentIdeaId: 'idea-1' }),
    )

    expect((error as UnprocessableError).code).toBe('parentNotInReferenceLane')
    expect(h2.added).toHaveLength(0)
  })

  it('refuses a parent that is not in its reference lane at all', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_1 })],
    })

    const error = await failure(
      h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' }),
    )

    expect((error as UnprocessableError).code).toBe('parentNotInReferenceLane')
  })

  it('refuses a task as the parent with parentIsTask', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2, parentIdeaId: 'someone' })],
    })

    const error = await failure(
      h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' }),
    )

    expect((error as UnprocessableError).code).toBe('parentIsTask')
  })

  it('answers 404 for a missing parent and for a parent of another organization', async () => {
    const foreign = idea({ id: 'idea-b', organizationId: ORG_B, statusId: STATUS_2 })
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS, ideas: [foreign] })

    expect(
      await failure(h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'nope' })),
    ).toBeInstanceOf(NotFoundError)
    expect(
      await failure(h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-b' })),
    ).toBeInstanceOf(NotFoundError)
    expect(h.added).toHaveLength(0)
  })

  it('puts the task in the chosen sprint when an admin names one', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
      sprints: [sprintOf(BOARD_B)],
    })

    await h.service.createTaskOnBoard(BOARD_B, {
      ...CARD,
      parentIdeaId: 'idea-1',
      sprintId: 'sprint-1',
    })

    expect(h.added[0]).toMatchObject({ parentIdeaId: 'idea-1', sprintId: 'sprint-1' })
  })

  it('refuses with noDefaultIdeaType on both paths when the organization has no active type', async () => {
    const classification = { listIdeaTypesByOrganization: async () => [] }
    const standalone = harness({ currentUser: member(), boards: BOARDS, classification })
    const parented = harness({
      currentUser: member(),
      boards: BOARDS,
      classification,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const a = await failure(standalone.service.createTaskOnBoard(BOARD_B, CARD))
    const b = await failure(
      parented.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' }),
    )

    expect((a as UnprocessableError).code).toBe('noDefaultIdeaType')
    expect((b as UnprocessableError).code).toBe('noDefaultIdeaType')
    expect(standalone.added).toHaveLength(0)
    expect(parented.added).toHaveLength(0)
  })
})

describe('createTaskOnBoard: audit', () => {
  it('writes BoardTaskCreated for a standalone card with a null parent and the board', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS })

    const card = await h.service.createTaskOnBoard(BOARD_B, CARD)

    const events = h.audit.events.filter((e) => e.eventType === 'BoardTaskCreated')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      entityType: 'Idea',
      entityId: card.ideaId,
      organizationId: ORG_A,
      attribution: { actorUserId: 'org-admin-1', onBehalfOfUserId: null },
    })
    expect(JSON.parse(events[0]?.metadataJson ?? 'null')).toEqual({
      parentIdeaId: null,
      boardId: BOARD_B,
    })
  })

  it('writes BoardTaskCreated for a parented task with the parent and the board', async () => {
    const h = harness({
      currentUser: orgAdmin(),
      boards: BOARDS,
      ideas: [idea({ statusId: STATUS_2 })],
    })

    const task = await h.service.createTaskOnBoard(BOARD_B, { ...CARD, parentIdeaId: 'idea-1' })

    const events = h.audit.events.filter((e) => e.eventType === 'BoardTaskCreated')
    expect(events).toHaveLength(1)
    expect(events[0]?.entityId).toBe(task.ideaId)
    expect(JSON.parse(events[0]?.metadataJson ?? 'null')).toEqual({
      parentIdeaId: 'idea-1',
      boardId: BOARD_B,
    })
  })

  it('attributes a standalone card made during View As to the administrator', async () => {
    const h = harness({
      currentUser: impersonating({
        targetUserId: 'user-1',
        targetRole: Role.User,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
      boards: BOARDS,
    })

    await h.service.createTaskOnBoard(BOARD_B, CARD)

    expect(
      h.audit.events.find((e) => e.eventType === 'BoardTaskCreated')?.attribution,
    ).toMatchObject({
      actorUserId: 'site-admin-1',
      onBehalfOfUserId: 'user-1',
    })
  })
})

describe('list queries: sprintId and hideFinal reach the repository', () => {
  it('passes hideFinal and the sprint filter from a board list, defaulting to no filter', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS })

    await h.service.listByBoard(BOARD_B, LIST_QUERY)
    await h.service.listByBoard(BOARD_B, { ...LIST_QUERY, hideFinal: true, noSprint: true })
    await h.service.listByBoard(BOARD_B, { ...LIST_QUERY, hideFinal: true, sprintId: 'sprint-1' })

    expect(h.boardFilters[0]).toMatchObject({ hideFinal: false, noSprint: false, sprintId: null })
    expect(h.boardFilters[1]).toMatchObject({ hideFinal: true, noSprint: true, sprintId: null })
    expect(h.boardFilters[2]).toMatchObject({
      hideFinal: true,
      noSprint: false,
      sprintId: 'sprint-1',
    })
  })

  it('passes hideFinal and the sprint filter from the organization list, defaulting to none', async () => {
    const h = harness({ currentUser: orgAdmin(), boards: BOARDS })

    await h.service.listByOrganization(ORG_A, ORG_LIST_QUERY)
    await h.service.listByOrganization(ORG_A, {
      ...ORG_LIST_QUERY,
      hideFinal: true,
      noSprint: true,
      sprintId: null,
    })
    await h.service.listByOrganization(ORG_A, { ...ORG_LIST_QUERY, sprintId: 'sprint-1' })

    expect(h.orgFilters[0]).toMatchObject({ hideFinal: false, noSprint: false, sprintId: null })
    expect(h.orgFilters[1]).toMatchObject({ hideFinal: true, noSprint: true, sprintId: null })
    expect(h.orgFilters[2]).toMatchObject({
      hideFinal: false,
      noSprint: false,
      sprintId: 'sprint-1',
    })
  })

  it('composes with boardId and scope=assigned on the organization list', async () => {
    const h = harness({ currentUser: member(), boards: BOARDS })

    await h.service.listByOrganization(ORG_A, {
      ...ORG_LIST_QUERY,
      scope: 'assigned',
      boardIds: [BOARD_B],
      hideFinal: true,
      noSprint: true,
    })

    expect(h.orgFilters[0]).toMatchObject({
      assignedToUserId: 'user-1',
      createdByUserId: null,
      boardIds: [BOARD_B],
      hideFinal: true,
      noSprint: true,
    })
  })
})
