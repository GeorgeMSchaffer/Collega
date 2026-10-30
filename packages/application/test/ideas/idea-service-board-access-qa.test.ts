// The BAG-4 leak matrix for the surfaces IdeaService owns (SPEC/20-feature-board-access-and-groups.md
// BAG-4; SPEC/contracts/boards.md "Board access"): the idea read and its history, edits, status
// moves, deletion, dependencies, board tasks, the Ideas list, the backlog, board CSV export and
// import, and who may be assigned or mentioned. The other services' surfaces are tested at the
// route level in apps/api/test/board-access-leak-matrix-qa.routes.test.ts, with the same fixture.
//
// Fixture: INSIDER is granted on the Restricted board, OUTSIDER is not. The Restricted board holds
// one idea, one Issue and one task; the Organization board holds one idea. The list fakes in the
// harness honour the `visibleBoardIds` filter the service hands them, so a list read leaking a
// hidden item fails here, and INSIDER reading the same list proves it filters rather than empties.
// A refusal must be the one a nonexistent id gets: same error type, same message.

import { Role } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { describe, expect, it } from 'vitest'
import type { BoardAccessLookup, VisibleBoardsLookup } from '../../src/boards/ports.js'
import {
  type CurrentUserContext,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { IdeaService } from '../../src/ideas/idea.service.js'
import { member, ORG_A, orgAdmin } from '../support/fixtures.js'
import {
  BOARD_A,
  BOARD_B,
  board,
  CREATE,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  promotedIdea,
  STATUS_1,
  STATUS_2,
  summary,
  updateFrom,
} from './idea-service-harness.js'

const OPEN_BOARD = BOARD_A
const LOCKED_BOARD = BOARD_B
const ADMIN = 'org-admin-1'
const INSIDER = 'insider-1'
const OUTSIDER = 'outsider-1'

const IDEA = 'idea-hidden'
const ISSUE = 'issue-hidden'
const TASK = 'task-hidden'
const IDEA_TITLE = 'Quietly acquire Northwind'
const ISSUE_TITLE = 'Draft the Northwind term sheet'
const TASK_TITLE = 'Northwind diligence checklist'
const OPEN_IDEA = 'idea-open'
const OPEN_TITLE = 'Shorter onboarding'
const MISSING = 'idea-missing'
const MISSING_BOARD = 'board-missing'

const HIDDEN = [IDEA, ISSUE, TASK, IDEA_TITLE, ISSUE_TITLE, TASK_TITLE] as const
const HIDDEN_ITEMS = [
  ['idea', IDEA],
  ['Issue', ISSUE],
  ['task', TASK],
] as const

/** The rule as the infrastructure lookups answer it for this fixture. */
const ACCESS: BoardAccessLookup & VisibleBoardsLookup = {
  canSeeBoard: async (boardId, _organizationId, userId) =>
    boardId !== LOCKED_BOARD || userId === INSIDER,
  visibleBoardIds: async (_organizationId, userId) =>
    userId === INSIDER ? [OPEN_BOARD, LOCKED_BOARD] : [OPEN_BOARD],
}

const USERS = [
  summary({ id: ADMIN, email: 'admin@acme.test', role: Role.OrgAdmin, firstName: 'Ada' }),
  summary({ id: INSIDER, email: 'insider@acme.test', firstName: 'Ines' }),
  summary({ id: OUTSIDER, email: 'outsider@acme.test', firstName: 'Otto' }),
]

const BOARDS = [
  board({ boardId: OPEN_BOARD, name: 'Everyone' }),
  board({ boardId: LOCKED_BOARD, name: 'Northwind deal room' }),
]

function ideas(): Idea[] {
  return [
    idea({ id: IDEA, title: IDEA_TITLE, boardId: LOCKED_BOARD, authorUserId: INSIDER }),
    promotedIdea({ id: ISSUE, title: ISSUE_TITLE, boardId: LOCKED_BOARD, authorUserId: INSIDER }),
    idea({
      id: TASK,
      title: TASK_TITLE,
      boardId: LOCKED_BOARD,
      parentIdeaId: ISSUE,
      authorUserId: INSIDER,
    }),
    idea({ id: OPEN_IDEA, title: OPEN_TITLE, boardId: OPEN_BOARD, authorUserId: OUTSIDER }),
  ]
}

const as = (userId: string): CurrentUserContext =>
  userId === ADMIN ? orgAdmin(ORG_A, ADMIN) : member(ORG_A, userId)

function world(
  currentUser: CurrentUserContext,
  overrides: Parameters<typeof harness>[0] = { currentUser },
) {
  return harness({
    boards: BOARDS,
    ideas: ideas(),
    users: USERS,
    boardAccess: ACCESS,
    activity: {
      listForIdea: async (_ideaId, page) => ({ items: [], ...page, totalCount: 0 }),
    },
    ...overrides,
    currentUser,
  })
}

function expectNoLeak(body: unknown): void {
  const serialized = JSON.stringify(body)
  for (const secret of HIDDEN) {
    expect(serialized, `the result names "${secret}"`).not.toContain(secret)
  }
}

async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  return promise.then(
    (value) => {
      throw new Error(`expected a refusal, got ${JSON.stringify(value)}`)
    },
    (error: Error) => error,
  )
}

