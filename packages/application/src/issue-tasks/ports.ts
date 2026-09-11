import type { Role, UserStatus } from '@collega/domain/enums'
import type { Idea } from '@collega/domain/ideas'
import type { IssueTask } from '@collega/domain/issue-tasks'

export interface IssueTaskRepository {
  /** One Issue's tasks in `sortOrder`. The dense-ordering invariant is a property of this whole
   * list, so every reorder and every delete reads it entire. */
  listByIdea(ideaId: string): Promise<readonly IssueTask[]>

  getById(taskId: string): Promise<IssueTask | null>

  add(task: IssueTask): Promise<void>

  save(task: IssueTask): Promise<void>

  /** Hard delete - a checklist step keeps no history of its own beyond the completion stamps on
   * the row (spec: "Deleting a Task is a hard delete"). */
  remove(taskId: string): Promise<void>
}

/** Tasks carry no organization of their own: every operation resolves the parent Idea first and
 * authorizes against that, so `ideas`' scoping stays the single enforcement point. */
export interface IssueTaskIdeaPort {
  getById(ideaId: string, includeDeleted?: boolean): Promise<Idea | null>
}

export type IssueTaskUserSummary = {
  readonly id: string
  readonly firstName: string
  readonly lastName: string
  readonly role: Role
  readonly status: UserStatus
  readonly organizationId: string | null
  readonly portraitPng: Uint8Array | null
}

export interface IssueTaskUsersPort {
  listByIds(userIds: readonly string[]): Promise<readonly IssueTaskUserSummary[]>
}

/** Only `IssueTaskAssigned` is ever written from here: no other task event notifies anyone. */
export type IssueTaskNotificationInput = {
  readonly eventType: 'IssueTaskAssigned'
  readonly organizationId: string
  readonly boardId: string
  readonly ideaId: string
  readonly ideaTitle: string
  readonly actorUserId: string
  readonly recipientUserId: string
}

export interface IssueTaskNotificationsPort {
  notify(input: IssueTaskNotificationInput): Promise<void>
}
