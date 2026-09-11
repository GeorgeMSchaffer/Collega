// Satisfies `IssueTaskRepository` (issue-tasks/ports.ts) and, structurally,
// `ideas.IssueTaskRollupPort` - the batched `N of M done` the delivery card needs.
//
// No organization column and no organization filter here, deliberately: a task is reached only
// through its idea, and `ideas`' scoping is the single enforcement point (see the `issue_tasks`
// model comment in schema.prisma). A `where: { organization_id }` on this table would be a second
// enforcement point that could disagree with the first.

import type { IssueTaskRollupPort } from '@collega/application/ideas'
import type { IssueTaskRepository } from '@collega/application/issue-tasks'
import type { IssueTaskState } from '@collega/domain/enums'
import { IssueTaskState as TaskState } from '@collega/domain/enums'
import type { IssueTask } from '@collega/domain/issue-tasks'
import type { issue_tasks as IssueTaskRow } from '../generated/prisma/index.js'
import type { PrismaClient } from '../persistence/prisma-client.js'
import type { PrismaUnitOfWork } from '../persistence/unit-of-work.js'

function fromRow(row: IssueTaskRow): IssueTask {
  return {
    id: row.id,
    ideaId: row.idea_id,
    title: row.title,
    assigneeUserId: row.assignee_user_id,
    state: row.state as IssueTaskState,
    sortOrder: row.sort_order,
    completedAtUtc: row.completed_at_utc,
    completedByUserId: row.completed_by_user_id,
    createdAtUtc: row.created_at_utc,
    updatedAtUtc: row.updated_at_utc,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
  }
}

export class PrismaIssueTaskRepository implements IssueTaskRepository, IssueTaskRollupPort {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly unitOfWork: PrismaUnitOfWork,
  ) {}

  /** `sortOrder` is dense and unique within an Issue, so it is a total order on its own. */
  async listByIdea(ideaId: string): Promise<readonly IssueTask[]> {
    const rows = await this.prisma.issue_tasks.findMany({
      where: { idea_id: ideaId },
      orderBy: { sort_order: 'asc' },
    })
    return rows.map(fromRow)
  }

  async getById(taskId: string): Promise<IssueTask | null> {
    const row = await this.prisma.issue_tasks.findUnique({ where: { id: taskId } })
    return row ? fromRow(row) : null
  }

  async add(task: IssueTask): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.issue_tasks.create({ data: writeData(task) }))
  }

  async save(task: IssueTask): Promise<void> {
    this.unitOfWork.enqueue(
      this.prisma.issue_tasks.update({ where: { id: task.id }, data: writeData(task) }),
    )
  }

  async remove(taskId: string): Promise<void> {
    this.unitOfWork.enqueue(this.prisma.issue_tasks.delete({ where: { id: taskId } }))
  }

  /** One grouped query for the whole board. Ideas with no tasks are absent from the map; the
   * caller reads that as `{ done: 0, total: 0 }`. */
  async summaryByIdeaIds(
    ideaIds: readonly string[],
  ): Promise<ReadonlyMap<string, { readonly done: number; readonly total: number }>> {
    if (ideaIds.length === 0) {
      return new Map()
    }

    const grouped = await this.prisma.issue_tasks.groupBy({
      by: ['idea_id', 'state'],
      where: { idea_id: { in: [...ideaIds] } },
      _count: { _all: true },
    })

    const summaries = new Map<string, { done: number; total: number }>()
    for (const group of grouped) {
      const current = summaries.get(group.idea_id) ?? { done: 0, total: 0 }
      const count = group._count._all
      summaries.set(group.idea_id, {
        done: current.done + (group.state === TaskState.Done ? count : 0),
        total: current.total + count,
      })
    }
    return summaries
  }
}

function writeData(task: IssueTask) {
  return {
    id: task.id,
    idea_id: task.ideaId,
    title: task.title,
    assignee_user_id: task.assigneeUserId,
    state: task.state,
    sort_order: task.sortOrder,
    completed_at_utc: task.completedAtUtc,
    completed_by_user_id: task.completedByUserId,
    created_at_utc: task.createdAtUtc,
    updated_at_utc: task.updatedAtUtc,
    created_by_user_id: task.createdByUserId,
    updated_by_user_id: task.updatedByUserId,
  }
}
