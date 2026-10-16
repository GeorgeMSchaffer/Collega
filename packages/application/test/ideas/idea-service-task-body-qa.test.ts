// QA for the board-task body (SPEC/decisions.md 2026-10-16 "Metric types are an organization
// table...", its board-task bullet; contracts/ideas.md "Tasks and item keys"): a task is created
// from title, description, assignees and tags only, and its idea-only fields read as null (or [])
// in every projection. The priority filter, search and sort are SQL and live in
// packages/infrastructure/test/task-body-reads.integration.test.ts.

import { Priority } from '@collega/domain/enums'
import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../src/common/index.js'
import type { CreateBoardTaskCommand } from '../../src/ideas/models.js'
import { member, ORG_A, orgAdmin } from '../support/fixtures.js'
import {
  AUTHOR,
  BOARD_A,
  BOARD_B,
  board,
  type Harness,
  harness,
  idea,
  LIST_QUERY,
  ORG_LIST_QUERY,
  STATUS_1,
  STATUS_2,
  TYPE_A2,
} from './idea-service-harness.js'

const TASK_LANE = 'task-lane-1'

const PARENT_BOARD = board({
  swimlanes: [
    { statusId: STATUS_1, displayOrder: 0, isFinal: false, referencesBoardId: null },
    { statusId: STATUS_2, displayOrder: 1, isFinal: false, referencesBoardId: BOARD_B },
  ],
})
const CHILD_BOARD = board({
  boardId: BOARD_B,
  name: 'Delivery',
  keyPrefix: 'DL',
  swimlanes: [{ statusId: TASK_LANE, displayOrder: 0, isFinal: false, referencesBoardId: null }],
})

const BODY: CreateBoardTaskCommand = {
  title: 'Wire the form',
  description: null,
  assigneeUserIds: null,
  tagNames: null,
}

function creating() {
  return harness({
    currentUser: orgAdmin(ORG_A),
    boards: [PARENT_BOARD, CHILD_BOARD],
    ideas: [idea({ statusId: STATUS_2 })],
  })
}

const meta = (h: Harness, eventType: string) =>
  JSON.parse(
    h.audit.events.find((e) => e.eventType === eventType)?.metadataJson ?? 'null',
  ) as Record<string, unknown> | null

describe('createBoardTask: what the body takes', () => {
  it('stores the title, description, assignees and tags it was given', async () => {
    const h = creating()

    await h.service.createBoardTask('idea-1', {
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [AUTHOR],
      tagNames: ['Frontend'],
    })

    const task = h.added[0]
    expect(task).toMatchObject({
      title: 'Wire the form',
      description: 'Both screens',
      assigneeUserIds: [AUTHOR],
      parentIdeaId: 'idea-1',
    })
    expect(task?.tagIds).toHaveLength(1)
    expect(h.createdTags.map((t) => t.name)).toEqual(['Frontend'])
  })

  it('makes the author and the assignees follow the task', async () => {
    const h = creating()

    const task = await h.service.createBoardTask('idea-1', { ...BODY, assigneeUserIds: [AUTHOR] })

    expect(h.followersByIdea.get(task.ideaId)?.has(AUTHOR)).toBe(true)
  })

  it('ignores the idea-only fields if a caller sends them anyway', async () => {
    const h = creating()
    const extras = {
      ...BODY,
      problem: 'A problem',
      proposedSolutions: ['A solution'],
      impactRationale: 'A rationale',
      priority: Priority.Critical,
      dueDate: '2030-01-01',
      mentionEmails: ['someone@acme.test'],
      ideaTypeId: TYPE_A2,
      businessImpactId: 'impact-a2',
      fieldValues: [{ fieldDefinitionId: 'f1', value: 'x' }],
      statusId: STATUS_1,
    }

    const result = await h.service.createBoardTask('idea-1', extras as CreateBoardTaskCommand)

    const task = h.added[0]
    // The stored default type and impact (the organization's first active ones), not the ones sent.
    expect(task).toMatchObject({
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
      dueDate: null,
      mentionedUserIds: [],
      fieldValues: [],
      statusId: TASK_LANE,
    })
    expect(task?.priority).not.toBe(Priority.Critical)
    expect(result).toMatchObject({ priority: null, ideaTypeId: null, businessImpactId: null })
    expect(h.notifications).toHaveLength(0)
  })

  it.each([
    ['empty', ''],
    ['spaces only', '   '],
  ])('refuses a title that is %s with a 400 keyed title, adding nothing', async (_label, title) => {
    const h = creating()

    const error = await h.service.createBoardTask('idea-1', { ...BODY, title }).catch((e) => e)

    expect(error).toBeInstanceOf(ValidationError)
    expect(error).toMatchObject({ failures: { title: expect.any(Array) } })
    expect(h.added).toHaveLength(0)
    expect(h.audit.events).toHaveLength(0)
  })

  it('answers with null priority, type and impact, and the parent link', async () => {
    const h = creating()

    const result = await h.service.createBoardTask('idea-1', BODY)

    expect(result).toMatchObject({
      title: 'Wire the form',
      boardId: BOARD_B,
      itemKey: 'DL-1',
      parentIdeaId: 'idea-1',
      statusId: TASK_LANE,
      priority: null,
      ideaTypeId: null,
      businessImpactId: null,
    })
  })
})

