// Issue tasks (SPEC/20-feature-issues-and-delivery.md "Tasks").
//
// A task has no organization, no board and no scope of its own - every method resolves the parent
// Idea and authorizes against that. The tests that matter are therefore the ones proving the
// nested route cannot be used to reach past its parent: a taskId from another Issue, and an ideaId
// from another organization.

import { IssueTaskState, Priority, Role, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import { createIdea, promoteIdeaToIssue } from '@collega/domain/ideas'
import { createIssueTask, type IssueTask } from '@collega/domain/issue-tasks'
import { describe, expect, it } from 'vitest'
import type { CurrentUserContext } from '../../src/common/index.js'
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/common/index.js'
import { IssueTaskService } from '../../src/issue-tasks/issue-task.service.js'
import type {
  IssueTaskIdeaPort,
  IssueTaskNotificationInput,
  IssueTaskNotificationsPort,
  IssueTaskRepository,
  IssueTaskUserSummary,
  IssueTaskUsersPort,
} from '../../src/issue-tasks/ports.js'
import {
  countingUnitOfWork,
  fixedClock,
  NOW,
  ORG_A,
  ORG_B,
  orgAdmin,
  readOnly,
  siteAdmin,
  member,
} from '../support/fixtures.js'

const ISSUE_A = 'issue-a'
const ISSUE_B = 'issue-b'
const AUTHOR = 'author-1'

function issue(overrides: { id?: string; organizationId?: string; assigneeUserIds?: string[] } = {}): Idea {
  const base = createIdea({
    id: overrides.id ?? ISSUE_A,
    organizationId: overrides.organizationId ?? ORG_A,
    boardId: 'board-a',
    statusId: 'status-1',
    title: 'An issue',
    description: 'Body',
    priority: Priority.Medium,
    ideaTypeId: 'type-a',
    businessImpactId: 'impact-a',
    dueDate: null,
    authorUserId: AUTHOR,
    assigneeUserIds: overrides.assigneeUserIds ?? [],
    tagIds: [],
    mentionedUserIds: [],
    nowUtc: NOW,
  })
  return promoteIdeaToIssue(
    base,
    { effort: 'Medium' as never, sprintId: null, currentUpvoteCount: 0 },
    NOW,
    AUTHOR,
  )
}

function discoveryIdea(): Idea {
  return createIdea({
    id: 'idea-discovery',
    organizationId: ORG_A,
    boardId: 'board-a',
    statusId: 'status-1',
    title: 'Not yet promoted',
    description: 'Body',
    priority: Priority.Medium,
    ideaTypeId: 'type-a',
    businessImpactId: 'impact-a',
    dueDate: null,
    authorUserId: AUTHOR,
    assigneeUserIds: [],
    tagIds: [],
    mentionedUserIds: [],
    nowUtc: NOW,
  })
}

function task(parent: Idea, id: string, sortOrder = 0): IssueTask {
  return createIssueTask({
    id,
    idea: parent,
    title: `Task ${id}`,
    assigneeUserId: null,
    sortOrder,
    nowUtc: NOW,
    actorUserId: AUTHOR,
  })
}

function harness(options: {
  currentUser: CurrentUserContext
  ideas?: readonly Idea[]
  tasks?: readonly IssueTask[]
  users?: readonly IssueTaskUserSummary[]
}) {
  const ideasById = new Map((options.ideas ?? [issue()]).map((i) => [i.id, i]))
  const tasksById = new Map((options.tasks ?? []).map((t) => [t.id, t]))
  const usersById = new Map((options.users ?? []).map((u) => [u.id, u]))
  const added: IssueTask[] = []
  const saved: IssueTask[] = []
  const removed: string[] = []
  const notifications: IssueTaskNotificationInput[] = []

  const tasks: IssueTaskRepository = {
    async listByIdea(ideaId) {
      return [...tasksById.values()]
        .filter((t) => t.ideaId === ideaId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    },
    async getById(id) {
      return tasksById.get(id) ?? null
    },
    async add(t) {
      added.push(t)
      tasksById.set(t.id, t)
    },
    async save(t) {
      saved.push(t)
      tasksById.set(t.id, t)
    },
    async remove(id) {
      removed.push(id)
      tasksById.delete(id)
    },
  }

  const ideas: IssueTaskIdeaPort = {
    async getById(ideaId, includeDeleted = false) {
      const found = ideasById.get(ideaId) ?? null
      if (!found || (found.isDeleted && !includeDeleted)) {
        return null
      }
      return found
    },
  }

  const users: IssueTaskUsersPort = {
    async listByIds(ids) {
      return ids.flatMap((id) => {
        const found = usersById.get(id)
        return found ? [found] : []
      })
    },
  }

  const notificationsPort: IssueTaskNotificationsPort = {
    async notify(input) {
      notifications.push(input)
    },
  }

  return {
    service: new IssueTaskService(
      tasks,
      ideas,
      users,
      notificationsPort,
      countingUnitOfWork(),
      options.currentUser,
      fixedClock(),
    ),
    added,
    saved,
    removed,
    notifications,
  }
}

describe('IssueTaskService cross-organization isolation', () => {
  const foreign = issue({ id: ISSUE_B, organizationId: ORG_B })

  it.each([
    ['OrgAdmin', orgAdmin(ORG_A)],
    ['User', member(ORG_A)],
    ['ReadOnly', readOnly(ORG_A)],
  ])('refuses %s the checklist of another organization’s issue', async (_l, currentUser) => {
    const { service } = harness({ currentUser, ideas: [foreign] })

    await expect(service.list(ISSUE_B)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses creating a task on another organization’s issue', async () => {
    const { service, added } = harness({ currentUser: orgAdmin(ORG_A), ideas: [foreign] })

    await expect(service.create(ISSUE_B, { title: 'X', assigneeUserId: null })).rejects.toThrow(
      NotFoundError,
    )
    expect(added).toHaveLength(0)
  })

  it('refuses a task whose parent is a different issue - the nested route cannot reach past it', async () => {
    const local = issue()
    const other = issue({ id: ISSUE_B })
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [local, other],
      tasks: [task(other, 'task-b')],
    })

    await expect(
      service.update(ISSUE_A, 'task-b', { title: 'X', assigneeUserId: null }),
    ).rejects.toThrow(NotFoundError)
    expect(saved).toHaveLength(0)
  })

  it('refuses a task assignee from another organization', async () => {
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      users: [
        {
          id: 'outsider',
          firstName: 'O',
          lastName: 'Utsider',
          role: Role.User,
          status: UserStatus.Active,
          organizationId: ORG_B,
          portraitPng: null,
        },
      ],
    })

    await expect(
      service.create(ISSUE_A, { title: 'X', assigneeUserId: 'outsider' }),
    ).rejects.toThrow(ValidationError)
    expect(added).toHaveLength(0)
  })

  it('lets a Site Admin read any organization’s checklist', async () => {
    const { service } = harness({ currentUser: siteAdmin(), ideas: [foreign] })

    await expect(service.list(ISSUE_B)).resolves.toEqual([])
  })
})

