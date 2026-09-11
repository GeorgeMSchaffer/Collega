// Task use cases (SPEC/20-feature-issues-and-delivery.md "New service: IIssueTaskService"). A Task
// is a checklist step on an Issue, not a work item: it has no organization, no board and no scope
// of its own, so EVERY method here resolves the parent Idea first and authorizes against that.
// That is what keeps `ideas`' organization scoping the single enforcement point.
//
// Task mutations are deliberately NOT audited (spec "Audit & Notifications"): a checklist ticked a
// dozen times a day would drown the audit log that exists to answer "who committed us to this
// work". `completedAtUtc`/`completedByUserId` on the row carry the only record that matters. The
// one notification is to a task's new assignee.

import { randomUUID } from 'node:crypto'
import { type IssueTaskState, Role, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import type { IssueTask } from '@collega/domain/issue-tasks'
import {
  changeIssueTaskState,
  createIssueTask,
  IssueTaskInvariantError,
  reorderIssueTasks,
  updateIssueTask,
} from '@collega/domain/issue-tasks'
import {
  type Clock,
  type CurrentUserContext,
  ensureNotDirectSiteAdmin,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  type UnitOfWork,
  ValidationError,
} from '../common/index.js'
import type {
  CreateIssueTaskCommand,
  IssueTaskAssigneeDto,
  IssueTaskItem,
  UpdateIssueTaskCommand,
} from './models.js'
import type {
  IssueTaskIdeaPort,
  IssueTaskNotificationsPort,
  IssueTaskRepository,
  IssueTaskUserSummary,
  IssueTaskUsersPort,
} from './ports.js'

export class IssueTaskService {
  constructor(
    private readonly tasks: IssueTaskRepository,
    private readonly ideas: IssueTaskIdeaPort,
    private readonly users: IssueTaskUsersPort,
    private readonly notifications: IssueTaskNotificationsPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly currentUser: CurrentUserContext,
    private readonly clock: Clock,
  ) {}

  /** Reading the checklist is available to anyone who can see the Issue, Read Only included. */
  async list(ideaId: string): Promise<readonly IssueTaskItem[]> {
    const idea = await this.requireVisibleIdea(ideaId)
    return this.project(await this.tasks.listByIdea(idea.id))
  }

  async create(ideaId: string, command: CreateIssueTaskCommand): Promise<IssueTaskItem> {
    const idea = await this.requireEditableIdea(ideaId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const assigneeUserId = await this.resolveAssignee(idea, command.assigneeUserId)
    const existing = await this.tasks.listByIdea(idea.id)

    // The domain rejects a task on a Discovery item (400) - a checklist is a delivery artifact.
    const task = runDomain(createIssueTask, {
      id: randomUUID(),
      idea,
      title: command.title ?? '',
      assigneeUserId,
      sortOrder: existing.length,
      nowUtc: now,
      actorUserId: actorId,
    })

    await this.tasks.add(task)
    await this.unitOfWork.saveChanges()

    await this.notifyAssignee(idea, assigneeUserId, actorId)

    const [item] = await this.project([task])
    if (!item) {
      throw new NotFoundError('Task not found.')
    }
    return item
  }

  async update(
    ideaId: string,
    taskId: string,
    command: UpdateIssueTaskCommand,
  ): Promise<IssueTaskItem> {
    const { idea, task: existing } = await this.requireTask(ideaId, taskId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const assigneeUserId = await this.resolveAssignee(idea, command.assigneeUserId)

    const task = runDomain(
      updateIssueTask,
      existing,
      { title: command.title ?? '', assigneeUserId },
      now,
      actorId,
    )

    await this.tasks.save(task)
    await this.unitOfWork.saveChanges()

    // Only a genuinely new assignee is notified; re-saving a row without touching its assignee
    // must not re-page them.
    if (assigneeUserId !== null && assigneeUserId !== existing.assigneeUserId) {
      await this.notifyAssignee(idea, assigneeUserId, actorId)
    }

    const [item] = await this.project([task])
    if (!item) {
      throw new NotFoundError('Task not found.')
    }
    return item
  }

  async changeState(ideaId: string, taskId: string, state: IssueTaskState): Promise<void> {
    const { task: existing } = await this.requireTask(ideaId, taskId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const task = changeIssueTaskState(existing, state, now, actorId)
    if (task === existing) {
      return
    }

    await this.tasks.save(task)
    await this.unitOfWork.saveChanges()
  }

  /** Rewrites the whole checklist's order. `taskIds` must name each of this Issue's tasks exactly
   * once - a partial list is rejected (400) rather than interpreted. */
  async reorder(ideaId: string, taskIds: readonly string[]): Promise<void> {
    const idea = await this.requireEditableIdea(ideaId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const existing = await this.tasks.listByIdea(idea.id)
    const reordered = runDomain(reorderIssueTasks, existing, taskIds ?? [], now, actorId)

    // Every save is staged; the single commit after the loop is what makes the reorder atomic, so
    // a failure cannot leave the checklist half-renumbered (SPEC/decisions.md "Wave B conventions").
    const byId = new Map(existing.map((task) => [task.id, task]))
    for (const task of reordered) {
      if (byId.get(task.id) !== task) {
        await this.tasks.save(task)
      }
    }
    await this.unitOfWork.saveChanges()
  }

  /** Hard delete, then re-densify so `sortOrder` stays `0..n-1`. */
  async delete(ideaId: string, taskId: string): Promise<void> {
    const { idea, task } = await this.requireTask(ideaId, taskId)

    const now = this.clock.now()
    const actorId = this.requireAuthenticatedUserId()
    const survivors = (await this.tasks.listByIdea(idea.id)).filter((t) => t.id !== task.id)

    await this.tasks.remove(task.id)

    // Re-densify: the survivors keep their relative order, and `reorderIssueTasks` returns any
    // task whose sortOrder is already right untouched - so only the rows after the hole are saved.
    const densified = reorderIssueTasks(
      survivors,
      survivors.map((t) => t.id),
      now,
      actorId,
    )
    for (const [index, survivor] of densified.entries()) {
      if (survivor !== survivors[index]) {
        await this.tasks.save(survivor)
      }
    }
    await this.unitOfWork.saveChanges()
  }

  // Projection ---------------------------------------------------------------------------------

  private async project(tasks: readonly IssueTask[]): Promise<readonly IssueTaskItem[]> {
    if (tasks.length === 0) {
      return []
    }

    // One user read for the whole checklist, not one per row.
    const assigneeIds = [
      ...new Set(tasks.flatMap((t) => (t.assigneeUserId ? [t.assigneeUserId] : []))),
    ]
    const users = assigneeIds.length > 0 ? await this.users.listByIds(assigneeIds) : []
    const byId = new Map(users.map((u) => [u.id, u]))

    return [...tasks]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((task) => {
        const assignee = task.assigneeUserId ? byId.get(task.assigneeUserId) : undefined
        return {
          taskId: task.id,
          ideaId: task.ideaId,
          title: task.title,
          assigneeUserId: task.assigneeUserId,
          assignee: assignee ? toPersonDto(assignee) : null,
          state: task.state,
          sortOrder: task.sortOrder,
          completedAtUtc: task.completedAtUtc,
          completedByUserId: task.completedByUserId,
        }
      })
  }

  // Resolution ---------------------------------------------------------------------------------

  /** A task assignee need NOT be an assignee of the parent Issue - any active user in the org
   * qualifies (spec "Task assignee"). Constraining it to the Issue's assignees would force
   * spurious Issue assignments just to name a helper. */
  private async resolveAssignee(idea: Idea, assigneeUserId: string | null): Promise<string | null> {
    const trimmed = assigneeUserId?.trim()
    if (!trimmed) {
      return null
    }

    const [user] = await this.users.listByIds([trimmed])
    if (
      !user ||
      user.organizationId !== idea.organizationId ||
      user.role === Role.SiteAdmin ||
      user.status !== UserStatus.Active
    ) {
      throw new ValidationError('One or more fields are invalid.', {
        assigneeUserId: ['Assignee must be an active user in this organization.'],
      })
    }
    return user.id
  }

  private async notifyAssignee(
    idea: Idea,
    assigneeUserId: string | null,
    actorId: string,
  ): Promise<void> {
    if (!assigneeUserId || assigneeUserId === actorId) {
      return
    }
    await this.notifications.notify({
      eventType: 'IssueTaskAssigned',
      organizationId: idea.organizationId,
      boardId: idea.boardId,
      ideaId: idea.id,
      ideaTitle: idea.title,
      actorUserId: actorId,
      recipientUserId: assigneeUserId,
    })
  }

  // Authorization / scoping ---------------------------------------------------------------------

  private async requireVisibleIdea(ideaId: string): Promise<Idea> {
    const idea = await this.ideas.getById(ideaId, false)
    if (!idea) {
      throw new NotFoundError('Idea not found.')
    }

    const role = this.requireAuthenticatedRole()
    if (role !== Role.SiteAdmin && this.currentUser.organizationId !== idea.organizationId) {
      // 404, not 403: confirming the Issue exists elsewhere is the thing being fished for.
      throw new NotFoundError('Idea not found.')
    }
    return idea
  }

  /** Mirrors `changeDeliveryStatus`: the idea author, any Issue assignee, or an in-scope admin. */
  private async requireEditableIdea(ideaId: string): Promise<Idea> {
    ensureNotDirectSiteAdmin(this.currentUser)
    const idea = await this.requireVisibleIdea(ideaId)

    const role = this.requireAuthenticatedRole()
    const userId = this.currentUser.userId
    const isAdmin =
      role === Role.OrgAdmin && this.currentUser.organizationId === idea.organizationId
    const isOwner =
      userId !== null && (idea.authorUserId === userId || idea.assigneeUserIds.includes(userId))

    if (!isAdmin && !isOwner) {
      throw new ForbiddenError("You are not allowed to change this issue's tasks.")
    }
    return idea
  }

  /**
   * A `taskId` whose parent is not `{ideaId}` answers 404, never 403, so the nested route cannot
   * be used to probe for ideas in other organizations (spec "Tasks (Slice 1)").
   */
  private async requireTask(
    ideaId: string,
    taskId: string,
  ): Promise<{ idea: Idea; task: IssueTask }> {
    const idea = await this.requireEditableIdea(ideaId)
    const task = await this.tasks.getById(taskId)
    if (!task || task.ideaId !== idea.id) {
      throw new NotFoundError('Task not found.')
    }
    return { idea, task }
  }

  private requireAuthenticatedRole(): Role {
    if (!this.currentUser.isAuthenticated || this.currentUser.role === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.role
  }

  private requireAuthenticatedUserId(): string {
    if (!this.currentUser.isAuthenticated || this.currentUser.userId === null) {
      throw new UnauthorizedError('Caller identity could not be resolved.')
    }
    return this.currentUser.userId
  }
}

function toPersonDto(user: IssueTaskUserSummary): IssueTaskAssigneeDto {
  return {
    userId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: `${user.firstName} ${user.lastName}`.trim(),
    isActive: user.status === UserStatus.Active,
    portraitDataUrl:
      user.portraitPng && user.portraitPng.length > 0
        ? `data:image/png;base64,${Buffer.from(user.portraitPng).toString('base64')}`
        : null,
  }
}

/** Surfaces an `IssueTaskInvariantError` as the field-keyed 400 the contract answers. */
function runDomain<Args extends readonly unknown[], T>(fn: (...args: Args) => T, ...args: Args): T {
  try {
    return fn(...args)
  } catch (error) {
    if (error instanceof IssueTaskInvariantError) {
      throw new ValidationError('One or more fields are invalid.', {
        [error.field]: [error.message],
      })
    }
    throw error
  }
}