describe('IdeaCreated audit for a task', () => {
  it('records a null priority for a task', async () => {
    const h = creating()

    await h.service.createBoardTask('idea-1', BODY)

    expect(meta(h, 'IdeaCreated')).toMatchObject({ title: 'Wire the form', priority: null })
  })

  it('still records the priority of an ordinary idea', async () => {
    const h = harness({ currentUser: member(ORG_A, AUTHOR) })

    await h.service.create(BOARD_A, {
      title: 'A new idea',
      description: null,
      problem: 'p',
      proposedSolutions: ['s'],
      impactRationale: 'r',
      priority: Priority.High,
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
      dueDate: null,
      assigneeUserIds: null,
      statusId: null,
      tagNames: null,
      mentionEmails: null,
      fieldValues: null,
    })

    expect(meta(h, 'IdeaCreated')).toMatchObject({ priority: Priority.High })
  })
})

describe('task reads', () => {
  const task = () =>
    idea({
      id: 'task-1',
      title: 'Wire the form',
      boardId: BOARD_A,
      statusId: STATUS_1,
      parentIdeaId: 'idea-0',
      priority: Priority.Medium,
    })
  const plain = () => idea({ id: 'idea-2', priority: Priority.High })

  it('lists a task with null priority, type and impact, and leaves its siblings untouched', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [task(), plain()] })

    const page = await h.service.listByBoard(BOARD_A, LIST_QUERY)

    const byId = new Map(page.items.map((item) => [item.ideaId, item]))
    expect(byId.get('task-1')).toMatchObject({
      parentIdeaId: 'idea-0',
      priority: null,
      ideaTypeId: null,
      ideaTypeName: null,
      businessImpactId: null,
      businessImpactName: null,
    })
    expect(byId.get('idea-2')).toMatchObject({
      priority: 'High',
      ideaTypeId: 'type-a',
      businessImpactId: 'impact-a',
    })
  })

  it('lists a task with a null priority on the organization list too', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [task(), plain()] })

    const page = await h.service.listByOrganization(ORG_A, ORG_LIST_QUERY)

    const byId = new Map(page.items.map((item) => [item.ideaId, item]))
    expect(byId.get('task-1')?.priority).toBeNull()
    expect(byId.get('idea-2')?.priority).toBe('High')
  })

  it('reads a task in full with null problem, rationale, priority, type and impact and no solutions', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [task()] })

    const detail = await h.service.getById('task-1')

    expect(detail).toMatchObject({
      problem: null,
      impactRationale: null,
      priority: null,
      ideaTypeId: null,
      businessImpactId: null,
      proposedSolutions: [],
    })
  })

  it('keeps title, description and tags on a task read', async () => {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [{ ...task(), description: 'Both screens' }],
    })

    const detail = await h.service.getById('task-1')

    expect(detail).toMatchObject({ title: 'Wire the form', description: 'Both screens' })
  })

  it('reads an ordinary idea with all of its structured fields', async () => {
    const h = harness({ currentUser: orgAdmin(ORG_A), ideas: [plain()] })

    const detail = await h.service.getById('idea-2')

    expect(detail).toMatchObject({
      problem: 'Onboarding takes too long.',
      impactRationale: 'Faster activation.',
      priority: 'High',
      proposedSolutions: ['Cut the number of forms.'],
    })
  })
})

describe('CSV export of a task', () => {
  async function exported() {
    const h = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [
        idea({ id: 'idea-2', title: 'Ordinary', priority: Priority.High }),
        idea({ id: 'task-1', title: 'A task', parentIdeaId: 'idea-0', priority: Priority.Medium }),
      ],
    })
    const { headers, rows } = await h.service.exportBoardIdeas(BOARD_A)
    const column = (name: string) => headers.indexOf(name)
    const row = (title: string) => rows.find((r) => r[0] === title) ?? []
    return { column, row }
  }

  it.each(['Problem', 'Proposed Solutions', 'Impact Rationale', 'Priority'])(
    'blanks the %s cell on a task and keeps it on an ordinary idea',
    async (name) => {
      const { column, row } = await exported()

      expect(row('A task')[column(name)]).toBe('')
      expect(row('Ordinary')[column(name)]).not.toBe('')
    },
  )

  it('keeps the title and the status on a task', async () => {
    const { column, row } = await exported()

    expect(row('A task')[column('Title')]).toBe('A task')
    expect(row('A task')[column('Status')]).not.toBe('')
  })

  // The task stores the organization's default type and impact only because the columns are NOT
  // NULL; every read hides them (Board References Ruling 2), but the export still names them.
  // contracts/ideas.md "Tasks and item keys": ideaTypeId and businessImpactId are null on a task.
  it.fails('blanks the Idea Type cell on a task (defect: the export names the stored default)', async () => {
    const { column, row } = await exported()

    expect(row('A task')[column('Idea Type')]).toBe('')
  })

  it.fails('blanks the Business Impact cell on a task (defect: the export names the stored default)', async () => {
    const { column, row } = await exported()

    expect(row('A task')[column('Business Impact')]).toBe('')
  })
})