describe('IssueTaskService role matrix', () => {
  it('refuses a direct Site Admin every task mutation (rule 25), while leaving the read open', async () => {
    const { service, added } = harness({ currentUser: siteAdmin() })

    await expect(service.list(ISSUE_A)).resolves.toEqual([])
    await expect(service.create(ISSUE_A, { title: 'X', assigneeUserId: null })).rejects.toThrow(
      ForbiddenError,
    )
    expect(added).toHaveLength(0)
  })

  it('lets Read Only read the checklist but not change it', async () => {
    const { service } = harness({ currentUser: readOnly(ORG_A) })

    await expect(service.list(ISSUE_A)).resolves.toEqual([])
    await expect(service.create(ISSUE_A, { title: 'X', assigneeUserId: null })).rejects.toThrow(
      ForbiddenError,
    )
  })

  it('lets the issue author, an assignee, or an in-scope Org Admin edit tasks', async () => {
    const parent = issue({ assigneeUserIds: ['helper-1'] })

    for (const caller of [
      member(ORG_A, AUTHOR),
      member(ORG_A, 'helper-1'),
      orgAdmin(ORG_A),
    ]) {
      const { service, added } = harness({ currentUser: caller, ideas: [parent] })
      await service.create(ISSUE_A, { title: 'X', assigneeUserId: null })
      expect(added).toHaveLength(1)
    }
  })

  it('refuses an unrelated member of the same organization', async () => {
    const { service, added } = harness({ currentUser: member(ORG_A, 'someone-else') })

    await expect(service.create(ISSUE_A, { title: 'X', assigneeUserId: null })).rejects.toThrow(
      ForbiddenError,
    )
    expect(added).toHaveLength(0)
  })

  it('refuses an Org Admin of another organization even though the role alone would pass', async () => {
    const { service } = harness({ currentUser: orgAdmin(ORG_B, 'admin-b') })

    await expect(service.create(ISSUE_A, { title: 'X', assigneeUserId: null })).rejects.toThrow(
      NotFoundError,
    )
  })

  it('checks authorization on the state change too, not only on create and update', async () => {
    const parent = issue()
    const { service, saved } = harness({
      currentUser: member(ORG_A, 'someone-else'),
      ideas: [parent],
      tasks: [task(parent, 'task-1')],
    })

    await expect(service.changeState(ISSUE_A, 'task-1', IssueTaskState.Done)).rejects.toThrow(
      ForbiddenError,
    )
    expect(saved).toHaveLength(0)
  })
})

