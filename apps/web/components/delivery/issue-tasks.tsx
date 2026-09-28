'use client'

import { Button, Input, Select } from '@collega/design-system'
import { type FormEvent, useId, useOptimistic, useState, useTransition } from 'react'
import { Icon } from '@/components/list/icons'
import {
  addTask,
  type DeliveryResult,
  deleteTask,
  reorderTasks,
  setTaskState,
  updateTask,
} from '@/lib/server/delivery-actions'
import type { IssueTask, IssueTaskState, MemberOption } from '@/lib/types'

const STATES: { value: IssueTaskState; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Done', label: 'Done' },
]

const stateLabel = (state: IssueTaskState) =>
  STATES.find((option) => option.value === state)?.label ?? state

/**
 * An Issue's checklist with its *N of M done* counter. The author, an assignee or an admin
 * (`canEdit`) gets each row's state, assignee, order and delete, and *Add task*; everyone else reads
 * the list. Every change goes to the API and the page re-reads; nothing is held here but drafts.
 */
export function IssueTasks({
  ideaId,
  tasks,
  members,
  canEdit,
}: {
  ideaId: string
  tasks: IssueTask[]
  members: MemberOption[]
  canEdit: boolean
}) {
  const id = useId()
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // Each change shows at once and settles when the page re-reads, or falls back on a refusal.
  const [shown, change] = useOptimistic(
    tasks,
    (list: IssueTask[], next: (list: IssueTask[]) => IssueTask[]) => next(list),
  )
  const done = shown.filter((task) => task.state === 'Done').length

  const run = (
    write: () => Promise<DeliveryResult>,
    optimistic?: (list: IssueTask[]) => IssueTask[],
    then?: () => void,
  ) =>
    startTransition(async () => {
      if (optimistic) change(optimistic)
      const result = await write()
      setError(result.error)
      if (!result.error) then?.()
    })

  const add = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    run(
      () => addTask(ideaId, title.trim(), assignee),
      undefined,
      () => {
        setTitle('')
        setAssignee('')
      },
    )
  }

  const move = (index: number, by: -1 | 1) => {
    if (pending) return
    const order = [...shown]
    const [task] = order.splice(index, 1)
    if (!task) return
    order.splice(index + by, 0, task)
    run(
      () =>
        reorderTasks(
          ideaId,
          order.map((t) => t.id),
        ),
      () => order,
    )
  }

  const patch = (taskId: string, fields: Partial<IssueTask>) => (list: IssueTask[]) =>
    list.map((task) => (task.id === taskId ? { ...task, ...fields } : task))

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3
          id={`${id}-h`}
          className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Tasks
        </h3>
        <span className="font-mono text-[11px] text-muted-foreground">
          {done} of {shown.length} done
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No tasks yet.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((task, index) => (
            <li key={task.id} className="flex flex-col gap-1.5 rounded-md border px-2.5 py-2">
              <span
                className={
                  task.state === 'Done' ? 'text-sm text-muted-foreground line-through' : 'text-sm'
                }
              >
                {task.title}
              </span>
              {canEdit ? (
                <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto_auto_auto] items-center gap-1">
                  <Select
                    aria-label={`State of ${task.title}`}
                    value={task.state}
                    onChange={(event) =>
                      run(
                        () => setTaskState(ideaId, task.id, event.target.value),
                        patch(task.id, { state: event.target.value as IssueTaskState }),
                      )
                    }
                    className="h-7 min-h-0 w-full py-0 text-xs"
                  >
                    {STATES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                  <Select
                    aria-label={`Assignee of ${task.title}`}
                    value={task.assigneeUserId ?? ''}
                    onChange={(event) =>
                      run(
                        () => updateTask(ideaId, task.id, task.title, event.target.value),
                        patch(task.id, {
                          assigneeUserId: event.target.value || null,
                          assigneeName:
                            members.find((m) => m.id === event.target.value)?.name ?? null,
                        }),
                      )
                    }
                    className="h-7 min-h-0 w-full py-0 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {task.assigneeUserId && !members.some((m) => m.id === task.assigneeUserId) ? (
                      <option value={task.assigneeUserId}>{task.assigneeName ?? 'Inactive'}</option>
                    ) : null}
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-7 px-0"
                    disabled={index === 0}
                    aria-label={`Move ${task.title} up`}
                    onClick={() => move(index, -1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-7 px-0"
                    disabled={index === shown.length - 1}
                    aria-label={`Move ${task.title} down`}
                    onClick={() => move(index, 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${task.title}`}
                    onClick={() =>
                      run(
                        () => deleteTask(ideaId, task.id),
                        (list) => list.filter((t) => t.id !== task.id),
                      )
                    }
                    className="w-7 px-0 text-destructive hover:text-destructive"
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {stateLabel(task.state)}
                  {task.assigneeName ? ` · ${task.assigneeName}` : null}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit ? (
        <form onSubmit={add} className="flex flex-wrap items-center gap-1.5">
          <Input
            aria-label="New task"
            placeholder="Add a task"
            value={title}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            className="min-w-40 flex-1"
          />
          <Select
            aria-label="New task assignee"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            className="w-auto max-w-44"
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="outline" disabled={pending || !title.trim()}>
            <Icon name="plus" />
            Add task
          </Button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="m-0 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  )
}
