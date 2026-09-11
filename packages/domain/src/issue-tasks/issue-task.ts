// A checklist step on an Issue (SPEC/20-feature-issues-and-delivery.md "New entity: IssueTask").
//
// The shape is constrained by what a Task deliberately is NOT: it is not a first-class work item,
// so there is no sprint, no dates, no estimate, no comments, no tags and no nesting here. The
// reason is structural rather than minimalist - the Issue is the unit that moves between sprints,
// so a task that could be scheduled separately could be stranded in a sprint its parent had left,
// and an independently promotable task would reintroduce the two-object problem the phase model
// exists to avoid.
//
// Org scope is inherited through the parent idea and NOT duplicated on the row: every query
// reaches a task through its Idea, so the existing org scoping on `ideas` stays the single
// enforcement point.

import { type Auditable, markCreated, markUpdated } from '../common/index.js'
import { IdeaPhase, IssueTaskState } from '../enums/index.js'
import type { Idea } from '../ideas/index.js'

export const ISSUE_TASK_TITLE_MAX_LENGTH = 200

/** Mirrors `SprintInvariantError`/`StatusInvariantError`: the Application layer keys a 400 on `field`. */
export class IssueTaskInvariantError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'IssueTaskInvariantError'
    this.field = field
  }
}

export type IssueTask = Auditable & {
  readonly id: string
  /** The parent Issue. A task has no life outside it and is hard-deleted with it. */
  readonly ideaId: string
  readonly title: string
  /**
   * Optional, and NOT constrained to the parent Issue's assignees - any active user in the org
   * qualifies (checked in the Application layer). This is the one place delivery work is divided
   * between people, and requiring an Issue assignment first would force spurious ones just to name
   * a helper.
   */
  readonly assigneeUserId: string | null
  readonly state: IssueTaskState
  /** Dense and contiguous, `0..n-1` within the parent Issue. */
  readonly sortOrder: number
  /** Stamped on reaching `Done` and cleared on leaving it. The only completion record a task has. */
  readonly completedAtUtc: Date | null
  readonly completedByUserId: string | null
}

function requireTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new IssueTaskInvariantError('title', 'Title is required.')
  }
  if (trimmed.length > ISSUE_TASK_TITLE_MAX_LENGTH) {
    throw new IssueTaskInvariantError(
      'title',
      `Title must be ${ISSUE_TASK_TITLE_MAX_LENGTH} characters or fewer.`,
    )
  }
  return trimmed
}

/**
 * Appends a task to an Issue.
 *
 * Takes the parent `Idea` rather than a bare id so the Delivery-phase rule is enforced here, in the
 * domain, instead of being a check the Application layer has to remember: a task list is a delivery
 * artifact, and an idea still in Discovery does not have one.
 *
 * `sortOrder` is supplied by the caller (the current task count, for an append), matching
 * `createStatus`.
 */
export function createIssueTask(params: {
  readonly id: string
  readonly idea: Idea
  readonly title: string
  readonly assigneeUserId: string | null
  readonly sortOrder: number
  readonly nowUtc: Date
  readonly actorUserId: string | null
}): IssueTask {
  if (params.idea.phase !== IdeaPhase.Delivery) {
    throw new IssueTaskInvariantError('ideaId', 'Only a promoted idea can carry tasks.')
  }

  return {
    id: params.id,
    ideaId: params.idea.id,
    title: requireTitle(params.title),
    assigneeUserId: params.assigneeUserId,
    state: IssueTaskState.NotStarted,
    sortOrder: params.sortOrder,
    completedAtUtc: null,
    completedByUserId: null,
    ...markCreated(params.nowUtc, params.actorUserId),
  }
}

/** Renames and reassigns - the two edits the task row exposes together. */
export function updateIssueTask(
  task: IssueTask,
  params: { readonly title: string; readonly assigneeUserId: string | null },
  nowUtc: Date,
  actorUserId: string | null,
): IssueTask {
  return markUpdated(
    { ...task, title: requireTitle(params.title), assigneeUserId: params.assigneeUserId },
    nowUtc,
    actorUserId,
  )
}

/**
 * Moves a task between its three states, stamping `Done` and clearing the stamp on the way back
 * out. Those two fields are the only record a task keeps - there is no per-task history - which is
 * why re-applying the state a task already has returns it untouched: re-stamping would quietly
 * overwrite who actually finished it, and when.
 */
export function changeIssueTaskState(
  task: IssueTask,
  state: IssueTaskState,
  nowUtc: Date,
  actorUserId: string | null,
): IssueTask {
  if (task.state === state) {
    return task
  }
  const completed = state === IssueTaskState.Done

  return markUpdated(
    {
      ...task,
      state,
      completedAtUtc: completed ? nowUtc : null,
      completedByUserId: completed ? actorUserId : null,
    },
    nowUtc,
    actorUserId,
  )
}

/**
 * Rewrites the whole list's `sortOrder` to `0..n-1` in the given order, which is the only way the
 * dense-and-contiguous invariant can be maintained - it is a property of the list, not of any one
 * row. Also the densify step after a hard delete: pass the survivors in their current order.
 *
 * `orderedTaskIds` must match the Issue's tasks exactly - no missing id, no unknown id, no
 * duplicate. A partial reorder is rejected rather than interpreted, because every reading of a
 * partial list ("move these to the front"? "drop the rest"?) is a guess at what the caller meant.
 * Unmoved tasks are returned untouched so a drag does not re-stamp the whole checklist.
 */
export function reorderIssueTasks(
  tasks: readonly IssueTask[],
  orderedTaskIds: readonly string[],
  nowUtc: Date,
  actorUserId: string | null,
): readonly IssueTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const seen = new Set<string>()

  const reordered = orderedTaskIds.map((id, index) => {
    const task = byId.get(id)
    if (!task || seen.has(id)) {
      throw new IssueTaskInvariantError(
        'taskIds',
        'The task order must list each of this issue’s tasks exactly once.',
      )
    }
    seen.add(id)
    return task.sortOrder === index
      ? task
      : markUpdated({ ...task, sortOrder: index }, nowUtc, actorUserId)
  })

  if (seen.size !== tasks.length) {
    throw new IssueTaskInvariantError(
      'taskIds',
      'The task order must list each of this issue’s tasks exactly once.',
    )
  }
  return reordered
}