describe('IssueTaskService checklist behaviour', () => {
  it('refuses a task on an idea that has not been promoted - a checklist is a delivery artifact', async () => {
    const { service } = harness({
      currentUser: member(ORG_A, AUTHOR),
      ideas: [discoveryIdea()],
    })

    await expect(
      service.create('idea-discovery', { title: 'X', assigneeUserId: null }),
    ).rejects.toThrow(ValidationError)
  })

  it('appends a new task at the end of the checklist', async () => {
    const parent = issue()
    const { service, added } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [parent],
      tasks: [task(parent, 'task-1', 0), task(parent, 'task-2', 1)],
    })

    await service.create(ISSUE_A, { title: 'Third', assigneeUserId: null })

    expect(added[0]?.sortOrder).toBe(2)
  })

  it('rejects a reorder that does not name every task exactly once', async () => {
    const parent = issue()
    const { service, saved } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [parent],
      tasks: [task(parent, 'task-1', 0), task(parent, 'task-2', 1)],
    })

    await expect(service.reorder(ISSUE_A, ['task-1'])).rejects.toThrow(ValidationError)
    expect(saved).toHaveLength(0)
  })

  it('re-densifies sort order after a delete so no hole is left behind', async () => {
    const parent = issue()
    const { service, saved, removed } = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [parent],
      tasks: [task(parent, 'task-1', 0), task(parent, 'task-2', 1), task(parent, 'task-3', 2)],
    })

    await service.delete(ISSUE_A, 'task-1')

    expect(removed).toEqual(['task-1'])
    expect(saved.map((t) => [t.id, t.sortOrder])).toEqual([
      ['task-2', 0],
      ['task-3', 1],
    ])
  })

  it('notifies a newly named assignee, and nobody when the assignee is unchanged', async () => {
    const parent = issue()
    const helper: IssueTaskUserSummary = {
      id: 'helper-1',
      firstName: 'Hal',
      lastName: 'Helper',
      role: Role.User,
      status: UserStatus.Active,
      organizationId: ORG_A,
      portraitPng: null,
    }
    const assigned = { ...task(parent, 'task-1'), assigneeUserId: 'helper-1' }

    const changed = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [parent],
      tasks: [task(parent, 'task-1')],
      users: [helper],
    })
    await changed.service.update(ISSUE_A, 'task-1', { title: 'X', assigneeUserId: 'helper-1' })
    expect(changed.notifications).toHaveLength(1)

    const unchanged = harness({
      currentUser: orgAdmin(ORG_A),
      ideas: [parent],
      tasks: [assigned],
      users: [helper],
    })
    await unchanged.service.update(ISSUE_A, 'task-1', { title: 'Renamed', assigneeUserId: 'helper-1' })
    expect(unchanged.notifications).toHaveLength(0)
  })

  it('does not notify someone who assigned a task to themselves', async () => {
    const parent = issue()
    const self: IssueTaskUserSummary = {
      id: 'admin-self',
      firstName: 'Ada',
      lastName: 'Admin',
      role: Role.OrgAdmin,
      status: UserStatus.Active,
      organizationId: ORG_A,
      portraitPng: null,
    }
    const { service, notifications } = harness({
      currentUser: orgAdmin(ORG_A, 'admin-self'),
      ideas: [parent],
      users: [self],
    })

    await service.create(ISSUE_A, { title: 'X', assigneeUserId: 'admin-self' })

    expect(notifications).toHaveLength(0)
  })
})
