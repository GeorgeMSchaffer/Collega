// QA for editing a task and for the new task-staging entry (SPEC/decisions.md 2026-10-16 "Board
// References follow-ups" items 1, 3 and 5; contracts/ideas.md "Updating a task", detail `metrics`):
// `isTask` tells the route which body to read, `updateTask` lets the author or an Org Admin change
// the four task fields and nothing else, `stageAutoCreatedTask` stages a task without committing,
// and a direct Site Admin reads `metrics: []` in the detail. In-memory ports, fixed clock and ids.

import { EffortLevel, Priority, Role } from '@collega/domain/enums'
import { describe, expect, it, vi } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../src/common/index.js'
import type { AutoCreateTaskParent, UpdateTaskCommand } from '../../src/ideas/models.js'
import type { IdeaMetric } from '../../src/metric-types/models.js'
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
  AUTHOR,
  BOARD_A,
  BOARD_B,
  board,
  type Harness,
  harness,
  idea,
  STATUS_1,
  summary,
  TYPE_A,
} from './idea-service-harness.js'

const OTHER = 'someone-else'
const ADMIN = 'org-admin-1'
const WATCHER = 'watcher-1'
const TASK_LANE = 'task-lane-1'

const TASK_ID = 'task-1'
const PARENT_ID = 'idea-1'

/** A task as the create path stores it: placeholders for the idea-only columns, no priority read. */
function task(overrides = {}) {
  return idea({
    id: TASK_ID,
    title: 'Wire the form',
    description: 'Both screens',
    boardId: BOARD_A,
    statusId: STATUS_1,
    parentIdeaId: PARENT_ID,
    authorUserId: AUTHOR,
    ...overrides,
  })
}

const EDIT: UpdateTaskCommand = {
  title: 'Wire the form v2',
  description: 'Three screens',
  assigneeUserIds: [],
  tagNames: null,
}

const OTHER_USER = {
  id: OTHER,
  firstName: 'Olive',
  lastName: 'Other',
  email: 'olive@acme.test',
  role: Role.User,
  status: 'Active',
  organizationId: ORG_A,
  portraitPng: null,
} as never

const setup = (
  currentUser = member(ORG_A, AUTHOR),
  options: Partial<Parameters<typeof harness>[0]> = {},
) =>
  harness({
    currentUser,
    boards: [board()],
    ideas: [task()],
    followers: { [TASK_ID]: [AUTHOR, WATCHER] },
    ...options,
  })

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (error: unknown) => error,
  )
}

function expectNothingChanged(h: Harness) {
  expect(h.saved).toHaveLength(0)
  expect(h.unitOfWork.saves).toBe(0)
  expect(h.audit.events).toHaveLength(0)
  expect(h.notifications).toHaveLength(0)
}

describe('isTask: which body the update route reads', () => {
  it('is true for a task in the caller organization', async () => {
    expect(await setup().service.isTask(TASK_ID)).toBe(true)
  })

  it('is false for an ordinary idea, a missing id and a deleted task', async () => {
    const h = setup(member(ORG_A, AUTHOR), {
      ideas: [idea({ id: 'plain' }), task({ id: 'gone', isDeleted: true })],
    })

    expect(await h.service.isTask('plain')).toBe(false)
    expect(await h.service.isTask('nope')).toBe(false)
    expect(await h.service.isTask('gone')).toBe(false)
  })

  it('is false for another organization task, leaving the 404 to the idea path', async () => {
    const h = setup(member(ORG_B, 'b-user'), { ideas: [task()] })

    expect(await h.service.isTask(TASK_ID)).toBe(false)
  })

  it('is true for a direct Site Admin on any organization task', async () => {
    expect(await setup(siteAdmin()).service.isTask(TASK_ID)).toBe(true)
  })
})

