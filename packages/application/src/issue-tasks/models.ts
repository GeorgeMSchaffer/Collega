import type { IssueTaskState } from '@collega/domain/enums'

export type CreateIssueTaskCommand = {
  readonly title: string
  readonly assigneeUserId: string | null
}

export type UpdateIssueTaskCommand = CreateIssueTaskCommand

/** A checklist row as the Issue detail renders it. The assignee is carried as the persona the
 * rest of the idea payloads use, so a row renders a name and an avatar without a second request. */
export type IssueTaskItem = {
  readonly taskId: string
  readonly ideaId: string
  readonly title: string
  readonly assigneeUserId: string | null
  readonly assignee: IssueTaskAssigneeDto | null
  readonly state: IssueTaskState
  readonly sortOrder: number
  readonly completedAtUtc: Date | null
  readonly completedByUserId: string | null
}

export type IssueTaskAssigneeDto = {
  readonly userId: string
  readonly firstName: string
  readonly lastName: string
  readonly displayName: string
  readonly isActive: boolean
  readonly portraitDataUrl: string | null
}