/** BAG-4a/b: refused exactly as for `missingId`, a 404 (never a 403), and nothing written. */
async function expectAsIfMissing(
  call: (service: IdeaService, id: string) => Promise<unknown>,
  hiddenId: string,
  missingId = MISSING,
): Promise<void> {
  const hidden = world(as(OUTSIDER))
  const hiddenError = await rejectionOf(call(hidden.service, hiddenId))
  const missingError = await rejectionOf(call(world(as(OUTSIDER)).service, missingId))

  expect(hiddenError).toBeInstanceOf(NotFoundError)
  expect(hiddenError.constructor).toBe(missingError.constructor)
  expect(hiddenError.message).toBe(missingError.message)
  expectNoLeak(hiddenError.message)
  expect(hidden.saved).toEqual([])
  expect(hidden.added).toEqual([])
  expect(hidden.unitOfWork.saves).toBe(0)
  expect(hidden.audit.events).toEqual([])
}

describe('BAG-4a reads by id, IdeaService', () => {
  it.each(HIDDEN_ITEMS)(
    'the %s read is 404 for OUTSIDER, as for a missing id',
    async (_label, id) => {
      await expectAsIfMissing((service, target) => service.getById(target), id)
    },
  )

  it.each(HIDDEN_ITEMS)('the %s history is 404 for OUTSIDER', async (_label, id) => {
    await expectAsIfMissing(
      (service, target) => service.listActivity(target, { page: null, pageSize: null }),
      id,
    )
  })

  it('the Issue’s delivery card is 404 for OUTSIDER', async () => {
    await expectAsIfMissing((service, target) => service.getDelivery(target), ISSUE)
  })

  it('the Issue’s board tasks are 404 for OUTSIDER', async () => {
    await expectAsIfMissing((service, target) => service.listBoardTasks(target), ISSUE)
  })

  it('the Restricted board’s idea list and CSV export are 404 for OUTSIDER, as for a missing board', async () => {
    await expectAsIfMissing(
      (service, target) => service.listByBoard(target, LIST_QUERY),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
    await expectAsIfMissing(
      (service, target) => service.exportBoardIdeas(target),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
  })

  it('INSIDER reads every one of them', async () => {
    const { service } = world(as(INSIDER))

    for (const id of [IDEA, ISSUE, TASK]) {
      await expect(service.getById(id)).resolves.toMatchObject({ ideaId: id })
    }
    await expect(service.getDelivery(ISSUE)).resolves.toBeDefined()
    await expect(service.listBoardTasks(ISSUE)).resolves.toEqual([
      expect.objectContaining({ ideaId: TASK, title: TASK_TITLE }),
    ])
    await expect(service.listByBoard(LOCKED_BOARD, LIST_QUERY)).resolves.toBeDefined()
  })
})

describe('BAG-4b writes by id, IdeaService', () => {
  it.each(HIDDEN_ITEMS)(
    'editing the %s is 404 for OUTSIDER, and writes nothing',
    async (_label, id) => {
      const command = updateFrom(ideas().find((i) => i.id === id) as Idea)

      await expectAsIfMissing((service, target) => service.update(target, command), id)
    },
  )

  it.each(HIDDEN_ITEMS)('moving the %s to another lane is 404 for OUTSIDER', async (_label, id) => {
    await expectAsIfMissing(
      (service, target) => service.changeStatus(target, { statusId: STATUS_2 }),
      id,
    )
  })

  // Contract: every route addressing an item on B by id, read or write, is 404, never 403.
  it.each(HIDDEN_ITEMS)('deleting the %s is 404 for OUTSIDER', async (_label, id) => {
    await expectAsIfMissing((service, target) => service.delete(target), id)
  })

  it('the Issue’s delivery writes are 404 for OUTSIDER', async () => {
    await expectAsIfMissing((service, target) => service.returnToDiscovery(target), ISSUE)
    await expectAsIfMissing(
      (service, target) => service.changeDeliveryStatus(target, { deliveryStatus: 'InProgress' }),
      ISSUE,
    )
    await expectAsIfMissing(
      (service, target) => service.assignToSprint(target, { sprintId: null }),
      ISSUE,
    )
  })

  it('editing or removing the hidden task is 404 for OUTSIDER', async () => {
    const command = { title: 'Step', description: null, assigneeUserIds: null, tagNames: null }

    await expectAsIfMissing((service, target) => service.updateTask(target, command), TASK)
    await expectAsIfMissing((service, target) => service.deleteBoardTask(ISSUE, target), TASK)
    await expectAsIfMissing((service, target) => service.deleteBoardTask(target, TASK), ISSUE)
  })

  it('a card or a sprint assignment addressed to the Restricted board is 404 for OUTSIDER', async () => {
    await expectAsIfMissing(
      (service, target) =>
        service.createTaskOnBoard(target, {
          title: 'Card',
          description: null,
          assigneeUserIds: null,
          tagNames: null,
          parentIdeaId: null,
          sprintId: null,
        }),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
    await expectAsIfMissing(
      (service, target) =>
        service.assignBoardSprints(target, { ideaIds: [IDEA], sprintId: null, statusId: null }),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
  })

  it.each(HIDDEN_ITEMS)('setting the %s’s blockers is 404 for OUTSIDER', async (_label, id) => {
    await expectAsIfMissing((service, target) => service.setBlockedBy(target, []), id)
  })

  it('detaching the idea from its board, and promoting it, are 404 for OUTSIDER', async () => {
    await expectAsIfMissing((service, target) => service.detachFromBoard(target), IDEA)
    await expectAsIfMissing(
      (service, target) =>
        service.promote(target, { effort: 'Medium', sprintId: null, note: null }),
      IDEA,
    )
  })

  it('adding a task under the hidden Issue is 404 for OUTSIDER', async () => {
    await expectAsIfMissing(
      (service, target) =>
        service.createBoardTask(target, {
          title: 'Step',
          description: null,
          assigneeUserIds: null,
          tagNames: null,
        }),
      ISSUE,
    )
  })

  it('creating an idea on the Restricted board is 404 for OUTSIDER, as for a missing board', async () => {
    await expectAsIfMissing(
      (service, target) => service.create(target, CREATE),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
  })

  // 4g: the import names its board in the route, not per row (no CSV column names a board), so
  // "refused as an unknown board" is the whole import answering as for a missing board.
  it('4g: a CSV import onto the Restricted board is 404 for OUTSIDER, as for a missing board', async () => {
    const rows = [{ rowNumber: 2, cells: new Map([['title', 'From CSV']]) }]

    await expectAsIfMissing(
      (service, target) => service.importBoardIdeas(target, rows),
      LOCKED_BOARD,
      MISSING_BOARD,
    )
  })

  it('INSIDER edits and moves the same idea', async () => {
    const { service, saved } = world(as(INSIDER))
    const hidden = ideas().find((i) => i.id === IDEA) as Idea

    await service.update(IDEA, updateFrom(hidden))
    await service.changeStatus(IDEA, { statusId: STATUS_2 })

    expect(saved.map((i) => i.id)).toContain(IDEA)
  })
})

describe('BAG-4c lists, IdeaService', () => {
  it('the Ideas list leaves the hidden items out for OUTSIDER and keeps them for INSIDER', async () => {
    const outsider = world(as(OUTSIDER))
    const page = await outsider.service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expectNoLeak(page)
    expect(page.items.map((i) => i.ideaId)).toEqual([OPEN_IDEA])
    expect(page.totalCount).toBe(1)
    expect(outsider.orgFilters[0]?.visibleBoardIds).toEqual([OPEN_BOARD])

    const insider = await world(as(INSIDER)).service.listByOrganization(ORG_A, ORG_LIST_QUERY)
    expect(insider.items.map((i) => i.ideaId).sort()).toEqual([IDEA, ISSUE, OPEN_IDEA, TASK].sort())
  })

  it('a search for the hidden title finds nothing for OUTSIDER', async () => {
    const outsider = world(as(OUTSIDER))
    const page = await outsider.service.listByOrganization(ORG_A, {
      ...ORG_LIST_QUERY,
      search: 'Northwind',
    })

    expect(outsider.orgFilters[0]).toMatchObject({
      search: 'Northwind',
      visibleBoardIds: [OPEN_BOARD],
    })
    expectNoLeak(page.items.filter((i) => i.ideaId !== OPEN_IDEA))
  })

  it('the backlog leaves the hidden Issue out for OUTSIDER and keeps it for INSIDER', async () => {
    const outsider = world(as(OUTSIDER))
    const backlog = await outsider.service.listDelivery(ORG_A, {} as never)

    expectNoLeak(backlog)
    expect(outsider.deliveryFilters[0]?.visibleBoardIds).toEqual([OPEN_BOARD])
    expect(
      JSON.stringify(await world(as(INSIDER)).service.listDelivery(ORG_A, {} as never)),
    ).toContain(ISSUE_TITLE)
  })

  it('an Org Admin’s lists are not filtered at all', async () => {
    const admin = world(as(ADMIN))

    await admin.service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    expect(admin.orgFilters[0]?.visibleBoardIds).toBeNull()
  })
})

describe('BAG-4d a reference lane on a visible board, pointing at the Restricted one', () => {
  const PARENT = 'idea-parent'
  const REF_TASK = 'task-on-locked'
  const referencing = [
    board({
      boardId: OPEN_BOARD,
      name: 'Everyone',
      swimlanes: [
        { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: LOCKED_BOARD },
        { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: null },
      ],
    }),
    board({ boardId: LOCKED_BOARD, name: 'Northwind deal room' }),
  ]
  const parentAndTask = [
    idea({ id: PARENT, title: OPEN_TITLE, boardId: OPEN_BOARD, authorUserId: OUTSIDER }),
    idea({
      id: REF_TASK,
      title: TASK_TITLE,
      boardId: LOCKED_BOARD,
      parentIdeaId: PARENT,
      authorUserId: INSIDER,
    }),
  ]

  it('shows OUTSIDER none of the Restricted board’s cards under the parent, and INSIDER all of them', async () => {
    const options = (userId: string) => ({
      currentUser: as(userId),
      boards: referencing,
      ideas: parentAndTask,
    })
    const outsider = await world(as(OUTSIDER), options(OUTSIDER)).service.listBoardTasks(PARENT)
    const insider = await world(as(INSIDER), options(INSIDER)).service.listBoardTasks(PARENT)

    expect(outsider).toEqual([])
    expect(insider.map((t) => t.ideaId)).toEqual([REF_TASK])
  })
})

describe('BAG-4e dependency targets', () => {
  // A blocker on a board the caller cannot see must be refused as a nonexistent id is (404
  // `Idea not found.`), not with a 422 that says an item with that id exists elsewhere.
  it('naming a hidden item as a blocker is refused as for a missing id', async () => {
    const hidden = await rejectionOf(world(as(OUTSIDER)).service.setBlockedBy(OPEN_IDEA, [IDEA]))
    const missing = await rejectionOf(
      world(as(OUTSIDER)).service.setBlockedBy(OPEN_IDEA, [MISSING]),
    )

    expect(hidden.constructor).toBe(missing.constructor)
    expect(hidden.message).toBe(missing.message)
  })
})

describe('BAG-4h assignees and mentions on an idea on the Restricted board', () => {
  it('INSIDER assigning OUTSIDER is 400 keyed assigneeUserIds, and nothing is written', async () => {
    const insider = world(as(INSIDER))
    const hidden = ideas().find((i) => i.id === IDEA) as Idea
    const error = await rejectionOf(
      insider.service.update(IDEA, { ...updateFrom(hidden), assigneeUserIds: [OUTSIDER] }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['assigneeUserIds'])
    expect(insider.saved).toEqual([])
  })

  it('INSIDER mentioning OUTSIDER is 400 keyed mentionEmails', async () => {
    const insider = world(as(INSIDER))
    const hidden = ideas().find((i) => i.id === IDEA) as Idea
    const error = await rejectionOf(
      insider.service.update(IDEA, {
        ...updateFrom(hidden),
        mentionEmails: ['outsider@acme.test'],
      }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['mentionEmails'])
  })

  it('creating an idea on the Restricted board assigned to OUTSIDER is 400 keyed assigneeUserIds', async () => {
    const error = await rejectionOf(
      world(as(INSIDER)).service.create(LOCKED_BOARD, { ...CREATE, assigneeUserIds: [OUTSIDER] }),
    )

    expect(error).toBeInstanceOf(ValidationError)
    expect(Object.keys((error as ValidationError).failures)).toEqual(['assigneeUserIds'])
  })

  it('assigning and mentioning INSIDER, or anyone on the Organization board, is accepted', async () => {
    const insider = world(as(INSIDER))
    const hidden = ideas().find((i) => i.id === IDEA) as Idea
    await insider.service.update(IDEA, {
      ...updateFrom(hidden),
      assigneeUserIds: [INSIDER],
      mentionEmails: ['insider@acme.test', 'admin@acme.test'],
    })
    const outsider = world(as(OUTSIDER))
    const open = ideas().find((i) => i.id === OPEN_IDEA) as Idea
    await outsider.service.update(OPEN_IDEA, {
      ...updateFrom(open),
      assigneeUserIds: [INSIDER],
    })

    expect(insider.saved.map((i) => i.id)).toEqual([IDEA])
    expect(outsider.saved.map((i) => i.id)).toEqual([OPEN_IDEA])
  })

  // SPEC/contracts/boards.md "Board access": `400` keyed `assigneeUserIds`, worded
  // `'{name}' can't see this board.`.
  it('the assignee refusal is worded as the contract states', async () => {
    const hidden = ideas().find((i) => i.id === IDEA) as Idea
    const error = await rejectionOf(
      world(as(INSIDER)).service.update(IDEA, {
        ...updateFrom(hidden),
        assigneeUserIds: [OUTSIDER],
      }),
    )

    expect((error as ValidationError).failures.assigneeUserIds).toEqual([
      "'Otto Author' can't see this board.",
    ])
  })
})
