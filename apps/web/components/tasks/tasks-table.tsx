'use client'

import { Alert, Button, EmptyState, Select } from '@collega/design-system'
import type { Route } from 'next'
import Link from 'next/link'
import { useId, useState, useTransition } from 'react'
import { ParentChip } from '@/components/ideas/idea-badges'
import { People, TagList } from '@/components/ideas/idea-chips'
import type { OpenSprint, WorkBoard } from '@/lib/data/tasks'
import { moveTasksToSprint } from '@/lib/server/task-actions'
import { moveToSprintState } from '@/lib/task-planning'
import type { Idea } from '@/lib/types'

const plural = (n: number) => `${n} ${n === 1 ? 'task' : 'tasks'}`

/**
 * The Tasks page's list (TB-8): tasks across the work boards, each row naming its board. For an
 * Org Admin (`canPlan`) the rows carry checkboxes and the bar offers "Move to sprint", which is
 * enabled only while the selection sits on one board; otherwise it stays focusable and says why.
 */
export function TasksTable({
  rows,
  total,
  boards,
  sprints,
  canPlan,
  emptyHeading,
  emptyText,
}: {
  rows: readonly Idea[]
  total: number
  boards: readonly WorkBoard[]
  sprints: Record<string, OpenSprint[]>
  canPlan: boolean
  emptyHeading: string
  emptyText: string
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [sprintId, setSprintId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const id = useId()

  const boardName = (boardId: string | null) =>
    boards.find((board) => board.id === boardId)?.name ?? '—'
  const chosen = rows.filter((row) => selected.has(row.id))
  const plan = moveToSprintState(
    chosen.flatMap((row) => (row.boardId ? [row.boardId] : [])),
    boards,
    sprints,
  )
  const target = plan.enabled
    ? (plan.sprints.find((sprint) => sprint.id === sprintId) ?? plan.sprints[0])
    : undefined

  if (rows.length === 0) {
    return (
      <EmptyState heading={emptyHeading}>
        <>{emptyText}</>
      </EmptyState>
    )
  }

  const allSelected = rows.length > 0 && chosen.length === rows.length

  function toggle(rowId: string) {
    const next = new Set(selected)
    if (!next.delete(rowId)) next.add(rowId)
    setSelected(next)
    setDone(null)
  }

  function move() {
    if (!plan.enabled || !target) return
    const ideaIds = chosen.map((row) => row.id)
    setError(null)
    setDone(null)
    start(async () => {
      const result = await moveTasksToSprint(plan.boardId, target.id, ideaIds)
      if (result.error) {
        setError(result.error)
        return
      }
      setSelected(new Set())
      setDone(`Moved ${plural(ideaIds.length)} to ${target.name}.`)
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-8 flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span role="status">
          {plural(rows.length)}
          {total > rows.length ? ` (first ${rows.length} of ${total}, newest first)` : null}
          {canPlan && selected.size > 0 ? ` · ${selected.size} selected` : null}
          {done ? ` · ${done}` : null}
        </span>
        {canPlan && selected.size > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        ) : null}
      </div>

      {canPlan ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3.5 py-2">
          {plan.enabled ? (
            <>
              <label htmlFor={`${id}-sprint`} className="text-sm">
                Sprint on {plan.boardName}
              </label>
              <Select
                id={`${id}-sprint`}
                className="w-auto min-w-48"
                value={target?.id ?? ''}
                onChange={(event) => setSprintId(event.target.value)}
              >
                {plan.sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({sprint.state})
                  </option>
                ))}
              </Select>
              <Button onClick={move} disabled={pending}>
                {pending ? 'Moving…' : 'Move to sprint'}
              </Button>
            </>
          ) : (
            <>
              <Button aria-disabled="true" aria-describedby={`${id}-why`} variant="outline">
                Move to sprint
              </Button>
              <span id={`${id}-why`} className="text-sm text-muted-foreground">
                {plan.reason}
              </span>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <span>{error}</span>
        </Alert>
      ) : null}

      <div className="relative overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[860px]">
          <caption className="sr-only">Tasks across the organization&rsquo;s work boards</caption>
          <thead>
            <tr>
              {canPlan ? (
                <th scope="col" className="w-px px-3.5">
                  <input
                    type="checkbox"
                    aria-label="Select all shown tasks"
                    checked={allSelected}
                    onChange={() => {
                      setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
                      setDone(null)
                    }}
                  />
                </th>
              ) : null}
              <th scope="col" className="px-3.5">
                Key
              </th>
              <th scope="col" className="px-3.5">
                Task
              </th>
              <th scope="col" className="px-3.5">
                Board
              </th>
              <th scope="col" className="px-3.5">
                Parent idea
              </th>
              <th scope="col" className="px-3.5">
                Status
              </th>
              <th scope="col" className="px-3.5">
                Sprint
              </th>
              <th scope="col" className="px-3.5">
                Assignee
              </th>
              <th scope="col" className="hidden px-3.5 min-[1100px]:table-cell">
                Tags
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-row-key={row.id}>
                {canPlan ? (
                  <td className="px-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.itemKey ?? row.title}`}
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                ) : null}
                <td className="px-3.5 font-mono text-xs whitespace-nowrap">{row.itemKey ?? '—'}</td>
                <td className="px-3.5">
                  <Link
                    href={
                      `/boards/${encodeURIComponent(row.boardId ?? '')}?tab=board&idea=${encodeURIComponent(row.id)}` as Route
                    }
                    className="font-medium text-foreground hover:underline"
                  >
                    {row.title}
                  </Link>
                </td>
                <td className="px-3.5 whitespace-nowrap">{boardName(row.boardId)}</td>
                <td className="px-3.5">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {row.parentIdeaId ? (
                      <ParentChip itemKey={row.parentItemKey ?? null} />
                    ) : (
                      <span className="rounded border px-1.5 text-xs text-muted-foreground">
                        standalone
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3.5 whitespace-nowrap">{row.statusName}</td>
                <td className="px-3.5 whitespace-nowrap">
                  {row.sprint ? (
                    row.sprint.name
                  ) : (
                    <span className="text-muted-foreground">Backlog</span>
                  )}
                </td>
                <td className="px-3.5">
                  <People people={row.assignees} />
                </td>
                <td className="hidden px-3.5 min-[1100px]:table-cell">
                  <TagList tags={row.tags} max={2} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