describe('updateTask: who may edit', () => {
  it('lets the author change title, description and assignees, committing once', async () => {
    const h = setup(member(ORG_A, AUTHOR), { users: [OTHER_USER] })

    await h.service.updateTask(TASK_ID, { ...EDIT, assigneeUserIds: [OTHER] })

    expect(h.saved).toHaveLength(1)
    expect(h.saved[0]).toMatchObject({
      id: TASK_ID,
      title: 'Wire the form v2',
      description: 'Three screens',
      assigneeUserIds: [OTHER],
    })
    expect(h.unitOfWork.saves).toBe(1)
  })

  it('lets an Org Admin who is not the author edit it', async () => {
    const h = setup(orgAdmin(ORG_A, ADMIN))

    await h.service.updateTask(TASK_ID, EDIT)

    expect(h.saved[0]?.title).toBe('Wire the form v2')
  })

  it('refuses another User with 403 even when nothing in the body changes', async () => {
    const h = setup(member(ORG_A, OTHER))

    const error = await failure(
      h.service.updateTask(TASK_ID, {
        title: 'Wire the form',
        description: 'Both screens',
        assigneeUserIds: [],
        tagNames: null,
      }),
    )

    expect(error).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('refuses a Read Only member, even the author, with 403', async () => {
    const h = setup(readOnly(ORG_A, AUTHOR))

    expect(await failure(h.service.updateTask(TASK_ID, EDIT))).toBeInstanceOf(ForbiddenError)
    expectNothingChanged(h)
  })

  it('refuses a direct Site Admin with 403 and the View As hint, not the author-or-admin text', async () => {
    const h = setup(siteAdmin())

    const error = await failure(h.service.updateTask(TASK_ID, EDIT))

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(error).toMatchObject({ message: expect.stringContaining('Use View As') })
    expectNothingChanged(h)
  })

  it('lets a Site Admin viewing as an Org Admin edit it, auditing the administrator', async () => {
    const h = setup(
      impersonating({
        targetUserId: ADMIN,
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
        realUserId: 'site-admin-1',
      }),
    )

    await h.service.updateTask(TASK_ID, EDIT)

    expect(h.saved).toHaveLength(1)
    expect(JSON.stringify(h.audit.events.find((e) => e.eventType === 'IdeaUpdated'))).toContain(
      'site-admin-1',
    )
  })

  it('answers 404 for a task of another organization and for a missing id', async () => {
    const other = setup(orgAdmin(ORG_B, 'b-admin'))

    expect(await failure(other.service.updateTask(TASK_ID, EDIT))).toBeInstanceOf(NotFoundError)
    expect(await failure(setup().service.updateTask('nope', EDIT))).toBeInstanceOf(NotFoundError)
  })

  it('refuses with 409 on an archived board, for the Org Admin too', async () => {
    for (const user of [member(ORG_A, AUTHOR), orgAdmin(ORG_A, ADMIN)]) {
      const h = setup(user, { boards: [board({ isArchived: true })] })

      expect(await failure(h.service.updateTask(TASK_ID, EDIT))).toBeInstanceOf(ConflictError)
      expectNothingChanged(h)
    }
  })

  it('answers 409 "This item is no longer a task." when the parent was cleared since the route asked', async () => {
    const stored = task()
    const h = setup(member(ORG_A, AUTHOR), { ideas: [stored] })
    expect(await h.service.isTask(TASK_ID)).toBe(true)
    // Another request detaches the task between the route's pre-read and this write.
    ;(stored as { parentIdeaId: string | null }).parentIdeaId = null

    const error = await failure(h.service.updateTask(TASK_ID, EDIT))

    expect(error).toBeInstanceOf(ConflictError)
    expect(error).toMatchObject({ message: 'This item is no longer a task.' })
    expectNothingChanged(h)
  })
})

describe('updateTask: what changes', () => {
  it('leaves every idea-only field exactly as stored, even if a caller passes them', async () => {
    const h = setup()
    const before = task()
    const extras = {
      ...EDIT,
      problem: 'A new problem',
      proposedSolutions: ['A new solution'],
      impactRationale: 'A new rationale',
      priority: Priority.Critical,
      ideaTypeId: 'type-a2',
      businessImpactId: 'impact-a2',
      dueDate: '2031-01-01',
      effort: EffortLevel.High,
      mentionEmails: ['olive@acme.test'],
      fieldValues: [{ fieldDefinitionId: 'f1', value: 'x' }],
    } as UpdateTaskCommand

    await h.service.updateTask(TASK_ID, extras)

    expect(h.saved[0]).toMatchObject({
      problem: before.problem,
      proposedSolutions: before.proposedSolutions,
      impactRationale: before.impactRationale,
      priority: before.priority,
      ideaTypeId: TYPE_A,
      businessImpactId: before.businessImpactId,
      dueDate: before.dueDate,
      effort: before.effort,
      mentionedUserIds: [],
      fieldValues: [],
      boardId: BOARD_A,
      statusId: STATUS_1,
      parentIdeaId: PARENT_ID,
    })
    expect(h.notifications.map((n) => n.eventType)).not.toContain('Mentioned')
  })

  it('answers the task detail: idea-only fields null or empty, the new values shown', async () => {
    const h = setup()

    const detail = await h.service.updateTask(TASK_ID, EDIT)

    expect(detail).toMatchObject({
      title: 'Wire the form v2',
      description: 'Three screens',
      parentIdeaId: PARENT_ID,
      problem: null,
      impactRationale: null,
      priority: null,
      ideaTypeId: null,
      businessImpactId: null,
      proposedSolutions: [],
    })
  })

  it('creates the tags it is given and replaces the assignees as a set', async () => {
    const h = setup(member(ORG_A, AUTHOR), {
      users: [OTHER_USER],
      ideas: [task({ assigneeUserIds: [AUTHOR] })],
    })

    await h.service.updateTask(TASK_ID, {
      ...EDIT,
      assigneeUserIds: [OTHER],
      tagNames: ['Frontend'],
    })

    expect(h.createdTags.map((t) => t.name)).toEqual(['Frontend'])
    expect(h.saved[0]?.tagIds).toHaveLength(1)
    expect(h.saved[0]?.assigneeUserIds).toEqual([OTHER])
  })

  it('makes only a newly added assignee follow the task', async () => {
    const h = setup(member(ORG_A, AUTHOR), {
      users: [summary(), OTHER_USER],
      ideas: [task({ assigneeUserIds: [AUTHOR] })],
      followers: { [TASK_ID]: [] },
    })

    await h.service.updateTask(TASK_ID, { ...EDIT, assigneeUserIds: [AUTHOR, OTHER] })

    expect([...(h.followersByIdea.get(TASK_ID) ?? [])]).toEqual([OTHER])
  })

  it('refuses a blank title with a 400 keyed title and commits nothing', async () => {
    const h = setup()

    const error = await failure(h.service.updateTask(TASK_ID, { ...EDIT, title: '   ' }))

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ failures: { title: expect.any(Array) } })
    expectNothingChanged(h)
  })
})

describe('updateTask: audit and notification', () => {
  it('writes IdeaUpdated after the commit', async () => {
    const h = setup()

    await h.service.updateTask(TASK_ID, EDIT)

    const updated = h.audit.events.filter((e) => e.eventType === 'IdeaUpdated')
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({
      entityType: 'Idea',
      entityId: TASK_ID,
      message: "Idea 'Wire the form v2' updated.",
    })
  })

  it('sends IdeaEdited to each follower except the actor, and nothing else', async () => {
    const h = setup()

    await h.service.updateTask(TASK_ID, EDIT)

    expect(h.notifications.map((n) => [n.eventType, n.recipientUserId])).toEqual([
      ['IdeaEdited', WATCHER],
    ])
  })

  it('sends no notification when nothing changed, though IdeaUpdated is still written', async () => {
    const h = setup()

    await h.service.updateTask(TASK_ID, {
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [],
      tagNames: null,
    })

    expect(h.notifications).toHaveLength(0)
    expect(h.audit.events.map((e) => e.eventType)).toEqual(['IdeaUpdated'])
  })
})

describe('stageAutoCreatedTask: staged, not committed', () => {
  const PARENT: AutoCreateTaskParent = {
    id: PARENT_ID,
    organizationId: ORG_A,
    title: 'Reduce onboarding friction',
    parentIdeaId: null,
  }
  const parentBoard = board({
    swimlanes: [
      { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: BOARD_B },
    ],
  })
  const childBoard = (overrides = {}) =>
    board({
      boardId: BOARD_B,
      name: 'Delivery',
      keyPrefix: 'DL',
      ideaFeaturesEnabled: false,
      swimlanes: [
        { statusId: 'task-lane-2', displayOrder: 1, isFinal: true, referencesBoardId: null },
        { statusId: TASK_LANE, displayOrder: 0, isFinal: false, referencesBoardId: null },
      ],
      ...overrides,
    })
  const staging = (overrides: Partial<Parameters<typeof harness>[0]> = {}) =>
    harness({
      currentUser: orgAdmin(ORG_A, ADMIN),
      boards: [parentBoard, childBoard()],
      ideas: [idea()],
      ...overrides,
    })

  it('adds the task on the first lane of the referenced board with the parent title, committing nothing', async () => {
    const h = staging()

    await h.service.stageAutoCreatedTask(PARENT, BOARD_B)

    expect(h.added).toHaveLength(1)
    expect(h.added[0]).toMatchObject({
      title: 'Reduce onboarding friction',
      boardId: BOARD_B,
      statusId: TASK_LANE,
      parentIdeaId: PARENT_ID,
      description: null,
      assigneeUserIds: [],
      tagIds: [],
    })
    expect(h.unitOfWork.saves).toBe(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('writes the task audit only when the returned callback runs, after the caller commits', async () => {
    const h = staging()

    const finish = await h.service.stageAutoCreatedTask(PARENT, BOARD_B)
    expect(h.audit.events).toHaveLength(0)
    await finish()

    expect(h.audit.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(['IdeaCreated', 'BoardTaskCreated']),
    )
    expect(
      JSON.parse(
        h.audit.events.find((e) => e.eventType === 'BoardTaskCreated')?.metadataJson ?? 'null',
      ),
    ).toEqual({ parentIdeaId: PARENT_ID, boardId: BOARD_B })
    expect(h.unitOfWork.saves).toBe(0)
  })

  it.each([
    ['the parent is itself a task', { ...PARENT, parentIdeaId: 'grand' }, BOARD_B, 'parentIsTask'],
    ['no board is referenced', PARENT, null, 'parentNotInReferenceLane'],
  ])('refuses with 422 when %s, staging nothing', async (_label, parent, referenced, code) => {
    const h = staging()

    const error = await failure(h.service.stageAutoCreatedTask(parent, referenced as never))

    expect(error).toBeInstanceOf(UnprocessableError)
    expect(error).toMatchObject({ code })
    expect(h.added).toHaveLength(0)
  })

  it('refuses with 422 referencedBoardArchived when the referenced board is archived', async () => {
    const h = staging({ boards: [parentBoard, childBoard({ isArchived: true })] })

    const error = await failure(h.service.stageAutoCreatedTask(PARENT, BOARD_B))

    expect(error).toMatchObject({ code: 'referencedBoardArchived' })
    expect(h.added).toHaveLength(0)
  })

  it('refuses with 422 noDefaultIdeaType when the organization has no active idea type', async () => {
    const h = staging({ classification: { listIdeaTypesByOrganization: async () => [] } })

    const error = await failure(h.service.stageAutoCreatedTask(PARENT, BOARD_B))

    expect(error).toMatchObject({ code: 'noDefaultIdeaType' })
    expect(h.added).toHaveLength(0)
  })

  it('numbers two staged tasks in sequence on the same referenced board', async () => {
    const h = staging()

    await h.service.stageAutoCreatedTask(PARENT, BOARD_B)
    await h.service.stageAutoCreatedTask({ ...PARENT, id: 'idea-2' }, BOARD_B)

    expect(h.added.map((t) => [t.parentIdeaId, t.itemNumber])).toEqual([
      [PARENT_ID, 1],
      ['idea-2', 2],
    ])
  })
})

describe('getById: metrics for a Site Admin', () => {
  const VALUE: IdeaMetric = {
    metricTypeId: 'mt-1',
    name: 'Savings',
    unit: '$',
    isArchived: false,
    projected: 10.5,
    realized: 8,
  }

  it('answers an empty list to a direct Site Admin without reading the values', async () => {
    const listByIdea = vi.fn(async () => [VALUE])
    const h = harness({
      currentUser: siteAdmin(),
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea },
    })

    const detail = await h.service.getById('idea-1')

    expect(detail.metrics).toEqual([])
    expect(listByIdea).not.toHaveBeenCalled()
  })

  it('still answers the rest of the detail to a direct Site Admin', async () => {
    const h = harness({
      currentUser: siteAdmin(),
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea: async () => [VALUE] },
    })

    expect(await h.service.getById('idea-1')).toMatchObject({
      ideaId: 'idea-1',
      title: 'Reduce onboarding friction',
    })
  })

  it('shows the values to a Site Admin viewing as an Org Admin', async () => {
    const h = harness({
      currentUser: impersonating({
        targetUserId: ADMIN,
        targetRole: Role.OrgAdmin,
        targetOrganizationId: ORG_A,
      }),
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea: async () => [VALUE] },
    })

    expect((await h.service.getById('idea-1')).metrics).toEqual([VALUE])
  })

  it.each([
    ['an Org Admin', orgAdmin(ORG_A, ADMIN)],
    ['a User', member(ORG_A, AUTHOR)],
    ['a Read Only member', readOnly(ORG_A, AUTHOR)],
  ])('still shows the values to %s', async (_label, user) => {
    const h = harness({
      currentUser: user,
      boards: [board()],
      ideas: [idea()],
      metricValues: { listByIdea: async () => [VALUE] },
    })

    expect((await h.service.getById('idea-1')).metrics).toEqual([VALUE])
  })
})
